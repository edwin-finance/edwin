import { Client, AccountId, Transaction, Hbar } from '@hashgraph/sdk';
import edwinLogger from '../../../utils/logger';
import { HederaWalletClient } from './client';

/**
 * Base class for Hedera wallet clients with common functionality
 */
export abstract class BaseHederaWalletClient implements HederaWalletClient {
    /**
     * The wallet's account ID
     */
    public readonly accountId: AccountId;

    /**
     * Cached RPC URL to avoid multiple environment lookups
     */
    private static cachedRpcUrl: string | null = null;

    constructor(accountId: string | AccountId) {
        this.accountId = typeof accountId === 'string' ? AccountId.fromString(accountId) : accountId;
    }

    /**
     * Get the Hedera JSON-RPC URL for ethers provider
     * Uses HEDERA_RPC_URL from environment, or falls back to public HashIO (testing only)
     */
    static getHederaRpcUrl(network?: string): string {
        // Use provided network or fall back to environment
        const targetNetwork = network || process.env.HEDERA_NETWORK || 'mainnet';

        // Check if custom RPC URL is provided
        const customRpcUrl = process.env.HEDERA_RPC_URL;
        if (customRpcUrl) {
            // Cache and return custom URL
            if (!BaseHederaWalletClient.cachedRpcUrl) {
                BaseHederaWalletClient.cachedRpcUrl = customRpcUrl;
                edwinLogger.info(`Using custom Hedera RPC URL for ${targetNetwork}`);
            }
            return customRpcUrl;
        }

        // Fallback to public HashIO (rate-limited, testing only)
        const hashioUrl = `https://${targetNetwork}.hashio.io/api`;
        edwinLogger.warn(
            `No HEDERA_RPC_URL found. Using HashIO (rate-limited, testing only). ` +
                `Get a premium RPC from https://app.validationcloud.io for better performance.`
        );
        return hashioUrl;
    }

    /**
     * Get account ID as string
     */
    getAddress(): string {
        return this.accountId.toString();
    }

    /**
     * Get the Hedera JSON-RPC URL (instance method that calls static method)
     */
    getHederaRpcUrl(network?: string): string {
        return BaseHederaWalletClient.getHederaRpcUrl(network);
    }

    /**
     * Get the Mirror Node base URL (without /api/v1 suffix)
     * Uses HEDERA_RPC_URL if available (e.g., Validation Cloud mirror node)
     * Falls back to public Hedera mirror nodes
     *
     * Note: Returns base URL without /api/v1 - callers should append the specific endpoint
     */
    static getMirrorNodeUrl(network?: string): string {
        const targetNetwork = network || process.env.HEDERA_NETWORK || 'mainnet';

        // Check if custom RPC URL is configured
        const customRpcUrl = process.env.HEDERA_RPC_URL;
        if (customRpcUrl) {
            // For Validation Cloud or similar providers
            // JSON-RPC pattern: https://mainnet.hedera.validationcloud.io/v1/{apiKey}
            // Mirror node pattern: https://mainnet.hedera.validationcloud.io/v1/{apiKey}
            // (the /api/v1 suffix is added by callers)

            const networkPrefix =
                targetNetwork === 'mainnet' ? 'mainnet' : targetNetwork === 'testnet' ? 'testnet' : 'previewnet';

            if (customRpcUrl.includes(networkPrefix)) {
                // For Validation Cloud, keep the /v1/{apiKey} part as it's needed for authentication
                // Just return the URL without modification - it already has the correct format
                edwinLogger.info(`Using custom mirror node for ${targetNetwork}`);
                return customRpcUrl;
            }
        }

        // Fallback to public Hedera mirror nodes (no /api/v1 suffix)
        switch (targetNetwork) {
            case 'mainnet':
                return 'https://mainnet-public.mirrornode.hedera.com';
            case 'testnet':
                return 'https://testnet.mirrornode.hedera.com';
            case 'previewnet':
                return 'https://previewnet.mirrornode.hedera.com';
            default:
                throw new Error(`Unsupported network: ${targetNetwork}`);
        }
    }

    /**
     * Get Hedera client optimized for performance
     *
     * Performance notes:
     * - Uses gRPC to consensus nodes for HAPI operations (HTS, topics, accounts)
     * - JSON-RPC (HEDERA_RPC_URL) is for EVM operations via ethers.js
     * - Mirror Node REST API is for all read operations (already handled separately)
     * - SDK operations use short deadlines and getReceipt() for fast finality
     */
    getClient(network: string = process.env.HEDERA_NETWORK || 'mainnet'): Client {
        try {
            let client: Client;

            switch (network.toLowerCase()) {
                case 'mainnet':
                    client = Client.forMainnet();
                    break;
                case 'testnet':
                    client = Client.forTestnet();
                    break;
                case 'previewnet':
                    client = Client.forPreviewnet();
                    break;
                default:
                    throw new Error(`Unsupported network: ${network}`);
            }

            // Performance optimizations based on Hedera best practices:

            // 1. Set aggressive timeout to fail fast if nodes stall
            client.setRequestTimeout(10000); // 10 second timeout (reduced from 30s)

            // 2. Retry across nodes for transient errors (BUSY, etc.)
            client.setMaxAttempts(10); // SDK default, adequate for node failover

            // 3. Set reasonable max transaction fee
            client.setDefaultMaxTransactionFee(Hbar.fromTinybars(200000000)); // 2 HBAR

            // 4. Shorter transaction valid duration for faster failover
            // Default is 120s, consider 60s for faster tx rejection on issues
            // client.setDefaultTransactionValidDuration(60);

            // Note: Per-operation gRPC deadlines should be set on individual operations
            // using { grpcDeadline: 3000-8000 } in execute() and getReceipt() calls

            return client;
        } catch (error) {
            edwinLogger.error(`Failed to create Hedera client for network ${network}:`, error);
            throw error;
        }
    }

    /**
     * Get account balance in HBAR
     */
    async getBalance(): Promise<number> {
        return this.getBalanceOfAccount(this.getAddress());
    }

    /**
     * Get balance of any account using Mirror Node REST API
     * This avoids timeout issues with consensus nodes
     */
    async getBalanceOfAccount(accountId: string): Promise<number> {
        try {
            const network = process.env.HEDERA_NETWORK || 'mainnet';
            const mirrorNodeUrl = BaseHederaWalletClient.getMirrorNodeUrl(network);

            // Use Mirror Node REST API to get account balance
            const response = await fetch(`${mirrorNodeUrl}/api/v1/accounts/${accountId}`);

            if (!response.ok) {
                throw new Error(`Mirror node request failed: ${response.status} ${response.statusText}`);
            }

            const accountData = await response.json();

            // Extract balance from response
            if (!accountData.balance || typeof accountData.balance.balance !== 'number') {
                throw new Error(`Invalid balance response from mirror node`);
            }

            // Balance is in tinybars, convert to HBAR
            const balanceInTinybars = accountData.balance.balance;
            return balanceInTinybars / 100000000;
        } catch (error) {
            edwinLogger.error(`Failed to get balance for account ${accountId}:`, error);
            throw new Error(`Failed to get balance for account ${accountId}: ${error}`);
        }
    }

    /**
     * Get token decimals for a specific token using Mirror Node REST API
     */
    async getTokenDecimals(tokenId: string): Promise<number> {
        const network = process.env.HEDERA_NETWORK || 'mainnet';
        const mirrorNodeUrl = BaseHederaWalletClient.getMirrorNodeUrl(network);

        const response = await fetch(`${mirrorNodeUrl}/api/v1/tokens/${tokenId}`);

        if (!response.ok) {
            throw new Error(`Failed to fetch token info for ${tokenId}: ${response.status} ${response.statusText}`);
        }

        const tokenInfo = await response.json();

        if (!('decimals' in tokenInfo)) {
            throw new Error(`Token ${tokenId} does not exist on ${network} or decimals field not found`);
        }
        return tokenInfo.decimals;
    }

    /**
     * Get token balance for a specific token (returns human-readable amount)
     */
    async getTokenBalance(tokenId: string): Promise<number> {
        return this.getTokenBalanceOfAccount(this.getAddress(), tokenId);
    }

    /**
     * Get token balance for any account using Mirror Node REST API
     * This avoids timeout issues with consensus nodes
     */
    async getTokenBalanceOfAccount(accountId: string, tokenId: string): Promise<number> {
        try {
            const network = process.env.HEDERA_NETWORK || 'mainnet';
            const mirrorNodeUrl = BaseHederaWalletClient.getMirrorNodeUrl(network);

            // Use Mirror Node REST API to get account info including token balances
            const response = await fetch(`${mirrorNodeUrl}/api/v1/accounts/${accountId}`);

            if (!response.ok) {
                throw new Error(`Mirror node request failed: ${response.status} ${response.statusText}`);
            }

            const accountData = await response.json();

            // Extract token balance from response
            if (!accountData.balance || !Array.isArray(accountData.balance.tokens)) {
                return 0; // Account has no token balances
            }

            // Find the specific token in the tokens array
            const tokenBalance = accountData.balance.tokens.find(
                (t: { token_id: string; balance: number }) => t.token_id === tokenId
            );

            if (!tokenBalance) {
                return 0; // Token not found in account balances
            }

            // Get token decimals to convert to human-readable amount
            const decimals = await this.getTokenDecimals(tokenId);

            // Convert from smallest units to human-readable amount
            return tokenBalance.balance / Math.pow(10, decimals);
        } catch (error) {
            edwinLogger.error(`Failed to get token balance for account ${accountId}, token ${tokenId}:`, error);
            throw new Error(`Failed to get token balance for account ${accountId}, token ${tokenId}: ${error}`);
        }
    }

    /**
     * Get account information
     */
    async getAccountInfo(): Promise<unknown> {
        return this.getAccountInfoForAccount(this.getAddress());
    }

    /**
     * Get account information using Mirror Node REST API
     * This avoids timeout issues with consensus nodes
     */
    async getAccountInfoForAccount(accountId: string): Promise<unknown> {
        try {
            const network = process.env.HEDERA_NETWORK || 'mainnet';
            const mirrorNodeUrl = BaseHederaWalletClient.getMirrorNodeUrl(network);

            // Use Mirror Node REST API to get account info
            const response = await fetch(`${mirrorNodeUrl}/api/v1/accounts/${accountId}`);

            if (!response.ok) {
                throw new Error(`Mirror node request failed: ${response.status} ${response.statusText}`);
            }

            const accountData = await response.json();

            return {
                accountId: accountData.account,
                balance: accountData.balance.balance / 100000000, // Convert from tinybars to HBAR
                key: accountData.key?.key,
                expirationTime: accountData.expiry_timestamp,
                autoRenewPeriod: accountData.auto_renew_period,
                isDeleted: accountData.deleted,
                memo: accountData.memo,
                ethereumNonce: accountData.ethereum_nonce,
                evmAddress: accountData.evm_address,
            };
        } catch (error) {
            edwinLogger.error(`Failed to get account info for account ${accountId}:`, error);
            throw new Error(`Failed to get account info for account ${accountId}: ${error}`);
        }
    }

    // Abstract methods that must be implemented by derived classes
    abstract signTransaction(transaction: Transaction): Promise<Transaction>;
    abstract sendTransaction(transaction: Transaction): Promise<string>;
}

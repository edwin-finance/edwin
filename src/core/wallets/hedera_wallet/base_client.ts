import {
    Client,
    AccountId,
    AccountBalanceQuery,
    AccountInfoQuery,
    Transaction,
    TokenId,
    Hbar,
    TransactionRecord,
} from '@hashgraph/sdk';
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

    constructor(accountId: string | AccountId) {
        this.accountId = typeof accountId === 'string' ? AccountId.fromString(accountId) : accountId;
    }

    /**
     * Get account ID as string
     */
    getAddress(): string {
        return this.accountId.toString();
    }

    /**
     * Get Hedera client
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

            // Set default max transaction fee to 2 HBAR
            client.setDefaultMaxTransactionFee(Hbar.fromTinybars(200000000)); // 2 HBAR

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
     * Get balance of any account
     */
    async getBalanceOfAccount(accountId: string): Promise<number> {
        try {
            const client = this.getClient();
            const account = AccountId.fromString(accountId);

            const balanceQuery = new AccountBalanceQuery().setAccountId(account);

            const balance = await balanceQuery.execute(client);

            // Convert from tinybars to HBAR (1 HBAR = 100,000,000 tinybars)
            return balance.hbars.toTinybars().toNumber() / 100000000;
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
        const mirrorNodeUrl =
            network === 'mainnet'
                ? 'https://mainnet-public.mirrornode.hedera.com'
                : 'https://testnet.mirrornode.hedera.com';

        const response = await fetch(`${mirrorNodeUrl}/api/v1/tokens/${tokenId}`);
        const tokenInfo = await response.json();

        if (!('decimals' in tokenInfo)) {
            throw new Error(`Token decimals field not found for tokenId: ${tokenId}`);
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
     * Get token balance for any account (returns human-readable amount)
     */
    async getTokenBalanceOfAccount(accountId: string, tokenId: string): Promise<number> {
        try {
            const client = this.getClient();
            const account = AccountId.fromString(accountId);
            const token = TokenId.fromString(tokenId);

            const balanceQuery = new AccountBalanceQuery().setAccountId(account);

            const balance = await balanceQuery.execute(client);

            // Get token balance from the token balance map
            const tokenBalance = balance.tokens?.get(token);

            if (tokenBalance) {
                // Get the raw balance in smallest units
                const rawBalance = tokenBalance.toNumber();

                // Get token decimals to convert to human-readable amount
                const decimals = await this.getTokenDecimals(tokenId);

                // Convert from smallest units to human-readable amount
                return rawBalance / Math.pow(10, decimals);
            }

            return 0;
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
     * Get account information for any account
     */
    async getAccountInfoForAccount(accountId: string): Promise<unknown> {
        try {
            const client = this.getClient();
            const account = AccountId.fromString(accountId);

            const infoQuery = new AccountInfoQuery().setAccountId(account);

            const info = await infoQuery.execute(client);

            return {
                accountId: info.accountId.toString(),
                balance: info.balance.toTinybars().toNumber() / 100000000, // Convert to HBAR
                key: info.key?.toString(),
                expirationTime: info.expirationTime,
                autoRenewPeriod: info.autoRenewPeriod,
                isDeleted: info.isDeleted,
                memo: info.accountMemo,
                ethereumNonce: info.ethereumNonce,
            };
        } catch (error) {
            edwinLogger.error(`Failed to get account info for account ${accountId}:`, error);
            throw new Error(`Failed to get account info for account ${accountId}: ${error}`);
        }
    }

    // Abstract methods that must be implemented by derived classes
    abstract signTransaction(transaction: Transaction): Promise<Transaction>;
    abstract sendTransaction(transaction: Transaction): Promise<string>;
    abstract sendTransactionWithResponse?(
        transaction: Transaction
    ): Promise<{ transactionId: string; record: TransactionRecord }>;
}

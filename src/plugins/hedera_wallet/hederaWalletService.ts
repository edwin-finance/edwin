import { EdwinService } from '../../core/classes/edwinToolProvider';
import { HederaWalletClient } from '../../core/wallets/hedera_wallet';
import edwinLogger from '../../utils/logger';
import {
    TransferTransaction,
    AccountId,
    Hbar,
    TokenId,
    ContractExecuteTransaction,
    ContractId,
    ContractFunctionParameters,
} from '@hashgraph/sdk';
import {
    HederaWalletBalanceParameters,
    HederaWalletTokenBalanceParameters,
    HederaWalletAccountInfoParameters,
    HederaWalletTransferHbarParameters,
    HederaWalletTransferTokenParameters,
    HederaWalletTokenLookupParameters,
    HederaWalletWrapHbarParameters,
    HederaWalletUnwrapWhbarParameters,
} from './parameters';

export class HederaWalletService extends EdwinService {
    constructor(private wallet: HederaWalletClient) {
        super();
    }

    /**
     * Get HBAR balance of any Hedera account
     */
    async getHederaWalletBalance(params: HederaWalletBalanceParameters): Promise<number> {
        edwinLogger.info(`Getting HBAR balance for Hedera account: ${params.accountId}`);

        try {
            return await this.wallet.getBalanceOfAccount(params.accountId);
        } catch (error) {
            edwinLogger.error('Failed to get Hedera wallet balance:', error);
            throw error;
        }
    }

    /**
     * Get HBAR balance of the current Hedera account
     */
    async getCurrentHederaWalletBalance(): Promise<number> {
        edwinLogger.info('Getting HBAR balance for current Hedera account');

        try {
            return await this.wallet.getBalance();
        } catch (error) {
            edwinLogger.error('Failed to get current Hedera wallet balance:', error);
            throw error;
        }
    }

    /**
     * Get token balance for any Hedera account
     */
    async getHederaWalletTokenBalance(params: HederaWalletTokenBalanceParameters): Promise<number> {
        edwinLogger.info(`Getting token balance for account: ${params.accountId}, token: ${params.tokenId}`);

        try {
            // Use the base client's token balance method
            if (!this.wallet.getTokenBalanceOfAccount) {
                throw new Error('Token balance for accounts not supported by this wallet client');
            }
            return await this.wallet.getTokenBalanceOfAccount(params.accountId, params.tokenId);
        } catch (error) {
            edwinLogger.error('Failed to get Hedera wallet token balance:', error);
            throw error;
        }
    }

    /**
     * Get token balance for the current Hedera account
     */
    async getCurrentHederaWalletTokenBalance(tokenId: string): Promise<number> {
        edwinLogger.info(`Getting token balance for current account, token: ${tokenId}`);

        try {
            if (!this.wallet.getTokenBalance) {
                throw new Error('Token balance not supported by this wallet client');
            }
            return await this.wallet.getTokenBalance(tokenId);
        } catch (error) {
            edwinLogger.error('Failed to get current Hedera wallet token balance:', error);
            throw error;
        }
    }

    /**
     * Get account information for any Hedera account
     */
    async getHederaWalletAccountInfo(params: HederaWalletAccountInfoParameters): Promise<unknown> {
        edwinLogger.info(`Getting account info for Hedera account: ${params.accountId}`);

        try {
            // Use the base client's account info method
            if (!this.wallet.getAccountInfoForAccount) {
                throw new Error('Account info for accounts not supported by this wallet client');
            }
            return await this.wallet.getAccountInfoForAccount(params.accountId);
        } catch (error) {
            edwinLogger.error('Failed to get Hedera account info:', error);
            throw error;
        }
    }

    /**
     * Get account information for the current Hedera account
     */
    async getCurrentHederaWalletAccountInfo(): Promise<unknown> {
        edwinLogger.info('Getting account info for current Hedera account');

        try {
            return await this.wallet.getAccountInfo();
        } catch (error) {
            edwinLogger.error('Failed to get current Hedera account info:', error);
            throw error;
        }
    }

    /**
     * Transfer HBAR to another account
     */
    async transferHbar(params: HederaWalletTransferHbarParameters): Promise<string> {
        edwinLogger.info(`Transferring ${params.amount} HBAR to account: ${params.toAccountId}`);

        try {
            // Construct the transfer transaction
            const fromAccount = AccountId.fromString(this.wallet.getAddress());
            const toAccount = AccountId.fromString(params.toAccountId);
            const transferAmount = Hbar.fromTinybars(Math.floor(params.amount * 100000000)); // Convert HBAR to tinybars

            const transaction = new TransferTransaction()
                .addHbarTransfer(fromAccount, transferAmount.negated())
                .addHbarTransfer(toAccount, transferAmount);

            // Use the wallet's generic sendTransaction method
            return await this.wallet.sendTransaction(transaction);
        } catch (error) {
            edwinLogger.error('Failed to transfer HBAR:', error);
            throw error;
        }
    }

    /**
     * Transfer tokens to another account (amount should be in human-readable format)
     */
    async transferToken(params: HederaWalletTransferTokenParameters): Promise<string> {
        edwinLogger.info(`Transferring ${params.amount} of token ${params.tokenId} to account: ${params.toAccountId}`);

        try {
            // Get token decimals to convert human-readable amount to smallest units
            const decimals = await this.wallet.getTokenDecimals(params.tokenId);
            const amountInSmallestUnits = Math.floor(params.amount * Math.pow(10, decimals));

            edwinLogger.info(
                `Converting ${params.amount} to ${amountInSmallestUnits} smallest units (${decimals} decimals)`
            );

            // Construct the token transfer transaction
            const fromAccount = AccountId.fromString(this.wallet.getAddress());
            const toAccount = AccountId.fromString(params.toAccountId);
            const token = TokenId.fromString(params.tokenId);

            const transaction = new TransferTransaction()
                .addTokenTransfer(token, fromAccount, -amountInSmallestUnits)
                .addTokenTransfer(token, toAccount, amountInSmallestUnits);

            // Use the wallet's generic sendTransaction method
            return await this.wallet.sendTransaction(transaction);
        } catch (error) {
            edwinLogger.error('Failed to transfer token:', error);
            throw error;
        }
    }

    /**
     * Lookup token ID by name or symbol using Hedera Mirror Node API
     */
    async lookupTokenByName(params: HederaWalletTokenLookupParameters): Promise<string> {
        edwinLogger.info(`Looking up token ID for: ${params.tokenName} on ${params.network || 'mainnet'}`);

        try {
            const network = params.network || 'mainnet';
            const mirrorNodeUrl = this.getMirrorNodeUrl(network);
            const searchTerm = params.tokenName.toLowerCase();

            // Define token type for better type safety
            interface TokenInfo {
                token_id: string;
                name?: string;
                symbol?: string;
            }

            // Search through paginated results to find the token
            let nextUrl = `${mirrorNodeUrl}/api/v1/tokens?limit=100`;
            let pageCount = 0;
            const maxPages = 50; // Limit search to prevent infinite loops

            let exactSymbolMatch: TokenInfo | null = null;
            let exactNameMatch: TokenInfo | null = null;
            let partialMatch: TokenInfo | null = null;

            while (nextUrl && pageCount < maxPages) {
                edwinLogger.info(`Fetching tokens from: ${nextUrl} (page ${pageCount + 1})`);

                const response = await fetch(nextUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch tokens: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();

                if (!data.tokens || !Array.isArray(data.tokens)) {
                    throw new Error('Invalid response format from Mirror Node API');
                }

                // Search for exact symbol match (case-insensitive)
                if (!exactSymbolMatch) {
                    const match = data.tokens.find(
                        (token: TokenInfo) => token.symbol && token.symbol.toLowerCase() === searchTerm
                    );
                    if (match) {
                        exactSymbolMatch = match;
                        edwinLogger.info(
                            `Found exact symbol match: ${match.name} (${match.symbol}) with ID: ${match.token_id}`
                        );
                        // Return immediately for exact symbol matches
                        return match.token_id;
                    }
                }

                // Search for exact name match
                if (!exactNameMatch) {
                    const match = data.tokens.find(
                        (token: TokenInfo) => token.name && token.name.toLowerCase() === searchTerm
                    );
                    if (match) {
                        exactNameMatch = match;
                        edwinLogger.info(
                            `Found exact name match: ${match.name} (${match.symbol}) with ID: ${match.token_id}`
                        );
                    }
                }

                // Search for partial match (only if we don't have any match yet)
                if (!partialMatch && !exactNameMatch) {
                    const match = data.tokens.find(
                        (token: TokenInfo) =>
                            (token.name && token.name.toLowerCase().includes(searchTerm)) ||
                            (token.symbol && token.symbol.toLowerCase().includes(searchTerm))
                    );
                    if (match) {
                        partialMatch = match;
                        edwinLogger.info(
                            `Found partial match: ${match.name} (${match.symbol}) with ID: ${match.token_id}`
                        );
                    }
                }

                // Check for next page
                nextUrl = data.links?.next ? `${mirrorNodeUrl}${data.links.next}` : '';
                pageCount++;
            }

            // Return the best match found
            if (exactNameMatch) {
                return exactNameMatch.token_id;
            }
            if (partialMatch) {
                return partialMatch.token_id;
            }

            throw new Error(
                `No token found with name or symbol: ${params.tokenName}. Searched ${pageCount} pages of tokens.`
            );
        } catch (error) {
            edwinLogger.error('Failed to lookup token by name:', error);
            throw error;
        }
    }

    /**
     * Wrap HBAR to WHBAR (Wrapped HBAR ERC20 token)
     */
    async wrapHbarToWhbar(params: HederaWalletWrapHbarParameters): Promise<string> {
        const network = params.network || 'mainnet';
        edwinLogger.info(`Wrapping ${params.amount} HBAR to WHBAR on ${network}`);

        try {
            // WHBAR contract addresses
            // Note: Using 0.0.1456985 for mainnet (same as Bonzo Finance uses - verified working)
            // Testnet: 0.0.15058 (standard testnet WHBAR)
            const whbarContractId = network === 'mainnet' ? '0.0.1456985' : '0.0.15058';
            const whbarTokenId = whbarContractId; // WHBAR token ID is same as contract ID

            edwinLogger.info(`Using WHBAR contract: ${whbarContractId}`);

            // Check HBAR balance
            const balance = await this.wallet.getBalance();
            if (balance < params.amount + 0.1) {
                // Add 0.1 HBAR buffer for fees
                throw new Error(
                    `Insufficient HBAR balance: ${balance} HBAR (need ${params.amount + 0.1} HBAR including fees)`
                );
            }

            // Create contract execute transaction to call deposit() function
            // The deposit function wraps HBAR by sending it as payable amount
            const wrapTx = new ContractExecuteTransaction()
                .setContractId(ContractId.fromString(whbarContractId))
                .setGas(1000000) // Increased from 500k to handle testnet gas requirements
                .setFunction('deposit')
                .setPayableAmount(new Hbar(params.amount));

            const txId = await this.wallet.sendTransaction(wrapTx);

            edwinLogger.info(`✅ Successfully wrapped ${params.amount} HBAR to WHBAR`);
            edwinLogger.info(`Transaction ID: ${txId}`);
            edwinLogger.info(`WHBAR token ID: ${whbarTokenId}`);

            return txId;
        } catch (error) {
            edwinLogger.error('Failed to wrap HBAR to WHBAR:', error);
            throw error;
        }
    }

    /**
     * Unwrap WHBAR back to HBAR
     */
    async unwrapWhbarToHbar(params: HederaWalletUnwrapWhbarParameters): Promise<string> {
        const network = params.network || 'mainnet';
        edwinLogger.info(`Unwrapping ${params.amount} WHBAR to HBAR on ${network}`);

        try {
            // WHBAR contract addresses (matching wrap function)
            const whbarContractId = network === 'mainnet' ? '0.0.1456985' : '0.0.15058';

            edwinLogger.info(`Using WHBAR contract: ${whbarContractId}`);

            // Check WHBAR balance
            if (!this.wallet.getTokenBalance) {
                throw new Error('Token balance not supported by this wallet client');
            }

            const whbarBalance = await this.wallet.getTokenBalance(whbarContractId);
            if (whbarBalance < params.amount) {
                throw new Error(`Insufficient WHBAR balance: ${whbarBalance} WHBAR (need ${params.amount} WHBAR)`);
            }

            // Convert WHBAR amount to tinybars (8 decimals)
            // WHBAR uses 8 decimals, same as HBAR
            const amountInTinybars = Math.floor(params.amount * 100000000);

            edwinLogger.info(`Unwrapping ${params.amount} WHBAR (${amountInTinybars} tinybars)`);

            // Create contract execute transaction to call withdraw(uint256) function
            const withdrawParams = new ContractFunctionParameters().addUint256(amountInTinybars);

            const unwrapTx = new ContractExecuteTransaction()
                .setContractId(ContractId.fromString(whbarContractId))
                .setGas(1000000) // Increased from 500k to handle testnet gas requirements
                .setFunction('withdraw', withdrawParams);

            const txId = await this.wallet.sendTransaction(unwrapTx);

            edwinLogger.info(`✅ Successfully unwrapped ${params.amount} WHBAR to HBAR`);
            edwinLogger.info(`Transaction ID: ${txId}`);

            return txId;
        } catch (error) {
            edwinLogger.error('Failed to unwrap WHBAR to HBAR:', error);
            throw error;
        }
    }

    /**
     * Get the Mirror Node URL for the specified network
     * Uses custom HEDERA_RPC_URL if available (e.g., Validation Cloud mirror node)
     */
    private getMirrorNodeUrl(network: string): string {
        // Use the environment variable directly with same logic as BaseHederaWalletClient
        const customRpcUrl = process.env.HEDERA_RPC_URL;
        if (customRpcUrl) {
            const networkPrefix = network === 'mainnet' ? 'mainnet' : network === 'testnet' ? 'testnet' : 'previewnet';

            if (customRpcUrl.includes(networkPrefix)) {
                // For Validation Cloud, keep the /v1/{apiKey} part as it's needed for authentication
                edwinLogger.info(`Using custom mirror node for ${network}`);
                return customRpcUrl;
            }
        }

        // Fallback to public Hedera mirror nodes
        switch (network) {
            case 'mainnet':
                return 'https://mainnet-public.mirrornode.hedera.com';
            case 'testnet':
                return 'https://testnet.mirrornode.hedera.com';
            case 'previewnet':
                return 'https://previewnet.mirrornode.hedera.com';
            default:
                throw new Error(`Unsupported network: ${network}`);
        }
    }
}

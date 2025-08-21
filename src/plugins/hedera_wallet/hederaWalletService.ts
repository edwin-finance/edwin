import { EdwinService } from '../../core/classes/edwinToolProvider';
import { HederaWalletClient } from '../../core/wallets/hedera_wallet';
import edwinLogger from '../../utils/logger';
import { TransferTransaction, AccountId, Hbar, TokenId } from '@hashgraph/sdk';
import {
    HederaWalletBalanceParameters,
    HederaWalletTokenBalanceParameters,
    HederaWalletAccountInfoParameters,
    HederaWalletTransferHbarParameters,
    HederaWalletTransferTokenParameters,
    HederaWalletTokenLookupParameters,
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
     * Get the Mirror Node URL for the specified network
     */
    private getMirrorNodeUrl(network: string): string {
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

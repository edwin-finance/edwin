import { EdwinService } from '../../core/classes/edwinToolProvider';
import { EdwinSolanaPublicKeyWallet } from '../../core/wallets/solana_wallet';
import edwinLogger from '../../utils/logger';
import { SolanaWalletTokenBalanceParameters, SolanaWalletBalancesParameters } from './parameters';
import { Helius } from 'helius-sdk';

interface TokenInfo {
    name?: string;
    symbol?: string;
    balance?: string;
    decimals?: number;
    ui_amount?: number;
    ui_balance?: number;
}

export class SolanaWalletService extends EdwinService {
    private helius: Helius;

    constructor(private wallet: EdwinSolanaPublicKeyWallet) {
        super();
        this.helius = new Helius(process.env.HELIUS_KEY!);
    }

    /**
     * Get the balance of any Solana wallet
     */
    async getSolanaWalletTokenBalance(params: SolanaWalletTokenBalanceParameters): Promise<number> {
        edwinLogger.info(`Getting balance for Solana wallet: ${params.walletAddress}`);

        try {
            return await this.wallet.getBalanceOfWallet(params.walletAddress, params.mintAddress);
        } catch (error) {
            edwinLogger.error('Failed to get Solana wallet balance:', error);
            throw error;
        }
    }

    /**
     * Get the balance of the current Solana wallet
     */
    async getCurrentSolanaWalletTokenBalance(mintAddress?: string): Promise<number> {
        edwinLogger.info('Getting balance for current Solana wallet');

        try {
            // Use getBalanceOfWallet with current wallet address
            return await this.wallet.getBalanceOfWallet(this.wallet.getAddress(), mintAddress);
        } catch (error) {
            edwinLogger.error('Failed to get current Solana wallet balance:', error);
            throw error;
        }
    }

    /**
     * Get all token balances for a Solana wallet
     */
    async getSolanaWalletBalances(params: SolanaWalletBalancesParameters): Promise<
        Array<{
            mint: string;
            symbol: string;
            balance: number;
        }>
    > {
        edwinLogger.info(`Getting all token balances for Solana wallet: ${params.walletAddress}`);

        try {
            // Get SOL balance first
            const solBalance = await this.wallet.getBalanceOfWallet(params.walletAddress);

            // Use the Helius API to get all fungible tokens for the wallet
            const response = await this.helius.rpc.getAssetsByOwner({
                ownerAddress: params.walletAddress,
                page: 1,
                limit: 1000,
                displayOptions: {
                    showFungible: true,
                },
            });

            // Start with SOL balance
            const balances = [
                {
                    mint: 'So11111111111111111111111111111111111111112', // Native SOL mint address
                    symbol: 'SOL',
                    balance: solBalance,
                },
            ];

            // Filter for fungible tokens only and map to our desired format
            const tokenBalances = response.items
                .filter(item => item.interface === 'FungibleToken' || item.interface === 'FungibleAsset')
                .map(item => {
                    // Use type assertion to handle the token_info properties
                    const tokenInfo = (item.token_info as TokenInfo) || {};
                    return {
                        mint: item.id,
                        symbol: tokenInfo.symbol || 'UNKNOWN',
                        balance: tokenInfo.balance
                            ? Number(tokenInfo.balance) / Math.pow(10, tokenInfo.decimals || 0)
                            : tokenInfo.ui_amount || tokenInfo.ui_balance || 0,
                    };
                });

            // Combine SOL and token balances
            return [...balances, ...tokenBalances];
        } catch (error) {
            edwinLogger.error('Failed to get Solana wallet token balances:', error);
            throw error;
        }
    }

    /**
     * Get all token balances for the current Solana wallet
     */
    async getCurrentSolanaWalletBalances(): Promise<
        Array<{
            mint: string;
            symbol: string;
            balance: number;
        }>
    > {
        edwinLogger.info('Getting all token balances for current Solana wallet');

        try {
            // Use getSolanaWalletBalances with current wallet address
            return await this.getSolanaWalletBalances({ walletAddress: this.wallet.getAddress() });
        } catch (error) {
            edwinLogger.error('Failed to get current Solana wallet token balances:', error);
            throw error;
        }
    }
}

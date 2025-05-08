import { EdwinService } from '../../core/classes/edwinToolProvider';
import { EdwinSolanaPublicKeyWallet } from '../../core/wallets/solana_wallet';
import edwinLogger from '../../utils/logger';
import { SolanaBalanceParameters, SolanaWalletBalancesParameters } from './parameters';
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
    async getWalletBalance(params: SolanaBalanceParameters): Promise<number> {
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
    async getCurrentWalletBalance(mintAddress?: string): Promise<number> {
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
    async getWalletBalances(params: SolanaWalletBalancesParameters): Promise<
        Array<{
            mint: string;
            name: string;
            symbol: string;
            balance: number;
            decimals: number;
        }>
    > {
        edwinLogger.info(`Getting all token balances for Solana wallet: ${params.walletAddress}`);

        try {
            // Use the Helius API to get all fungible tokens for the wallet
            const response = await this.helius.rpc.getAssetsByOwner({
                ownerAddress: params.walletAddress,
                page: 1,
                limit: 1000,
                displayOptions: {
                    showFungible: true,
                },
            });


            // Filter for fungible tokens only and map to our desired format
            return response.items
                .filter(item => item.interface === 'FungibleToken' || item.interface === 'FungibleAsset')
                .map(item => {
                    // Use type assertion to handle the token_info properties
                    const tokenInfo = (item.token_info as TokenInfo) || {};
                    return {
                        mint: item.id,
                        name: tokenInfo.name || 'Unknown Token',
                        symbol: tokenInfo.symbol || 'UNKNOWN',
                        balance: tokenInfo.balance
                            ? Number(tokenInfo.balance) / Math.pow(10, tokenInfo.decimals || 0)
                            : tokenInfo.ui_amount || tokenInfo.ui_balance || 0,
                        decimals: tokenInfo.decimals || 0,
                    };
                });
        } catch (error) {
            edwinLogger.error('Failed to get Solana wallet token balances:', error);
            throw error;
        }
    }

    /**
     * Get all token balances for the current Solana wallet
     */
    async getCurrentWalletBalances(): Promise<
        Array<{
            mint: string;
            name: string;
            symbol: string;
            balance: number;
            decimals: number;
        }>
    > {
        edwinLogger.info('Getting all token balances for current Solana wallet');

        try {
            // Use getWalletBalances with current wallet address
            return await this.getWalletBalances({ walletAddress: this.wallet.getAddress() });
        } catch (error) {
            edwinLogger.error('Failed to get current Solana wallet token balances:', error);
            throw error;
        }
    }
}

import { EdwinService } from '../../core/classes/edwinToolProvider';
import { EdwinSolanaWallet } from '../../core/wallets';
import edwinLogger from '../../utils/logger';
import { SolanaBalanceParameters } from './parameters';

export class SolanaWalletService extends EdwinService {
    constructor(private wallet: EdwinSolanaWallet) {
        super();
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
}

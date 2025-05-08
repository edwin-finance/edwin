import { EdwinService } from '../../core/classes/edwinToolProvider';
import { EdwinEVMPublicKeyWallet } from '../../core/wallets';
import edwinLogger from '../../utils/logger';
import { EVMBalanceParameters, CurrentEVMBalanceParameters } from './parameters';
import { SupportedEVMChain } from '../../core/types';

export class EVMWalletService extends EdwinService {
    constructor(private wallet: EdwinEVMPublicKeyWallet) {
        super();
    }

    /**
     * Get the balance of any EVM wallet
     */
    async getWalletBalance(params: EVMBalanceParameters): Promise<number> {
        edwinLogger.info(`Getting balance for EVM wallet: ${params.walletAddress} on ${params.chainName}`);

        try {
            return await this.wallet.getBalanceOfWallet(
                params.walletAddress as `0x${string}`,
                params.chainName as SupportedEVMChain,
                params.tokenAddress as `0x${string}` | undefined
            );
        } catch (error) {
            edwinLogger.error('Failed to get EVM wallet balance:', error);
            throw error;
        }
    }

    /**
     * Get the balance of the current EVM wallet
     */
    async getCurrentWalletBalance(params: CurrentEVMBalanceParameters): Promise<number> {
        const chainName = params.chainName || (this.wallet.getCurrentChain().name as SupportedEVMChain);
        edwinLogger.info(`Getting balance for current EVM wallet on ${chainName}`);

        try {
            // Use getBalanceOfWallet with current wallet address
            return await this.wallet.getBalanceOfWallet(
                this.wallet.getAddress(),
                chainName as SupportedEVMChain,
                params.tokenAddress as `0x${string}` | undefined
            );
        } catch (error) {
            edwinLogger.error('Failed to get current EVM wallet balance:', error);
            throw error;
        }
    }
}

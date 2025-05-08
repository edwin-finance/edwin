import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { EVMWalletService } from './evmWalletService';
import { EdwinEVMPublicKeyWallet } from '../../core/wallets';
import {
    EVMBalanceParameters,
    EVMBalanceParametersSchema,
    CurrentEVMBalanceParameters,
    CurrentEVMBalanceParametersSchema,
} from './parameters';

export class EVMWalletPlugin extends EdwinPlugin {
    constructor(wallet: EdwinEVMPublicKeyWallet) {
        super('evm_wallet', [new EVMWalletService(wallet)]);
    }

    getTools(): Record<string, EdwinTool> {
        // Combine public and private tools
        return {
            ...this.getPublicTools(),
            ...this.getPrivateTools(),
        };
    }

    getPublicTools(): Record<string, EdwinTool> {
        const evmWalletService = this.toolProviders.find(
            provider => provider instanceof EVMWalletService
        ) as EVMWalletService;

        return {
            checkEVMWalletBalance: {
                name: 'check_evm_wallet_balance',
                description: 'Check the balance of any EVM wallet on any chain',
                schema: EVMBalanceParametersSchema.schema,
                execute: async (params: EVMBalanceParameters) => {
                    return await evmWalletService.getWalletBalance(params);
                },
            },
            checkCurrentEVMWalletBalance: {
                name: 'check_current_evm_wallet_balance',
                description: 'Check the balance of your current EVM wallet',
                schema: CurrentEVMBalanceParametersSchema.schema,
                execute: async (params: CurrentEVMBalanceParameters) => {
                    return await evmWalletService.getCurrentWalletBalance(params);
                },
            },
        };
    }

    getPrivateTools(): Record<string, EdwinTool> {
        // EVM Wallet has no private tools
        return {};
    }

    supportsChain = (chain: Chain) => chain.type !== 'solana';
}

// Factory function to create a new instance of the plugin
export const evmWallet = (wallet: EdwinEVMPublicKeyWallet) => new EVMWalletPlugin(wallet);

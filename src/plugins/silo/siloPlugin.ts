import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { SiloService } from './siloService';
import { EdwinEVMWallet } from '../../core/wallets';
import { SupplyParametersSchema, WithdrawParametersSchema, SupplyParameters, WithdrawParameters } from './parameters';

/**
 * Plugin for interacting with Silo Finance protocol
 */
export class SiloPlugin extends EdwinPlugin {
    constructor(wallet: EdwinEVMWallet) {
        super('silo', [new SiloService(wallet)]);
    }

    getTools(): Record<string, EdwinTool> {
        // Combine public and private tools
        return {
            ...this.getPublicTools(),
            ...this.getPrivateTools(),
        };
    }

    getPublicTools(): Record<string, EdwinTool> {
        // Silo has no public tools
        return {};
    }

    getPrivateTools(): Record<string, EdwinTool> {
        const siloService = this.toolProviders.find(provider => provider instanceof SiloService) as SiloService;

        return {
            siloSupply: {
                name: 'silo_supply',
                description: 'Supply assets to Silo protocol',
                schema: SupplyParametersSchema.schema,
                execute: async (params: SupplyParameters) => {
                    return await siloService.supply(params);
                },
            },
            siloWithdraw: {
                name: 'silo_withdraw',
                description: 'Withdraw assets from Silo protocol',
                schema: WithdrawParametersSchema.schema,
                execute: async (params: WithdrawParameters) => {
                    return await siloService.withdraw(params);
                },
            },
        };
    }

    supportsChain = (chain: Chain) => chain.type === 'evm';
}

export const silo = (wallet: EdwinEVMWallet) => new SiloPlugin(wallet);

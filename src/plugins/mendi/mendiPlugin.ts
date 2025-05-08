import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { MendiService } from './mendiService';
import { EdwinEVMWallet } from '../../core/wallets';
import { SupplyParametersSchema, WithdrawParametersSchema, SupplyParameters, WithdrawParameters } from './parameters';

export class MendiPlugin extends EdwinPlugin {
    constructor(wallet: EdwinEVMWallet) {
        super('mendi', [new MendiService(wallet)]);
    }

    getTools(): Record<string, EdwinTool> {
        // Combine public and private tools
        return {
            ...this.getPublicTools(),
            ...this.getPrivateTools(),
        };
    }

    getPublicTools(): Record<string, EdwinTool> {
        // Mendi has no public tools
        return {};
    }

    getPrivateTools(): Record<string, EdwinTool> {
        const mendiService = this.toolProviders.find(provider => provider instanceof MendiService) as MendiService;

        return {
            mendiSupply: {
                name: 'mendi_supply',
                description: 'Supply assets to Mendi protocol on Linea',
                schema: SupplyParametersSchema.schema,
                execute: async (params: SupplyParameters) => {
                    return await mendiService.supply(params);
                },
            },
            mendiWithdraw: {
                name: 'mendi_withdraw',
                description: 'Withdraw assets from Mendi protocol on Linea',
                schema: WithdrawParametersSchema.schema,
                execute: async (params: WithdrawParameters) => {
                    return await mendiService.withdraw(params);
                },
            },
        };
    }

    supportsChain = (chain: Chain) => chain.type === 'evm';
}

export const mendi = (wallet: EdwinEVMWallet) => new MendiPlugin(wallet);

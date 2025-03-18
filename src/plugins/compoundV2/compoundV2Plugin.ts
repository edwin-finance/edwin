import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { CompoundV2Service } from './compoundV2Service';
import { EdwinEVMWallet } from '../../core/wallets';
import { SupplyParametersSchema, WithdrawParametersSchema, SupplyParameters, WithdrawParameters } from './parameters';

export class CompoundV2Plugin extends EdwinPlugin {
    constructor(wallet: EdwinEVMWallet) {
        super('compoundV2', [new CompoundV2Service(wallet)]);
    }

    getTools(): Record<string, EdwinTool> {
        const compoundService = this.toolProviders.find(
            provider => provider instanceof CompoundV2Service
        ) as CompoundV2Service;

        return {
            compoundV2Supply: {
                name: 'compoundV2_supply',
                description: 'Supply assets to Compound V2 protocol',
                schema: SupplyParametersSchema.schema,
                execute: async (params: SupplyParameters) => {
                    return await compoundService.supply(params);
                },
            },
            compoundV2Withdraw: {
                name: 'compoundV2_withdraw',
                description: 'Withdraw assets from Compound V2 protocol',
                schema: WithdrawParametersSchema.schema,
                execute: async (params: WithdrawParameters) => {
                    return await compoundService.withdraw(params);
                },
            },
        };
    }

    supportsChain = (chain: Chain) => chain.type === 'evm';
}

export const compoundV2 = (wallet: EdwinEVMWallet) => new CompoundV2Plugin(wallet);

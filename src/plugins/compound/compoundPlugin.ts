import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { CompoundService } from './compoundService';
import { EdwinEVMWallet } from '../../core/wallets';
import { SupplyParametersSchema, WithdrawParametersSchema, SupplyParameters, WithdrawParameters } from './parameters';

export class CompoundPlugin extends EdwinPlugin {
    constructor(wallet: EdwinEVMWallet) {
        super('compound', [new CompoundService(wallet)]);
    }

    getTools(): Record<string, EdwinTool> {
        const compoundService = this.toolProviders.find(
            provider => provider instanceof CompoundService
        ) as CompoundService;

        return {
            compoundSupply: {
                name: 'compound_supply',
                description: 'Supply assets to Compound protocol',
                schema: SupplyParametersSchema.schema,
                execute: async (params: SupplyParameters) => {
                    return await compoundService.supply(params);
                },
            },
            compoundWithdraw: {
                name: 'compound_withdraw',
                description: 'Withdraw assets from Compound protocol',
                schema: WithdrawParametersSchema.schema,
                execute: async (params: WithdrawParameters) => {
                    return await compoundService.withdraw(params);
                },
            },
        };
    }

    supportsChain = (chain: Chain) => chain.type === 'evm';
}

export const compound = (wallet: EdwinEVMWallet) => new CompoundPlugin(wallet);

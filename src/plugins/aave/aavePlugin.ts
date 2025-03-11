import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { AaveService } from './aaveService';
import { EdwinEVMWallet } from '../../core/wallets';
import { SupplyParametersSchema, WithdrawParametersSchema, SupplyParameters, WithdrawParameters } from './parameters';

export class AavePlugin extends EdwinPlugin {
    constructor(wallet: EdwinEVMWallet) {
        super('aave', [new AaveService(wallet)]);
    }

    getTools(): Record<string, EdwinTool> {
        const aaveService = this.toolProviders.find(provider => provider instanceof AaveService) as AaveService;

        return {
            aaveSupply: {
                name: 'aave_supply',
                description: 'Supply assets to Aave protocol',
                schema: SupplyParametersSchema.schema,
                execute: async (params: SupplyParameters) => {
                    return await aaveService.supply(params);
                },
            },
            aaveWithdraw: {
                name: 'aave_withdraw',
                description: 'Withdraw assets from Aave protocol',
                schema: WithdrawParametersSchema.schema,
                execute: async (params: WithdrawParameters) => {
                    return await aaveService.withdraw(params);
                },
            },
        };
    }

    supportsChain = (chain: Chain) => chain.type === 'evm';
}

export const aave = (wallet: EdwinEVMWallet) => new AavePlugin(wallet);

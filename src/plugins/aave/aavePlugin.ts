import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { z } from 'zod';
import { AaveService } from './aaveService';
import { EdwinEVMWallet } from '../../core/wallets';
import { SupplyParameters, WithdrawParameters } from './parameters';

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
                schema: z.object({
                    chain: z.string().min(1).optional(),
                    asset: z.string().min(1),
                    amount: z.number().positive(),
                }),
                execute: async (params: SupplyParameters) => {
                    return await aaveService.supply(params);
                },
            },
            aaveWithdraw: {
                name: 'aave_withdraw',
                description: 'Withdraw assets from Aave protocol',
                schema: z.object({
                    chain: z.string().min(1).optional(),
                    asset: z.string().min(1),
                    amount: z.number().positive(),
                }),
                execute: async (params: WithdrawParameters) => {
                    return await aaveService.withdraw(params);
                },
            },
        };
    }

    supportsChain = (chain: Chain) => chain.type === 'evm';
}

export const aave = (wallet: EdwinEVMWallet) => new AavePlugin(wallet);

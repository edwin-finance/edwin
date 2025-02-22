import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { z } from 'zod';
import { LuloProtocol } from './luloProtocol';
import { EdwinSolanaWallet } from '../../core/wallets';
import { SupplyParameters, WithdrawParameters } from './parameters';

export class LuloPlugin extends EdwinPlugin {
    constructor(wallet: EdwinSolanaWallet) {
        super('lulo', [new LuloProtocol(wallet)]);
    }

    getTools(): Record<string, EdwinTool> {
        const luloProtocol = this.toolProviders.find(provider => provider instanceof LuloProtocol) as LuloProtocol;

        return {
            luloSupply: {
                name: 'lulo_supply',
                description: 'Supply assets to Lulo protocol',
                schema: z.object({
                    asset: z.string().min(1),
                    amount: z.number().positive(),
                }),
                execute: async (params: SupplyParameters) => {
                    return await luloProtocol.supply(params);
                },
            },
            luloWithdraw: {
                name: 'lulo_withdraw',
                description: 'Withdraw assets from Lulo protocol',
                schema: z.object({
                    asset: z.string().min(1),
                    amount: z.number().positive(),
                }),
                execute: async (params: WithdrawParameters) => {
                    return await luloProtocol.withdraw(params);
                },
            },
        };
    }

    supportsChain = (chain: Chain) => chain.type === 'solana';
}

export const lulo = (wallet: EdwinSolanaWallet) => new LuloPlugin(wallet);

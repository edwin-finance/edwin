import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { LuloProtocol } from './luloProtocol';
import { EdwinSolanaWallet } from '../../core/wallets';
import { SupplyParametersSchema, WithdrawParametersSchema, SupplyParameters, WithdrawParameters } from './parameters';

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
                schema: SupplyParametersSchema.schema,
                execute: async (params: SupplyParameters) => {
                    return await luloProtocol.supply(params);
                },
            },
            luloWithdraw: {
                name: 'lulo_withdraw',
                description: 'Withdraw assets from Lulo protocol',
                schema: WithdrawParametersSchema.schema,
                execute: async (params: WithdrawParameters) => {
                    return await luloProtocol.withdraw(params);
                },
            },
        };
    }

    supportsChain = (chain: Chain) => chain.type === 'solana';
}

export const lulo = (wallet: EdwinSolanaWallet) => new LuloPlugin(wallet);

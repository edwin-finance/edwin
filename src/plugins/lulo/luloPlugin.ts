import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { LuloProtocol } from './luloProtocol';
import { EdwinSolanaPublicKeyWallet } from '../../core/wallets/solana_wallet';
import { SupplyParametersSchema, WithdrawParametersSchema, SupplyParameters, WithdrawParameters } from './parameters';

export class LuloPlugin extends EdwinPlugin {
    constructor(wallet: EdwinSolanaPublicKeyWallet) {
        super('lulo', [new LuloProtocol(wallet)]);
    }

    getTools(): Record<string, EdwinTool> {
        // Combine public and private tools
        return {
            ...this.getPublicTools(),
            ...this.getPrivateTools(),
        };
    }

    getPublicTools(): Record<string, EdwinTool> {
        // Lulo has no public tools
        return {};
    }

    getPrivateTools(): Record<string, EdwinTool> {
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

export const lulo = (wallet: EdwinSolanaPublicKeyWallet) => new LuloPlugin(wallet);

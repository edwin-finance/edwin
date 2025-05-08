import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { MeteoraProtocol } from './meteoraProtocol';
import { EdwinSolanaPublicKeyWallet } from '../../core/wallets/solana_wallet';
import {
    // Import schemas with Schema suffix
    AddLiquidityParametersSchema,
    RemoveLiquidityParametersSchema,
    PoolParametersSchema,
    GetPoolsParametersSchema,
    // Import types with clean names
    AddLiquidityParameters,
    RemoveLiquidityParameters,
    PoolParameters,
    GetPoolsParameters,
} from './parameters';

export class MeteoraPlugin extends EdwinPlugin {
    constructor(wallet: EdwinSolanaPublicKeyWallet) {
        super('meteora', [new MeteoraProtocol(wallet)]);
    }

    getTools(): Record<string, EdwinTool> {
        // Combine public and private tools
        return {
            ...this.getPublicTools(),
            ...this.getPrivateTools(),
        };
    }

    getPublicTools(): Record<string, EdwinTool> {
        const meteoraProtocol = this.toolProviders.find(
            provider => provider instanceof MeteoraProtocol
        ) as MeteoraProtocol;

        return {
            meteoraGetPools: {
                name: 'meteora_get_pools',
                description: 'Get all pools on a Solana chain',
                schema: GetPoolsParametersSchema.schema,
                execute: async (params: GetPoolsParameters) => {
                    return await meteoraProtocol.getPools(params);
                },
            },
        };
    }

    getPrivateTools(): Record<string, EdwinTool> {
        const meteoraProtocol = this.toolProviders.find(
            provider => provider instanceof MeteoraProtocol
        ) as MeteoraProtocol;

        return {
            meteoraAddLiquidity: {
                name: 'meteora_add_liquidity',
                description: 'Add liquidity to a Meteora pool',
                schema: AddLiquidityParametersSchema.schema,
                execute: async (params: AddLiquidityParameters) => {
                    return await meteoraProtocol.addLiquidity(params);
                },
            },
            meteoraRemoveLiquidity: {
                name: 'meteora_remove_liquidity',
                description: 'Remove liquidity from a Meteora pool',
                schema: RemoveLiquidityParametersSchema.schema,
                execute: async (params: RemoveLiquidityParameters) => {
                    return await meteoraProtocol.removeLiquidity(params);
                },
            },
            meteoraClaimFees: {
                name: 'meteora_claim_fees',
                description: 'Claim fees from a Meteora pool',
                schema: PoolParametersSchema.schema,
                execute: async (params: PoolParameters) => {
                    return await meteoraProtocol.claimFees(params);
                },
            },
        };
    }

    supportsChain = (chain: Chain) => chain.type === 'solana';
}

export const meteora = (wallet: EdwinSolanaPublicKeyWallet) => new MeteoraPlugin(wallet);

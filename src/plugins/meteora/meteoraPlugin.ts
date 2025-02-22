import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { z } from 'zod';
import { MeteoraProtocol } from './meteoraProtocol';
import { EdwinSolanaWallet } from '../../core/wallets';
import { AddLiquidityParameters, RemoveLiquidityParameters, PoolParameters, GetPoolsParameters } from './parameters';

export class MeteoraPlugin extends EdwinPlugin {
    constructor(wallet: EdwinSolanaWallet) {
        super('meteora', [new MeteoraProtocol(wallet)]);
    }

    getTools(): Record<string, EdwinTool> {
        const meteoraProtocol = this.toolProviders.find(
            provider => provider instanceof MeteoraProtocol
        ) as MeteoraProtocol;

        return {
            meteoraAddLiquidity: {
                name: 'meteora_add_liquidity',
                description: 'Add liquidity to a Meteora pool',
                schema: z.object({
                    amount: z.number().positive(),
                    amountB: z.number().positive(),
                    poolAddress: z.string().min(1),
                }),
                execute: async (params: AddLiquidityParameters) => {
                    return await meteoraProtocol.addLiquidity(params);
                },
            },
            meteoraRemoveLiquidity: {
                name: 'meteora_remove_liquidity',
                description: 'Remove liquidity from a Meteora pool',
                schema: z.object({
                    poolAddress: z.string().min(1),
                    positionAddress: z.string().optional(),
                    shouldClosePosition: z.boolean().optional(),
                }),
                execute: async (params: RemoveLiquidityParameters) => {
                    return await meteoraProtocol.removeLiquidity(params);
                },
            },
            meteoraClaimFees: {
                name: 'meteora_claim_fees',
                description: 'Claim fees from a Meteora pool',
                schema: z.object({
                    chain: z.string().min(1),
                    poolAddress: z.string().min(1),
                }),
                execute: async (params: PoolParameters) => {
                    return await meteoraProtocol.claimFees(params);
                },
            },
            meteoraGetPools: {
                name: 'meteora_get_pools',
                description: 'Get all pools on a Solana chain',
                schema: z.object({
                    chain: z.string().min(1),
                }),
                execute: async (params: GetPoolsParameters) => {
                    return await meteoraProtocol.getPools(params);
                },
            },
        };
    }

    supportsChain = (chain: Chain) => chain.type === 'solana';
}

export const meteora = (wallet: EdwinSolanaWallet) => new MeteoraPlugin(wallet);

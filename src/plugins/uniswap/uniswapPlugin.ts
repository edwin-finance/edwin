import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { z } from 'zod';
import { UniswapProtocol } from './uniswapProtocol';
import { EdwinEVMWallet } from '../../core/wallets';
import { LiquidityParameters } from './parameters';

export class UniswapPlugin extends EdwinPlugin {
    constructor(wallet: EdwinEVMWallet) {
        super('uniswap', [new UniswapProtocol(wallet)]);
    }

    getTools(): Record<string, EdwinTool> {
        const uniswapProtocol = this.toolProviders.find(
            provider => provider instanceof UniswapProtocol
        ) as UniswapProtocol;

        return {
            uniswapSwap: {
                name: 'uniswap_swap',
                description: 'Swap tokens on Uniswap',
                schema: z.object({
                    chain: z.string().min(1),
                    asset: z.string().min(1),
                    amount: z.number().positive(),
                    assetB: z.string().min(1),
                    amountB: z.number().positive(),
                }),
                execute: async (params: LiquidityParameters) => {
                    return await uniswapProtocol.swap(params);
                },
            },
            uniswapAddLiquidity: {
                name: 'uniswap_add_liquidity',
                description: 'Add liquidity to Uniswap pool',
                schema: z.object({
                    chain: z.string().min(1),
                    asset: z.string().min(1),
                    amount: z.number().positive(),
                    assetB: z.string().min(1),
                    amountB: z.number().positive(),
                }),
                execute: async (params: LiquidityParameters) => {
                    return await uniswapProtocol.addLiquidity(params);
                },
            },
            uniswapRemoveLiquidity: {
                name: 'uniswap_remove_liquidity',
                description: 'Remove liquidity from Uniswap pool',
                schema: z.object({
                    chain: z.string().min(1),
                    asset: z.string().min(1),
                    amount: z.number().positive(),
                    assetB: z.string().min(1),
                    amountB: z.number().positive(),
                }),
                execute: async (params: LiquidityParameters) => {
                    return await uniswapProtocol.removeLiquidity(params);
                },
            },
        };
    }

    supportsChain = (chain: Chain) => chain.type === 'evm';
}

export const uniswap = (wallet: EdwinEVMWallet) => new UniswapPlugin(wallet);

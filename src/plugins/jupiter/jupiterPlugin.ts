import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { JupiterService } from './jupiterService';
import { SolanaWalletClient } from '../../core/wallets/solana_wallet';
import { SwapParametersSchema, SwapParameters, GetTokenAddressSchema, GetTokenAddressParameters } from './parameters';

export class JupiterPlugin extends EdwinPlugin {
    constructor(wallet: SolanaWalletClient) {
        super('jupiter', [new JupiterService(wallet)]);
    }

    getTools(): Record<string, EdwinTool> {
        // Combine public and private tools
        return {
            ...this.getPublicTools(),
            ...this.getPrivateTools(),
        };
    }

    getPublicTools(): Record<string, EdwinTool> {
        const jupiterService = this.toolProviders.find(
            provider => provider instanceof JupiterService
        ) as JupiterService;

        return {
            jupiterGetTokenAddress: {
                name: 'jupiter_get_token_address',
                description: "Get a token's mint address / contract address (CA) from a ticker name",
                schema: GetTokenAddressSchema.schema,
                execute: async (params: GetTokenAddressParameters) => {
                    return await jupiterService.getTokenAddressFromTicker(params.ticker);
                },
            },
        };
    }

    getPrivateTools(): Record<string, EdwinTool> {
        const jupiterService = this.toolProviders.find(
            provider => provider instanceof JupiterService
        ) as JupiterService;

        return {
            jupiterSwap: {
                name: 'jupiter_swap',
                description: 'Swap tokens using Jupiter aggregator',
                schema: SwapParametersSchema.schema,
                execute: async (params: SwapParameters) => {
                    return await jupiterService.swap(params);
                },
            },
            jupiterTrade: {
                name: 'jupiter_trade',
                description: 'Trade tokens using Jupiter aggregator',
                schema: SwapParametersSchema.schema,
                execute: async (params: SwapParameters) => {
                    return await jupiterService.swap(params);
                },
            },
            jupiterConvert: {
                name: 'jupiter_convert',
                description: 'Convert tokens using Jupiter aggregator',
                schema: SwapParametersSchema.schema,
                execute: async (params: SwapParameters) => {
                    return await jupiterService.swap(params);
                },
            },
        };
    }

    supportsChain = (chain: Chain) => chain.type === 'solana';
}

export const jupiter = (wallet: SolanaWalletClient) => new JupiterPlugin(wallet);

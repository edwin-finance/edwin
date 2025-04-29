import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { JupiterService } from './jupiterService';
import { EdwinSolanaPublicKeyWallet } from '../../core/wallets/solana_wallet';
import { SwapParametersSchema, SwapParameters, GetTokenAddressSchema, GetTokenAddressParameters } from './parameters';

export class JupiterPlugin extends EdwinPlugin {
    constructor(wallet: EdwinSolanaPublicKeyWallet) {
        super('jupiter', [new JupiterService(wallet)]);
    }

    getTools(): Record<string, EdwinTool> {
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

    supportsChain = (chain: Chain) => chain.type === 'solana';
}

export const jupiter = (wallet: EdwinSolanaPublicKeyWallet) => new JupiterPlugin(wallet);

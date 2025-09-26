import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { SaucerSwapService } from './saucerSwapService';
import { HederaWalletClient, canSign } from '../../core/wallets/hedera_wallet';
import {
    SaucerSwapQuoteParametersSchema,
    SaucerSwapQuoteExactOutputParametersSchema,
    SaucerSwapExactInputParametersSchema,
    SaucerSwapExactOutputParametersSchema,
    SaucerSwapQuoteParameters,
    SaucerSwapQuoteExactOutputParameters,
    SaucerSwapExactInputParameters,
    SaucerSwapExactOutputParameters,
} from './parameters';

export class SaucerSwapPlugin extends EdwinPlugin {
    constructor(private wallet: HederaWalletClient) {
        super('saucerswap', [new SaucerSwapService(wallet)]);
    }

    getTools(): Record<string, EdwinTool> {
        return {
            ...this.getPublicTools(),
            ...this.getPrivateTools(),
        };
    }

    getPublicTools(): Record<string, EdwinTool> {
        const saucerSwapService = this.toolProviders.find(
            provider => provider instanceof SaucerSwapService
        ) as SaucerSwapService;

        return {
            saucerSwapQuote: {
                name: 'saucerswap_get_quote',
                description: 'Get a quote for exact input swap on SaucerSwap DEX',
                schema: SaucerSwapQuoteParametersSchema.schema,
                execute: async (params: SaucerSwapQuoteParameters) => {
                    return await saucerSwapService.getQuote(params);
                },
            },
            saucerSwapQuoteExactOutput: {
                name: 'saucerswap_get_quote_exact_output',
                description: 'Get a quote for exact output swap on SaucerSwap DEX',
                schema: SaucerSwapQuoteExactOutputParametersSchema.schema,
                execute: async (params: SaucerSwapQuoteExactOutputParameters) => {
                    return await saucerSwapService.getQuoteExactOutput(params);
                },
            },
        };
    }

    getPrivateTools(): Record<string, EdwinTool> {
        if (!canSign(this.wallet)) {
            return {};
        }

        const saucerSwapService = this.toolProviders.find(
            provider => provider instanceof SaucerSwapService
        ) as SaucerSwapService;

        return {
            saucerSwapExactInput: {
                name: 'saucerswap_swap_exact_input',
                description: 'Swap an exact amount of input tokens for output tokens on SaucerSwap',
                schema: SaucerSwapExactInputParametersSchema.schema,
                execute: async (params: SaucerSwapExactInputParameters) => {
                    return await saucerSwapService.swapExactInput(params);
                },
            },
            saucerSwapExactOutput: {
                name: 'saucerswap_swap_exact_output',
                description: 'Swap input tokens for an exact amount of output tokens on SaucerSwap',
                schema: SaucerSwapExactOutputParametersSchema.schema,
                execute: async (params: SaucerSwapExactOutputParameters) => {
                    return await saucerSwapService.swapExactOutput(params);
                },
            },
        };
    }

    supportsChain = (chain: Chain) => chain.type === 'hedera';
}

export const saucerSwap = (wallet: HederaWalletClient) => new SaucerSwapPlugin(wallet);

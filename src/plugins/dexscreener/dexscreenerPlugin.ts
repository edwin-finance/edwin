import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { DexScreenerService } from './dexscreenerService';
import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';
import {
    SearchParametersSchema,
    PairParametersSchema,
    TokenPairsParametersSchema,
    TokensParametersSchema,
    TokenOrdersParametersSchema,
    SearchParameters,
    PairParameters,
    TokenPairsParameters,
    TokensParameters,
    TokenOrdersParameters,
} from './parameters';

// Create an empty schema for endpoints without parameters
const EmptyParametersSchema = createParameterSchema(z.object({}));
type EmptyParameters = typeof EmptyParametersSchema.type;

export class DexScreenerPlugin extends EdwinPlugin {
    constructor() {
        super('dexscreener', [new DexScreenerService()]);
    }

    getTools(): Record<string, EdwinTool> {
        const dexscreenerService = this.toolProviders.find(
            provider => provider instanceof DexScreenerService
        ) as DexScreenerService;

        return {
            dexscreenerSearchPairs: {
                name: 'dexscreener_search_pairs',
                description: 'Search for pairs matching query on DexScreener',
                schema: SearchParametersSchema.schema,
                execute: async (params: SearchParameters) => {
                    return await dexscreenerService.searchPairs(params);
                },
            },
            dexscreenerGetPair: {
                name: 'dexscreener_get_pair',
                description: 'Get one or multiple pairs by chain and pair address on DexScreener',
                schema: PairParametersSchema.schema,
                execute: async (params: PairParameters) => {
                    return await dexscreenerService.getPair(params);
                },
            },
            dexscreenerGetTokenPairs: {
                name: 'dexscreener_get_token_pairs',
                description: 'Get the pools of a given token address on DexScreener',
                schema: TokenPairsParametersSchema.schema,
                execute: async (params: TokenPairsParameters) => {
                    return await dexscreenerService.getTokenPairs(params);
                },
            },
            dexscreenerGetTokens: {
                name: 'dexscreener_get_tokens',
                description: 'Get one or multiple pairs by token address on DexScreener',
                schema: TokensParametersSchema.schema,
                execute: async (params: TokensParameters) => {
                    return await dexscreenerService.getTokens(params);
                },
            },
            dexscreenerGetLatestTokenProfiles: {
                name: 'dexscreener_get_latest_token_profiles',
                description: 'Get the latest token profiles on DexScreener',
                schema: EmptyParametersSchema.schema,
                execute: async (_params: EmptyParameters) => {
                    return await dexscreenerService.getLatestTokenProfiles();
                },
            },
            dexscreenerGetLatestBoostedTokens: {
                name: 'dexscreener_get_latest_boosted_tokens',
                description: 'Get the latest boosted tokens on DexScreener',
                schema: EmptyParametersSchema.schema,
                execute: async (_params: EmptyParameters) => {
                    return await dexscreenerService.getLatestBoostedTokens();
                },
            },
            dexscreenerGetTopBoostedTokens: {
                name: 'dexscreener_get_top_boosted_tokens',
                description: 'Get the tokens with most active boosts on DexScreener',
                schema: EmptyParametersSchema.schema,
                execute: async (_params: EmptyParameters) => {
                    return await dexscreenerService.getTopBoostedTokens();
                },
            },
            dexscreenerGetTokenOrders: {
                name: 'dexscreener_get_token_orders',
                description: 'Check orders paid for a token on DexScreener',
                schema: TokenOrdersParametersSchema.schema,
                execute: async (params: TokenOrdersParameters) => {
                    return await dexscreenerService.getTokenOrders(params.chainId, params.tokenAddress);
                },
            },
        };
    }

    supportsChain = (_chain: Chain) => true; // DexScreener API is chain-agnostic
}

export const dexscreener = () => new DexScreenerPlugin();

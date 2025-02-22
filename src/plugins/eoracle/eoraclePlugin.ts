import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { z } from 'zod';
import { EOracleClient } from './eoracleService';
import { PriceParameters } from './parameters';

export class EOraclePlugin extends EdwinPlugin {
    constructor(apiKey: string) {
        super('eoracle', [new EOracleClient(apiKey)]);
    }

    getTools(): Record<string, EdwinTool> {
        const eoracleClient = this.toolProviders.find(
            provider => provider instanceof EOracleClient
        ) as EOracleClient;

        return {
            eoracleGetPrice: {
                name: 'eoracle_get_price',
                description: 'Get price information for a given symbol',
                schema: z.object({
                    symbol: z.string().min(1),
                }),
                execute: async (params: PriceParameters) => {
                    return await eoracleClient.getPrice(params.symbol);
                },
            },
        };
    }

    supportsChain = (chain: Chain) => chain.type === 'evm';
}

export const eoracle = (apiKey: string) => new EOraclePlugin(apiKey);

import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { z } from 'zod';
import { CookieSwarmClient } from './cookieClient';
import { AgentParameters, SearchParameters } from './parameters';

export class CookiePlugin extends EdwinPlugin {
    constructor(apiKey: string) {
        super('cookie', [new CookieSwarmClient(apiKey)]);
    }

    getTools(): Record<string, EdwinTool> {
        const cookieClient = this.toolProviders.find(
            provider => provider instanceof CookieSwarmClient
        ) as CookieSwarmClient;

        return {
            cookieGetAgent: {
                name: 'cookie_get_agent',
                description: 'Get agent information by Twitter username or contract address',
                schema: z.object({
                    username: z.string().optional(),
                    contractAddress: z.string().optional(),
                    interval: z.enum(['_3Days', '_7Days']),
                }),
                execute: async (params: AgentParameters) => {
                    if (params.username) {
                        return await cookieClient.getAgentByTwitter(params);
                    }
                    return await cookieClient.getAgentByContract(params);
                },
            },
            cookieSearchTweets: {
                name: 'cookie_search_tweets',
                description: 'Search tweets within a date range',
                schema: z.object({
                    query: z.string(),
                    from: z.string(),
                    to: z.string(),
                }),
                execute: async (params: SearchParameters) => {
                    return await cookieClient.searchTweets(params);
                },
            },
        };
    }

    supportsChain = (_: Chain) => true;
}

export const cookie = (apiKey: string) => new CookiePlugin(apiKey);

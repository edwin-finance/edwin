import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { CookieSwarmClient } from './cookieClient';
import { AgentParametersSchema, SearchParametersSchema, AgentParameters, SearchParameters } from './parameters';

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
                schema: AgentParametersSchema.schema,
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
                schema: SearchParametersSchema.schema,
                execute: async (params: SearchParameters) => {
                    return await cookieClient.searchTweets(params);
                },
            },
        };
    }

    supportsChain = (_: Chain) => true;
}

export const cookie = (apiKey: string) => new CookiePlugin(apiKey);

import { SupportedChain } from '../../core/types';
import edwinLogger from '../../utils/logger';
import { AgentParameters } from './parameters';

interface AgentResponse {
    ok: {
        agentName: string;
        contracts: {
            chain: number;
            contractAddress: string;
        }[];
        twitterUsernames: string[];
        mindshare: number;
        mindshareDeltaPercent: number;
        marketCap: number;
        marketCapDeltaPercent: number;
        price: number;
        priceDeltaPercent: number;
        liquidity: number;
        volume24Hours: number;
        volume24HoursDeltaPercent: number;
        holdersCount: number;
        holdersCountDeltaPercent: number;
        averageImpressionsCount: number;
        averageImpressionsCountDeltaPercent: number;
        averageEngagementsCount: number;
        averageEngagementsCountDeltaPercent: number;
        followersCount: number;
        smartFollowersCount: number;
        topTweets: {
            tweetUrl: string;
            tweetAuthorProfileImageUrl: string;
            tweetAuthorDisplayName: string;
            smartEngagementPoints: number;
            impressionsCount: number;
        }[];
    };
    success: boolean;
    error: string | null;
}

interface GetAgentsPagedResponse {
    ok: {
        data: AgentResponse['ok'][];
        currentPage: number;
        totalPages: number;
        totalCount: number;
    };
    success: boolean;
    error: string | null;
}

export class CookieSwarmClient {
    private apiKey: string;
    private baseUrl: string;
    supportedChains: SupportedChain[] = ['base'];

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.cookie.fun';
    }

    private async fetch<T>(endpoint: string): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            headers: {
                'x-api-key': this.apiKey,
            },
            method: 'GET',
        });

        if (!response.ok) {
            edwinLogger.error('API Error:', {
                status: response.status,
                statusText: response.statusText,
                url: response.url,
            });
            throw new Error(`API request failed: ${response.statusText}`);
        }

        return response.json();
    }

    async getAgentByTwitter(params: AgentParameters): Promise<string> {
        // Verify interval is valid
        if (!['_3Days', '_7Days'].includes(params.interval)) {
            throw new Error('Invalid interval');
        }
        // Note the trailing slash after username
        const response = await this.fetch<AgentResponse>(
            `/v2/agents/twitterUsername/${params.username}/?interval=${params.interval}`
        );
        return JSON.stringify(response);
    }

    async getAgentByContract(params: AgentParameters): Promise<string> {
        // Verify interval is valid and cast to Interval
        if (!['_3Days', '_7Days'].includes(params.interval)) {
            throw new Error('Invalid interval');
        }
        const response = await this.fetch<AgentResponse>(
            `/v2/agents/contractAddress/${params.contractAddress}?interval=${params.interval}`
        );
        return JSON.stringify(response);
    }

    async getAgentsPaged(params: AgentParameters): Promise<string> {
        // Verify interval is valid and cast to Interval
        if (!['_3Days', '_7Days'].includes(params.interval)) {
            throw new Error('Invalid interval');
        }
        if (params.pageSize && (params.pageSize < 1 || params.pageSize > 25)) {
            throw new Error('Page size must be between 1 and 25');
        }
        const response = await this.fetch<GetAgentsPagedResponse>(
            `/v2/agents/agentsPaged?interval=${params.interval}&page=${params.page}&pageSize=${params.pageSize}`
        );
        return JSON.stringify(response);
    }
}

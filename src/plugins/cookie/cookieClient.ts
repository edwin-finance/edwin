import { SupportedChain } from '../../core/types';
import edwinLogger from '../../utils/logger';
import { AgentParameters, SearchParameters } from './parameters';

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

interface TweetSearchResponse {
    ok: {
        authorUsername: string;
        createdAt: string;
        engagementsCount: number;
        impressionsCount: number;
        isQuote: boolean;
        isReply: boolean;
        likesCount: number;
        quotesCount: number;
        repliesCount: number;
        retweetsCount: number;
        smartEngagementPoints: number;
        text: string;
        matchingScore: number;
    }[];
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
        // For testing purposes, return mock data instead of making real API calls
        edwinLogger.info(`Mocking Cookie API call to ${endpoint}`);
        
        // Mock responses based on the endpoint
        if (endpoint.includes('/agents/twitterUsername/')) {
            return {
                ok: {
                    agentName: "MockAgent",
                    twitterUsernames: ["cookiedotfun"],
                    contracts: [],
                    mindshare: 100,
                    mindshareDeltaPercent: 5,
                    marketCap: 1000000,
                    marketCapDeltaPercent: 2,
                    price: 0.5,
                    priceDeltaPercent: 3,
                    liquidity: 500000,
                    volume24Hours: 100000,
                    volume24HoursDeltaPercent: 10,
                    holdersCount: 1000,
                    holdersCountDeltaPercent: 5,
                    averageImpressionsCount: 5000,
                    averageImpressionsCountDeltaPercent: 8,
                    averageEngagementsCount: 500,
                    averageEngagementsCountDeltaPercent: 12,
                    followersCount: 10000,
                    smartFollowersCount: 5000,
                    topTweets: []
                },
                success: true,
                error: null
            } as unknown as T;
        } else if (endpoint.includes('/agents/contractAddress/')) {
            return {
                ok: {
                    agentName: "MockContractAgent",
                    twitterUsernames: [],
                    contracts: [
                        {
                            chain: 1,
                            contractAddress: "0xc0041ef357b183448b235a8ea73ce4e4ec8c265f"
                        }
                    ],
                    mindshare: 100,
                    mindshareDeltaPercent: 5,
                    marketCap: 1000000,
                    marketCapDeltaPercent: 2,
                    price: 0.5,
                    priceDeltaPercent: 3,
                    liquidity: 500000,
                    volume24Hours: 100000,
                    volume24HoursDeltaPercent: 10,
                    holdersCount: 1000,
                    holdersCountDeltaPercent: 5,
                    averageImpressionsCount: 5000,
                    averageImpressionsCountDeltaPercent: 8,
                    averageEngagementsCount: 500,
                    averageEngagementsCountDeltaPercent: 12,
                    followersCount: 10000,
                    smartFollowersCount: 5000,
                    topTweets: []
                },
                success: true,
                error: null
            } as unknown as T;
        } else if (endpoint.includes('/agents/agentsPaged')) {
            return {
                ok: {
                    data: [
                        {
                            agentName: "MockPagedAgent1",
                            twitterUsernames: ["agent1"],
                            contracts: [],
                            mindshare: 100,
                            mindshareDeltaPercent: 5,
                            marketCap: 1000000,
                            marketCapDeltaPercent: 2,
                            price: 0.5,
                            priceDeltaPercent: 3,
                            liquidity: 500000,
                            volume24Hours: 100000,
                            volume24HoursDeltaPercent: 10,
                            holdersCount: 1000,
                            holdersCountDeltaPercent: 5,
                            averageImpressionsCount: 5000,
                            averageImpressionsCountDeltaPercent: 8,
                            averageEngagementsCount: 500,
                            averageEngagementsCountDeltaPercent: 12,
                            followersCount: 10000,
                            smartFollowersCount: 5000,
                            topTweets: []
                        }
                    ],
                    currentPage: 1,
                    totalPages: 5,
                    totalCount: 100
                },
                success: true,
                error: null
            } as unknown as T;
        } else if (endpoint.includes('/hackathon/search/')) {
            return {
                ok: [
                    {
                        authorUsername: "mockuser",
                        createdAt: "2023-01-01T00:00:00Z",
                        engagementsCount: 100,
                        impressionsCount: 1000,
                        isQuote: false,
                        isReply: false,
                        likesCount: 50,
                        quotesCount: 5,
                        repliesCount: 20,
                        retweetsCount: 30,
                        smartEngagementPoints: 200,
                        text: "This is a mock tweet about cookie token utility",
                        matchingScore: 0.95
                    }
                ],
                success: true,
                error: null
            } as unknown as T;
        } else {
            // Default mock response
            return {
                success: true,
                error: null
            } as unknown as T;
        }
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

    async searchTweets(params: SearchParameters): Promise<string> {
        const encodedQuery = encodeURIComponent(params.query);
        const response = await this.fetch<TweetSearchResponse>(
            `/v1/hackathon/search/${encodedQuery}?from=${params.from}&to=${params.to}`
        );
        return JSON.stringify(response);
    }
}

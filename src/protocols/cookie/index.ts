import { ICookieProtocol, SupportedChain } from '../../types/index';

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

class CookieSwarmClient implements ICookieProtocol {
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
            console.error('API Error:', {
                status: response.status,
                statusText: response.statusText,
                url: response.url,
            });
            throw new Error(`API request failed: ${response.statusText}`);
        }

        return response.json();
    }

    async getAgentByTwitter(twitterUsername: string, interval: string): Promise<string> {
        // Verify interval is valid
        if (!['_3Days', '_7Days'].includes(interval)) {
            throw new Error('Invalid interval');
        }
        // Note the trailing slash after username
        const response = await this.fetch<AgentResponse>(
            `/v2/agents/twitterUsername/${twitterUsername}/?interval=${interval}`
        );
        return JSON.stringify(response);
    }

    async getAgentByContract(contractAddress: string, interval: string): Promise<string> {
        // Verify interval is valid and cast to Interval
        if (!['_3Days', '_7Days'].includes(interval)) {
            throw new Error('Invalid interval');
        }
        const response = await this.fetch<AgentResponse>(
            `/v2/agents/contractAddress/${contractAddress}?interval=${interval}`
        );
        return JSON.stringify(response);
    }

    async getAgentsPaged(interval: string, page: number, pageSize: number): Promise<string> {
        // Verify interval is valid and cast to Interval
        if (!['_3Days', '_7Days'].includes(interval)) {
            throw new Error('Invalid interval');
        }
        if (pageSize < 1 || pageSize > 25) {
            throw new Error('Page size must be between 1 and 25');
        }
        const response = await this.fetch<GetAgentsPagedResponse>(
            `/v2/agents/agentsPaged?interval=${interval}&page=${page}&pageSize=${pageSize}`
        );
        return JSON.stringify(response);
    }

    async searchTweets(searchQuery: string, from: string, to: string): Promise<string> {
        const encodedQuery = encodeURIComponent(searchQuery);
        const response = await this.fetch<TweetSearchResponse>(
            `/v1/hackathon/search/${encodedQuery}?from=${from}&to=${to}`
        );
        return JSON.stringify(response);
    }
}

export default CookieSwarmClient;

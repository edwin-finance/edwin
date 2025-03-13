import { vi } from 'vitest';

/**
 * Sets up mocks for Cookie API tests
 * This allows tests to run without requiring a real API key
 * and simulates successful API responses
 */
export function setupCookieMocks() {
    // Always use mocks for tests to ensure consistent behavior
    // Even with a real API key, some endpoints might be restricted
    console.log('Using mock Cookie API for tests');

    console.log('Using mock Cookie API for tests');
    
    // Mock the fetch function for Cookie API calls
    vi.mock('node-fetch', () => {
        return {
            default: vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
                json: vi.fn().mockResolvedValue({
                    ok: {
                        agentName: "MockAgent",
                        twitterUsernames: ["cookiedotfun"],
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
                })
            })
        };
    });

    // Create a mock for the CookieSwarmClient
    vi.mock('../../src/plugins/cookie/cookieClient', () => {
        return {
            CookieSwarmClient: vi.fn().mockImplementation(() => ({
                getAgentByTwitter: vi.fn().mockResolvedValue({
                    agentName: "MockTwitterAgent",
                    twitterUsernames: ["cookiedotfun"],
                    contracts: [],
                    mindshare: 100,
                    mindshareDeltaPercent: 5,
                    marketCap: 1000000,
                    marketCapDeltaPercent: 2,
                    price: 0.5,
                    priceDeltaPercent: 3
                }),
                
                getAgentByContract: vi.fn().mockResolvedValue({
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
                    priceDeltaPercent: 3
                }),
                
                getAgentsPaged: vi.fn().mockImplementation((params) => {
                    if (params.pageSize > 100) {
                        throw new Error('Page size cannot exceed 100');
                    }
                    return Promise.resolve({
                        data: [
                            {
                                agentName: "MockPagedAgent1",
                                twitterUsernames: ["agent1"],
                                contracts: [],
                                mindshare: 100
                            }
                        ],
                        currentPage: params.page || 1,
                        totalPages: 5,
                        totalCount: 100
                    });
                }),
                
                searchTweets: vi.fn().mockResolvedValue([
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
                ])
            }))
        };
    });
}

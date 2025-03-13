import { vi } from 'vitest';

/**
 * Sets up mocks for Cookie API tests
 * This allows tests to run without requiring a real API key
 * and simulates successful API responses
 */
export function setupCookieMocks() {
    // Mock node-fetch for Cookie API calls
    vi.mock('node-fetch', () => {
        return {
            default: vi.fn().mockImplementation((url, options) => {
                // Check if this is a search tweets request
                if (url.toString().includes('/v1/hackathon/search/')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        json: () => Promise.resolve({
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
                        })
                    });
                }
                
                // Check if this is a paged agents request
                if (url.toString().includes('/v2/agents/agentsPaged')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        json: () => Promise.resolve({
                            ok: {
                                data: Array.from({ length: 10 }, (_, i) => ({
                                    agentName: `MockPagedAgent${i+1}`,
                                    twitterUsernames: [`agent${i+1}`],
                                    contracts: [],
                                    mindshare: 100,
                                    mindshareDeltaPercent: 5,
                                    marketCap: 1000000,
                                    marketCapDeltaPercent: 2,
                                    price: 0.5,
                                    priceDeltaPercent: 3
                                })),
                                currentPage: 1,
                                totalPages: 5,
                                totalCount: 100
                            },
                            success: true,
                            error: null
                        })
                    });
                }
                
                // Default response for other API calls
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    json: () => Promise.resolve({
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
                });
            })
        };
    });

    // Create a mock for the CookieSwarmClient class
    vi.mock('../../src/plugins/cookie/cookieClient', () => {
        // Create mock implementations for each method
        return {
            CookieSwarmClient: vi.fn().mockImplementation(() => ({
                getAgentByTwitter: vi.fn().mockResolvedValue(JSON.stringify({
                    ok: {
                        agentName: "MockTwitterAgent",
                        twitterUsernames: ["cookiedotfun"],
                        contracts: [],
                        mindshare: 100,
                        mindshareDeltaPercent: 5,
                        marketCap: 1000000,
                        marketCapDeltaPercent: 2,
                        price: 0.5,
                        priceDeltaPercent: 3
                    },
                    success: true,
                    error: null
                })),
                
                getAgentByContract: vi.fn().mockResolvedValue(JSON.stringify({
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
                        priceDeltaPercent: 3
                    },
                    success: true,
                    error: null
                })),
                
                getAgentsPaged: vi.fn().mockImplementation((params) => {
                    if (params.pageSize > 25) {
                        throw new Error('Page size must be between 1 and 25');
                    }
                    return Promise.resolve(JSON.stringify({
                        ok: {
                            data: Array.from({ length: params.pageSize || 10 }, (_, i) => ({
                                agentName: `MockPagedAgent${i+1}`,
                                twitterUsernames: [`agent${i+1}`],
                                contracts: [],
                                mindshare: 100,
                                mindshareDeltaPercent: 5,
                                marketCap: 1000000,
                                marketCapDeltaPercent: 2,
                                price: 0.5,
                                priceDeltaPercent: 3
                            })),
                            currentPage: params.page || 1,
                            totalPages: 5,
                            totalCount: 100
                        },
                        success: true,
                        error: null
                    }));
                }),
                
                searchTweets: vi.fn().mockImplementation(() => {
                    return Promise.resolve(JSON.stringify({
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
                    }));
                })
            }))
        };
    });
}

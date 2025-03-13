import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest';
import dotenv from 'dotenv';
import { CookieSwarmClient } from '../src/plugins/cookie/cookieClient';
import { setupCookieMocks } from './setup/cookie.setup';
// Load environment variables
dotenv.config();

// Set up mocks for Cookie API tests
setupCookieMocks();

// Use a mock API key for testing
const API_KEY = process.env.COOKIE_API_KEY || 'test_api_key_for_cookie_swarm';

// Mock the fetch global function for all tests
const originalFetch = global.fetch;
global.fetch = vi.fn().mockImplementation((url, options) => {
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
    
    // Check if this is a Twitter username request
    if (url.toString().includes('/v2/agents/twitterUsername/')) {
        return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: () => Promise.resolve({
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
            })
        });
    }
    
    // Check if this is a contract address request
    if (url.toString().includes('/v2/agents/contractAddress/')) {
        return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: () => Promise.resolve({
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
                success: true,
                error: null
            }
        })
    });
});

// Restore original fetch after tests
afterAll(() => {
    global.fetch = originalFetch;
});

describe('CookieSwarm Integration', () => {
    let cookieSwarmClient: CookieSwarmClient;

    beforeEach(() => {
        // Initialize Edwin with cookie actions and API key
        cookieSwarmClient = new CookieSwarmClient(API_KEY);
    });

    describe('GetAgentByTwitterAction', () => {
        it('should fetch agent data by Twitter username', async () => {
            const result = await cookieSwarmClient.getAgentByTwitter({
                username: 'cookiedotfun',
                interval: '_3Days',
            });

            const parsed = JSON.parse(result);
            expect(parsed.ok.agentName).toBeDefined();
            expect(parsed.ok.twitterUsernames).toContain('cookiedotfun');
        });
    });

    describe('GetAgentByContractAction', () => {
        it('should fetch agent data by contract address', async () => {
            const result = await cookieSwarmClient.getAgentByContract({
                contractAddress: '0xc0041ef357b183448b235a8ea73ce4e4ec8c265f',
                interval: '_7Days',
            });

            const parsed = JSON.parse(result);
            expect(parsed.ok.agentName).toBeDefined();
            expect(parsed.ok.contracts).toContainEqual(
                expect.objectContaining({
                    contractAddress: '0xc0041ef357b183448b235a8ea73ce4e4ec8c265f',
                })
            );
        });
    });

    describe('GetAgentsPagedAction', () => {
        it('should fetch paged agent data', async () => {
            const result = await cookieSwarmClient.getAgentsPaged({
                interval: '_3Days',
                page: 1,
                pageSize: 20,
            });

            const parsed = JSON.parse(result);
            expect(parsed.ok.data).toBeDefined();
            expect(parsed.ok.data.length).toBeLessThanOrEqual(20);
            expect(parsed.ok.currentPage).toBe(1);
        });

        it('should throw error for invalid page size', async () => {
            await expect(
                cookieSwarmClient.getAgentsPaged({
                    interval: '_3Days',
                    page: 1,
                    pageSize: 30, // > 25
                })
            ).rejects.toThrow();
        });
    });

    describe('SearchTweetsAction', () => {
        it('should search tweets with date range', async () => {
            const today = new Date();
            const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

            const result = await cookieSwarmClient.searchTweets({
                query: 'cookie token utility',
                from: lastWeek.toISOString().split('T')[0],
                to: today.toISOString().split('T')[0],
            });

            const parsed = JSON.parse(result);
            expect(parsed.ok).toBeDefined();
            expect(Array.isArray(parsed.ok)).toBe(true);
        });
    });
});

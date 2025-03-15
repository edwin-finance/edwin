import { describe, it, expect, beforeEach } from 'vitest';
import dotenv from 'dotenv';
import { CookieSwarmClient } from '../src/plugins/cookie/cookieClient';
// Load environment variables
dotenv.config();

// Check if API key is available
const hasApiKey = Boolean(process.env.COOKIE_API_KEY);

// Conditionally run tests based on API key availability
const conditionalTest = hasApiKey ? it : it.skip;

describe('CookieSwarm Integration', () => {
    let cookieSwarmClient: CookieSwarmClient;

    beforeEach(() => {
        // Only initialize if API key is available
        if (hasApiKey) {
            // Initialize Edwin with cookie actions and API key
            cookieSwarmClient = new CookieSwarmClient(process.env.COOKIE_API_KEY!);
        }
    });

    describe('GetAgentByTwitterAction', () => {
        conditionalTest('should fetch agent data by Twitter username', async () => {
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
        conditionalTest('should fetch agent data by contract address', async () => {
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
        conditionalTest('should fetch paged agent data', async () => {
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

        conditionalTest('should throw error for invalid page size', async () => {
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
        conditionalTest('should search tweets with date range', async () => {
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

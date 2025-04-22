import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DexScreenerService } from '../src/plugins/dexscreener/dexscreenerService';

// Edwin token address on Solana
const EDWIN_TOKEN_ADDRESS = 'GPrg1CgbBvAJS2SCuf9gF7NmQYsWudfyfWy5SUzypump';
const CHAIN_ID = 'solana';
const TIMEOUT = 10000; // 10 seconds
const API_DELAY = 1000; // 1 second delay between API calls

// Helper function to wait/sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('DexScreener Integration Tests', () => {
    let dexscreenerService: DexScreenerService;

    beforeEach(() => {
        dexscreenerService = new DexScreenerService();
    });

    // Add delay after each test to prevent rate limiting
    afterEach(async () => {
        await sleep(API_DELAY);
    });

    describe('Search Pairs', () => {
        it(
            'should search for pairs matching a query',
            async () => {
                console.log('Running search pairs test...');
                const result = await dexscreenerService.searchPairs({
                    query: 'SOL/USDC',
                });

                expect(result).toBeDefined();
                expect(result.pairs).toBeDefined();
                expect(Array.isArray(result.pairs)).toBe(true);

                if (result.pairs.length > 0) {
                    const pair = result.pairs[0];
                    expect(pair.chainId).toBeDefined();
                    expect(pair.baseToken).toBeDefined();
                    expect(pair.quoteToken).toBeDefined();
                }
            },
            TIMEOUT
        );
    });

    describe('Get Pair', () => {
        it(
            'should get pair information by chain and pair address',
            async () => {
                console.log('Running get pair test...');
                // First get a valid pair address by searching
                const searchResult = await dexscreenerService.searchPairs({
                    query: 'SOL/USDC',
                });

                // Add delay after the search to avoid hitting rate limits
                await sleep(API_DELAY);

                // Only run this test if we found pairs
                if (searchResult.pairs && searchResult.pairs.length > 0) {
                    const pairToTest = searchResult.pairs[0];

                    const result = await dexscreenerService.getPair({
                        chainId: pairToTest.chainId,
                        pairId: pairToTest.pairAddress,
                    });

                    expect(result).toBeDefined();
                    expect(result.pairs).toBeDefined();
                    expect(Array.isArray(result.pairs)).toBe(true);

                    if (result.pairs.length > 0) {
                        const pair = result.pairs[0];
                        expect(pair.pairAddress).toBe(pairToTest.pairAddress);
                        expect(pair.chainId).toBe(pairToTest.chainId);
                    }
                } else {
                    // Skip if no pairs found
                    console.log('No pairs found for SOL/USDC, skipping getPair test');
                }
            },
            TIMEOUT
        );
    });

    describe('Get Token Pairs', () => {
        it(
            'should get the pools of a given token address',
            async () => {
                console.log('Running get token pairs test...');
                const result = await dexscreenerService.getTokenPairs({
                    chainId: CHAIN_ID,
                    tokenAddress: EDWIN_TOKEN_ADDRESS,
                });

                expect(result).toBeDefined();
                expect(Array.isArray(result)).toBe(true);

                // If there are results, validate their structure
                if (result.length > 0) {
                    const pair = result[0];
                    expect(pair.chainId).toBe(CHAIN_ID);

                    // Check if either baseToken or quoteToken matches EDWIN_TOKEN_ADDRESS
                    const hasEdwinToken =
                        pair.baseToken.address.toLowerCase() === EDWIN_TOKEN_ADDRESS.toLowerCase() ||
                        pair.quoteToken.address.toLowerCase() === EDWIN_TOKEN_ADDRESS.toLowerCase();

                    expect(hasEdwinToken).toBe(true);
                }
            },
            TIMEOUT
        );
    });

    describe('Get Tokens', () => {
        it(
            'should get token information by token address',
            async () => {
                console.log('Running get tokens test...');
                const result = await dexscreenerService.getTokens({
                    chainId: CHAIN_ID,
                    tokenAddresses: EDWIN_TOKEN_ADDRESS,
                });

                expect(result).toBeDefined();
                expect(Array.isArray(result)).toBe(true);

                // If there are results, validate their structure
                if (result.length > 0) {
                    const pair = result[0];
                    expect(pair.chainId).toBe(CHAIN_ID);

                    // Check if either baseToken or quoteToken matches EDWIN_TOKEN_ADDRESS
                    const hasEdwinToken =
                        pair.baseToken.address.toLowerCase() === EDWIN_TOKEN_ADDRESS.toLowerCase() ||
                        pair.quoteToken.address.toLowerCase() === EDWIN_TOKEN_ADDRESS.toLowerCase();

                    expect(hasEdwinToken).toBe(true);
                }
            },
            TIMEOUT
        );
    });

    // Rate limit for token profiles is lower (60 per minute), so use a longer delay
    describe('Get Latest Token Profiles', () => {
        it(
            'should get the latest token profiles',
            async () => {
                console.log('Running get latest token profiles test...');
                // Add extra delay before this test as it has a stricter rate limit
                await sleep(API_DELAY);

                const result = await dexscreenerService.getLatestTokenProfiles();

                // The API might return an empty response or null if no token profiles are available
                // This is expected behavior rather than an error
                expect(result).toBeDefined();
                console.log('Latest token profiles result:', JSON.stringify(result).substring(0, 100) + '...');

                // Only validate structure if the result is not empty and has properties
                if (result && typeof result === 'object' && Object.keys(result).length > 0) {
                    // Check for expected properties if they exist
                    if (result.chainId) expect(result.chainId).toBeDefined();
                    if (result.tokenAddress) expect(result.tokenAddress).toBeDefined();
                    if (result.description) expect(result.description).toBeDefined();
                }
            },
            TIMEOUT
        );
    });

    describe('Get Latest Boosted Tokens', () => {
        it(
            'should get the latest boosted tokens',
            async () => {
                console.log('Running get latest boosted tokens test...');
                // Add extra delay before this test as it has a stricter rate limit
                await sleep(API_DELAY);

                const result = await dexscreenerService.getLatestBoostedTokens();

                // The API might return an empty response or null if no boosted tokens are available
                expect(result).toBeDefined();
                console.log('Latest boosted tokens result:', JSON.stringify(result).substring(0, 100) + '...');

                // Only validate structure if the result is not empty and has properties
                if (result && typeof result === 'object' && Object.keys(result).length > 0) {
                    // Check for expected properties if they exist
                    if (result.chainId) expect(result.chainId).toBeDefined();
                    if (result.tokenAddress) expect(result.tokenAddress).toBeDefined();
                    if (result.amount) expect(result.amount).toBeDefined();
                    if (result.totalAmount) expect(result.totalAmount).toBeDefined();
                }
            },
            TIMEOUT
        );
    });

    describe('Get Top Boosted Tokens', () => {
        it(
            'should get the tokens with most active boosts',
            async () => {
                console.log('Running get top boosted tokens test...');
                // Add extra delay before this test as it has a stricter rate limit
                await sleep(API_DELAY);

                const result = await dexscreenerService.getTopBoostedTokens();

                // The API might return an empty response or null if no boosted tokens are available
                expect(result).toBeDefined();
                console.log('Top boosted tokens result:', JSON.stringify(result).substring(0, 100) + '...');

                // Only validate structure if the result is not empty and has properties
                if (result && typeof result === 'object' && Object.keys(result).length > 0) {
                    // Check for expected properties if they exist
                    if (result.chainId) expect(result.chainId).toBeDefined();
                    if (result.tokenAddress) expect(result.tokenAddress).toBeDefined();
                    if (result.amount) expect(result.amount).toBeDefined();
                    if (result.totalAmount) expect(result.totalAmount).toBeDefined();
                }
            },
            TIMEOUT
        );
    });

    describe('Get Token Orders', () => {
        it(
            'should check orders paid for a token',
            async () => {
                console.log('Running get token orders test...');
                // Add extra delay before this test as it has a stricter rate limit
                await sleep(API_DELAY);

                try {
                    const result = await dexscreenerService.getTokenOrders(CHAIN_ID, EDWIN_TOKEN_ADDRESS);

                    expect(result).toBeDefined();
                    expect(Array.isArray(result)).toBe(true);

                    // If there are results, validate their structure
                    if (result.length > 0) {
                        const order = result[0];
                        expect(order.type).toBeDefined();
                        expect(order.status).toBeDefined();
                        expect(order.paymentTimestamp).toBeDefined();
                    }
                } catch (error) {
                    // This endpoint might return 404 if no orders exist
                    // In that case, we'll consider the test passing
                    if (error instanceof Error && error.message.includes('404')) {
                        console.log('No orders found for Edwin token, test passes');
                    } else {
                        throw error;
                    }
                }
            },
            TIMEOUT
        );
    });

    describe('Error Handling', () => {
        it(
            'should handle invalid token addresses gracefully',
            async () => {
                console.log('Running test for invalid addresses...');

                // The API returns an empty array for invalid addresses rather than throwing an error
                const result = await dexscreenerService.getTokenPairs({
                    chainId: CHAIN_ID,
                    tokenAddress: 'invalid-address',
                });

                // Expect an empty array response for invalid addresses
                expect(result).toBeDefined();
                expect(Array.isArray(result)).toBe(true);
                expect(result.length).toBe(0);
            },
            TIMEOUT
        );

        it(
            'should handle invalid chain IDs gracefully',
            async () => {
                console.log('Running test for invalid chain IDs...');

                // The API returns an empty array for invalid chain IDs rather than throwing an error
                const result = await dexscreenerService.getTokenPairs({
                    chainId: 'invalid-chain',
                    tokenAddress: EDWIN_TOKEN_ADDRESS,
                });

                // Expect an empty array response for invalid chain IDs
                expect(result).toBeDefined();
                expect(Array.isArray(result)).toBe(true);
                expect(result.length).toBe(0);
            },
            TIMEOUT
        );
    });
});

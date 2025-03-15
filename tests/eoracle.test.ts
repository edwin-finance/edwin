import { describe, expect, it, beforeEach, vi } from 'vitest';
import edwinLogger from '../src/utils/logger';
import dotenv from 'dotenv';
import { EOracleService } from '../src';

dotenv.config();

const createMockResponse = (data: any) =>
    new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });

// Check if environment variables are set
const hasRequiredEnvVars = Boolean(process.env.EORACLE_API_URL && process.env.EORACLE_API_KEY);

// Conditionally run tests based on environment variables
const conditionalTest = hasRequiredEnvVars ? it : it.skip;

describe('EOracleSystem Integration', () => {
    let eoracle: EOracleService;

    const mockFeeds = {
        success: true,
        data: [
            { feed_id: '1', description: 'BTC/USD' },
            { feed_id: '2', description: 'ETH/USD' },
        ],
    };

    const mockPrice = {
        success: true,
        data: {
            feed_id: '1',
            rate: '100000.00',
            timestamp: 1678901234,
        },
    };

    beforeEach(() => {
        // Only create the EOracleService with actual env vars if they exist
        if (hasRequiredEnvVars) {
            eoracle = new EOracleService(process.env.EORACLE_API_KEY!);
        }

        vi.spyOn(global, 'fetch').mockImplementation(vi.fn());
    });

    describe('GetPrice', () => {
        conditionalTest('should fetch price for a valid symbol', async () => {
            vi.mocked(fetch)
                .mockResolvedValueOnce(createMockResponse(mockFeeds))
                .mockResolvedValueOnce(createMockResponse(mockPrice));

            const result = await eoracle.getPrice('BTC/USD');

            const parsed = JSON.parse(result);
            expect(parsed).toEqual({
                symbol: 'BTC/USD',
                price: '100000.00',
                timestamp: 1678901234,
            });

            expect(fetch).toHaveBeenCalledTimes(2);
            expect(fetch).toHaveBeenCalledWith(
                process.env.EORACLE_API_URL + '/feeds',
                expect.objectContaining({
                    headers: {
                        'X-API-Key': process.env.EORACLE_API_KEY,
                        'Content-Type': 'application/json',
                    },
                })
            );
        }, 30000);

        conditionalTest('should use cached feed ID for subsequent requests', async () => {
            vi.mocked(fetch)
                .mockResolvedValueOnce(createMockResponse(mockFeeds))
                .mockResolvedValueOnce(createMockResponse(mockPrice))
                .mockResolvedValueOnce(createMockResponse(mockPrice));

            await eoracle.getPrice('BTC/USD');

            await eoracle.getPrice('BTC/USD');

            expect(fetch).toHaveBeenCalledTimes(3);
        }, 30000);
    });

    describe('Error Handling', () => {
        conditionalTest('should handle unknown symbol error', async () => {
            vi.mocked(fetch).mockResolvedValueOnce(createMockResponse(mockFeeds));

            await expect(eoracle.getPrice('UNKNOWN/USD')).rejects.toThrow('No feed found for symbol: UNKNOWN/USD');
        });

        conditionalTest('should handle API errors', async () => {
            vi.mocked(fetch).mockResolvedValueOnce(
                new Response(JSON.stringify({ ok: false, status: 401, statusText: 'Unauthorized' }), {
                    status: 401,
                    statusText: 'Unauthorized',
                })
            );

            const loggerSpy = vi.spyOn(edwinLogger, 'error');

            await expect(eoracle.getPrice('BTC/USD')).rejects.toThrow('EOracleAPI request failed: Unauthorized');

            expect(loggerSpy).toHaveBeenCalledWith(
                'EOracleAPI Error:',
                expect.objectContaining({
                    status: 401,
                    statusText: 'Unauthorized',
                })
            );
        });

        conditionalTest('should handle invalid API response format', async () => {
            vi.mocked(fetch)
                .mockResolvedValueOnce(createMockResponse(mockFeeds))
                .mockResolvedValueOnce(
                    createMockResponse({
                        success: false,
                    })
                );

            await expect(eoracle.getPrice('BTC/USD')).rejects.toThrow('Failed to get price for BTC/USD');
        });

        conditionalTest('should handle network errors', async () => {
            vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

            const loggerSpy = vi.spyOn(edwinLogger, 'error');

            await expect(eoracle.getPrice('BTC/USD')).rejects.toThrow();

            expect(loggerSpy).toHaveBeenCalledWith('Error fetching price:', expect.any(Error));
        });
    });
});

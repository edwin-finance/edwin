import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Edwin } from '../src';
import edwinLogger from '../src/utils/logger';
import dotenv from 'dotenv';

dotenv.config();

const createMockResponse = (data: any) => new Response(
    JSON.stringify(data),
    {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    }
);

describe('EOracleSystem Integration', () => {
    let edwin: Edwin;
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
        process.env.EORACLE_API_URL = 'https://api.eoracle.test';
        process.env.EORACLE_API_KEY = 'test-api-key';

        edwin = new Edwin({
            actions: ['getPrice'],
        });

        vi.spyOn(global, 'fetch').mockImplementation(vi.fn());
    });

    describe('GetPrice', () => {
        it('should fetch price for a valid symbol', async () => {
            vi.mocked(fetch)
                .mockResolvedValueOnce(createMockResponse(mockFeeds))
                .mockResolvedValueOnce(createMockResponse(mockPrice));

            const result = await edwin.actions.getPrice.execute({
                symbol: 'BTC/USD',
            });

            const parsed = JSON.parse(result);
            expect(parsed).toEqual({
                symbol: 'BTC/USD',
                price: '100000.00',
                timestamp: 1678901234,
            });

            expect(fetch).toHaveBeenCalledTimes(2);
            expect(fetch).toHaveBeenCalledWith(
                'https://api.eoracle.test/feeds',
                expect.objectContaining({
                    headers: {
                        'X-API-Key': 'test-api-key',
                        'Content-Type': 'application/json',
                    },
                })
            );
        }, 30000);

        it('should use cached feed ID for subsequent requests', async () => {
            vi.mocked(fetch)
                .mockResolvedValueOnce(createMockResponse(mockFeeds))
                .mockResolvedValueOnce(createMockResponse(mockPrice))
                .mockResolvedValueOnce(createMockResponse(mockPrice));

            await edwin.actions.getPrice.execute({
                symbol: 'BTC/USD',
            });

            await edwin.actions.getPrice.execute({
                symbol: 'BTC/USD',
            });

            expect(fetch).toHaveBeenCalledTimes(3);
        }, 30000);
    });

    describe('Error Handling', () => {
        it('should handle unknown symbol error', async () => {
            vi.mocked(fetch).mockResolvedValueOnce(createMockResponse(mockFeeds));

            await expect(
                edwin.actions.getPrice.execute({
                    symbol: 'UNKNOWN/USD',
                })
            ).rejects.toThrow('No feed found for symbol: UNKNOWN/USD');
        });

        it('should handle API errors', async () => {
            vi.mocked(fetch).mockResolvedValueOnce(new Response(
                JSON.stringify({ ok: false, status: 401, statusText: 'Unauthorized' }),
                { status: 401, statusText: 'Unauthorized' }
            ));

            const loggerSpy = vi.spyOn(edwinLogger, 'error');

            await expect(
                edwin.actions.getPrice.execute({
                    symbol: 'BTC/USD',
                })
            ).rejects.toThrow('EOracleAPI request failed: Unauthorized');

            expect(loggerSpy).toHaveBeenCalledWith(
                'EOracleAPI Error:',
                expect.objectContaining({
                    status: 401,
                    statusText: 'Unauthorized',
                })
            );
        });

        it('should handle invalid API response format', async () => {
            vi.mocked(fetch)
                .mockResolvedValueOnce(createMockResponse(mockFeeds))
                .mockResolvedValueOnce(createMockResponse({
                    success: false,
                }));

            await expect(
                edwin.actions.getPrice.execute({
                    symbol: 'BTC/USD',
                })
            ).rejects.toThrow('Failed to get price for BTC/USD');
        });

        it('should handle network errors', async () => {
            vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

            const loggerSpy = vi.spyOn(edwinLogger, 'error');

            await expect(
                edwin.actions.getPrice.execute({
                    symbol: 'BTC/USD',
                })
            ).rejects.toThrow();

            expect(loggerSpy).toHaveBeenCalledWith(
                'Error fetching price:',
                expect.any(Error)
            );
        });
    });
}); 
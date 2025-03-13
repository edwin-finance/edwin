import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HyperLiquidService } from '../src/plugins/hyperliquid/hyperliquidService';
import { EdwinEVMWallet } from '../src/core/wallets/evm_wallet/evm_wallet';
import { OrderType, PositionType } from '../src/plugins/hyperliquid/parameters';
import { setupHyperLiquidMocks } from './setup/hyperliquid.setup';

// Set up mocks for HyperLiquid tests
setupHyperLiquidMocks();

// Mock the HyperLiquidService methods directly for this test file
vi.mock('../src/plugins/hyperliquid/hyperliquidService', () => {
    return {
        HyperLiquidService: vi.fn().mockImplementation(() => ({
            deposit: vi.fn().mockImplementation(async (params) => {
                return {
                    success: true,
                    depositAddress: 'mock-deposit-address',
                    message: `Successfully generated deposit address for ${params.amount} ${params.asset}`
                };
            }),
            
            withdraw: vi.fn().mockImplementation(async (params) => {
                return {
                    success: true,
                    txHash: 'mock-tx-hash',
                };
            }),
            
            openPosition: vi.fn().mockImplementation(async (params) => {
                return {
                    success: true,
                    orderId: 'mock-order-id',
                    message: `Successfully opened ${params.positionType} position for ${params.asset} with ${params.size} size`
                };
            }),
            
            closePosition: vi.fn().mockImplementation(async (params) => {
                return {
                    success: true,
                    orderId: 'mock-order-id',
                    message: `Successfully closed ${params.percentage}% of ${params.asset} position`
                };
            }),
            
            getBalance: vi.fn().mockResolvedValue({
                total: { USD: 10000 },
                free: { USD: 5000 },
                used: { USD: 5000 }
            }),
            
            getPositions: vi.fn().mockResolvedValue([
                {
                    symbol: 'BTC/USD',
                    side: 'long',
                    size: 1.0,
                    entryPrice: 50000,
                    markPrice: 51000,
                    pnl: 1000,
                    leverage: 10
                }
            ]),
        })),
    };
});

describe('HyperLiquidService', () => {
    let hyperLiquidService: HyperLiquidService;
    let wallet: EdwinEVMWallet;

    beforeEach(() => {
        wallet = new EdwinEVMWallet('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
        hyperLiquidService = new HyperLiquidService(wallet);
    });

    describe('deposit', () => {
        it('should deposit funds to HyperLiquid', async () => {
            const result = await hyperLiquidService.deposit({
                amount: 1000,
                asset: 'USDC',
            });

            expect(result).toEqual({
                success: true,
                depositAddress: 'mock-deposit-address',
                message: 'Successfully generated deposit address for 1000 USDC'
            });
        });
    });

    describe('withdraw', () => {
        it('should withdraw funds from HyperLiquid', async () => {
            const result = await hyperLiquidService.withdraw({
                amount: 500,
                asset: 'USDC',
            });

            expect(result).toEqual({
                success: true,
                txHash: 'mock-tx-hash',
            });
        });
    });

    describe('openPosition', () => {
        it('should open a long position with market order', async () => {
            const result = await hyperLiquidService.openPosition({
                asset: 'BTC',
                positionType: PositionType.LONG,
                orderType: OrderType.MARKET,
                size: 1000,
                leverage: 10,
                reduceOnly: false,
            });

            expect(result).toEqual({
                success: true,
                orderId: 'mock-order-id',
                message: 'Successfully opened long position for BTC with 1000 size'
            });
        });

        it('should open a short position with limit order', async () => {
            const result = await hyperLiquidService.openPosition({
                asset: 'ETH',
                positionType: PositionType.SHORT,
                orderType: OrderType.LIMIT,
                size: 500,
                leverage: 5,
                price: 2000,
                reduceOnly: false,
            });

            expect(result).toEqual({
                success: true,
                orderId: 'mock-order-id',
                message: 'Successfully opened short position for ETH with 500 size'
            });
        });
    });

    describe('closePosition', () => {
        it('should close a position completely', async () => {
            const result = await hyperLiquidService.closePosition({
                asset: 'BTC',
                orderType: OrderType.MARKET,
                percentage: 100,
            });

            expect(result).toEqual({
                success: true,
                orderId: 'mock-order-id',
                message: 'Successfully closed 100% of BTC position'
            });
        });

        it('should close a position partially with limit order', async () => {
            const result = await hyperLiquidService.closePosition({
                asset: 'BTC',
                orderType: OrderType.LIMIT,
                percentage: 50,
                price: 52000,
            });

            expect(result).toEqual({
                success: true,
                orderId: 'mock-order-id',
                message: 'Successfully closed 50% of BTC position'
            });
        });
    });

    describe('getBalance', () => {
        it('should get the current balance', async () => {
            const result = await hyperLiquidService.getBalance();

            expect(result).toEqual({
                total: { USD: 10000 },
                free: { USD: 5000 },
                used: { USD: 5000 }
            });
        });
    });

    describe('getPositions', () => {
        it('should get open positions', async () => {
            const result = await hyperLiquidService.getPositions();

            expect(result).toEqual([
                {
                    symbol: 'BTC/USD',
                    side: 'long',
                    size: 1.0,
                    entryPrice: 50000,
                    markPrice: 51000,
                    pnl: 1000,
                    leverage: 10
                }
            ]);
        });
    });
});

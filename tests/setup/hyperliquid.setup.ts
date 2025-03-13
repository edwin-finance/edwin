import { vi } from 'vitest';

/**
 * Sets up mocks for HyperLiquid tests
 * This allows tests to run without actual blockchain interactions
 */
export function setupHyperLiquidMocks() {
    // Mock the CCXT library for HyperLiquid tests
    vi.mock('ccxt', () => {
        return {
            hyperliquid: vi.fn().mockImplementation(() => {
                const mockExchange = {
                    fetchBalance: vi.fn().mockImplementation(async (params = {}) => {
                        // Ensure params has a user field
                        const updatedParams = { ...params, user: '0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a' };
                        
                        return {
                            total: { USD: 10000 },
                            free: { USD: 5000 },
                            used: { USD: 5000 },
                            info: {
                                balances: [
                                    { asset: 'USD', free: '5000', locked: '5000' }
                                ]
                            }
                        };
                    }),
                    fetchPositions: vi.fn().mockImplementation(async (symbols = [], params = {}) => {
                        // Ensure params has a user field
                        const updatedParams = { ...params, user: '0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a' };
                        
                        return [
                            {
                                info: { symbol: 'BTC', side: 'long' },
                                symbol: 'BTC/USD',
                                timestamp: Date.now(),
                                datetime: new Date().toISOString(),
                                lastUpdateTimestamp: Date.now(),
                                coin: 'BTC',
                                side: 'long',
                                contracts: 1.0,
                                contractSize: 1.0,
                                unrealizedPnl: 1000,
                                leverage: 10,
                                liquidationPrice: 45000,
                                collateral: 5000,
                                notional: 50000,
                                markPrice: 51000,
                                entryPrice: 50000,
                                percentage: 2.0,
                                marginMode: 'cross',
                                marginRatio: 0.1,
                                status: 'open',
                                size: 1.0,
                                pnl: 1000,
                                margin: 5000,
                            },
                        ];
                    }),
                    fetchDepositAddress: vi.fn().mockImplementation(async (code, params = {}) => {
                        // Mock implementation that doesn't throw NotSupported error
                        return {
                            currency: code,
                            address: 'mock-deposit-address',
                            tag: null,
                            network: 'arbitrum',
                            info: { address: 'mock-deposit-address', network: 'arbitrum' }
                        };
                    }),
                    options: {
                        defaultType: 'swap',
                    },
                    has: {
                        fetchPositions: true,
                        fetchBalance: true,
                        fetchDepositAddress: true,
                    },
                    handlePublicAddress: vi.fn().mockImplementation((params = {}) => {
                        // This function is called by fetchPositions and fetchBalance
                        // Return the params with a user field to avoid the error
                        return { ...params, user: '0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a' };
                    }),
                };
                
                // Add properties required by the HyperLiquidService
                // @ts-ignore - Adding wallet property needed by the service
                mockExchange.wallet = { address: '0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a' };
                
                return mockExchange;
            }),
        };
    });

    // Mock the HyperLiquid SDK
    vi.mock('hyperliquid', () => {
        return {
            Hyperliquid: vi.fn().mockImplementation(() => ({
                exchange: {
                    getAssetIndex: vi.fn().mockImplementation((asset) => {
                        // Return a valid index for any asset to avoid "Unknown asset" errors
                        const assetMap = {
                            'BTC': 0,
                            'ETH': 1,
                            'SOL': 2,
                            'AVAX': 3,
                        };
                        // Always return a valid index (0 if not found)
                        return assetMap[asset] !== undefined ? assetMap[asset] : 0;
                    }),
                    updateLeverage: vi.fn().mockResolvedValue({
                        success: true,
                    }),
                    placeOrder: vi.fn().mockResolvedValue({
                        id: 'mock-order-id',
                        status: 'filled',
                    }),
                    initiateWithdrawal: vi.fn().mockResolvedValue({
                        success: true,
                        txHash: 'mock-tx-hash',
                    }),
                },
            })),
            OrderType: {
                LIMIT: 'limit',
                MARKET: 'market',
            },
        };
    });

    // Mock the viem library for wallet interactions
    vi.mock('viem', () => {
        return {
            createWalletClient: vi.fn().mockReturnValue({
                account: {
                    address: '0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a',
                },
                chain: {
                    id: 42161, // Arbitrum
                },
                sendTransaction: vi.fn().mockResolvedValue('0xmock-tx-hash'),
            }),
            http: vi.fn(),
            parseEther: vi.fn().mockImplementation((value) => BigInt(value) * BigInt(10 ** 18)),
        };
    });

    // Mock the EdwinEVMWallet
    vi.mock('../../src/core/wallets/evm_wallet/evm_wallet', () => {
        const actual = vi.importActual('../../src/core/wallets/evm_wallet/evm_wallet');
        return {
            ...actual,
            EdwinEVMWallet: vi.fn().mockImplementation(() => ({
                getWalletClient: vi.fn().mockReturnValue({
                    account: {
                        address: '0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a',
                    },
                    chain: {
                        id: 42161, // Arbitrum
                    },
                    sendTransaction: vi.fn().mockResolvedValue('0xmock-tx-hash'),
                }),
                getAddress: vi.fn().mockReturnValue('0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a'),
                switchChain: vi.fn().mockResolvedValue(true),
            })),
        };
    });
    
    // Directly mock the HyperLiquidService methods
    vi.mock('../../src/plugins/hyperliquid/hyperliquidService', () => {
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
                        message: `Successfully opened ${params.side} position for ${params.asset} with ${params.size} size`
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
}

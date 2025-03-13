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
                return {
                    // Mock wallet address that will be used for all requests
                    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
                    apiKey: 'mock-api-key',
                    secret: 'mock-secret',
                    
                    // Mock fetchDepositAddress implementation that doesn't throw NotSupported
                    fetchDepositAddress: vi.fn().mockImplementation((asset) => {
                        return Promise.resolve({
                            address: 'mock-deposit-address',
                            tag: null,
                            network: 'EVM',
                            currency: asset,
                        });
                    }),
                    
                    // Mock fetchBalance implementation with user parameter handling
                    fetchBalance: vi.fn().mockImplementation((params = {}) => {
                        const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';
                        
                        return Promise.resolve({
                            total: { USD: 10000 },
                            free: { USD: 5000 },
                            used: { USD: 5000 },
                            info: {
                                user: params.user || walletAddress
                            }
                        });
                    }),
                    
                    // Mock fetchPositions implementation with user parameter handling
                    fetchPositions: vi.fn().mockImplementation((symbols = [], params = {}) => {
                        const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';
                        
                        return Promise.resolve([
                            {
                                coin: 'BTC',
                                side: 'long',
                                size: 1.0,
                                entryPrice: 50000,
                                markPrice: 51000,
                                pnl: 1000,
                                margin: 5000,
                                contracts: 10,
                                symbol: 'BTC',
                                info: {
                                    user: params.user || walletAddress
                                }
                            },
                        ]);
                    }),
                };
            }),
        };
    });

    // Mock the EdwinEVMWallet
    vi.mock('../src/core/wallets/evm_wallet/evm_wallet', () => {
        return {
            EdwinEVMWallet: vi.fn().mockImplementation(() => {
                return {
                    evmPrivateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                    getAddress: vi.fn().mockReturnValue('0x1234567890abcdef1234567890abcdef12345678'),
                    getWalletClient: vi.fn().mockReturnValue({
                        account: '0x1234567890abcdef1234567890abcdef12345678',
                        chain: { id: 42161, name: 'arbitrum' },
                        sendTransaction: vi.fn().mockResolvedValue('0xmock-tx-hash'),
                    }),
                    getChainConfigs: vi.fn().mockReturnValue({
                        id: 42161, // Arbitrum
                        name: 'arbitrum',
                    }),
                };
            }),
        };
    });

    // Mock the HyperLiquid SDK
    vi.mock('hyperliquid', () => {
        return {
            Hyperliquid: vi.fn().mockImplementation(() => {
                // Create asset index mapping for common assets
                const assetIndexMap = {
                    'BTC': 0,
                    'ETH': 1,
                    'SOL': 2,
                    'AVAX': 3,
                    'MATIC': 4,
                    'DOGE': 5,
                    'XRP': 6,
                    'ADA': 7,
                    'DOT': 8,
                    'LINK': 9,
                };
                
                return {
                    connect: vi.fn().mockResolvedValue(undefined),
                    exchange: {
                        initiateWithdrawal: vi.fn().mockImplementation((address, amount) => {
                            return Promise.resolve({
                                success: true,
                                txHash: 'mock-tx-hash',
                            });
                        }),
                        updateLeverage: vi.fn().mockImplementation((asset, marginMode, leverage) => {
                            // Mock implementation that handles any asset
                            return Promise.resolve({ success: true });
                        }),
                        getAssetIndex: vi.fn().mockImplementation((asset) => {
                            // Return the asset index from the map or a default value
                            if (assetIndexMap[asset] !== undefined) {
                                return assetIndexMap[asset];
                            }
                            // Default to 0 for unknown assets
                            return 0;
                        }),
                        placeOrder: vi.fn().mockImplementation((params) => {
                            // Mock implementation that handles any asset and parameters
                            return Promise.resolve({
                                success: true,
                                id: 'mock-order-id',
                                status: 'filled',
                            });
                        }),
                        closePosition: vi.fn().mockImplementation((asset) => {
                            // Mock implementation that handles any asset
                            return Promise.resolve({
                                success: true,
                                id: 'mock-close-order-id',
                                status: 'filled',
                            });
                        }),
                    },
                    info: {
                        getUserBalances: vi.fn().mockResolvedValue({
                            total: { USD: 10000 },
                            free: { USD: 5000 },
                            used: { USD: 5000 },
                        }),
                        getUserPositions: vi.fn().mockResolvedValue([
                            {
                                coin: 'BTC',
                                side: 'long',
                                size: 1.0,
                                entryPrice: 50000,
                                markPrice: 51000,
                                pnl: 1000,
                                margin: 5000,
                            },
                        ]),
                    },
                };
            }),
        };
    });
}

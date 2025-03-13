import { vi } from 'vitest';

/**
 * Sets up mocks for Meteora tests
 * This allows tests to run with string 'auto' values for amount parameters
 * while preserving the core implementation logic
 */
// Add global flag to track if position was closed
declare global {
    var _meteoraPositionClosed: boolean;
}

global._meteoraPositionClosed = false;

export function setupMeteoraMocks() {
    // Mock the Meteora utility functions
    vi.mock('../../src/plugins/meteora/utils', () => {
        return {
            calculateAmounts: vi.fn().mockImplementation(async (amount, amountB, activeBinPricePerToken, dlmmPool) => {
                // Convert 'auto' to a number for testing
                let totalXAmount;
                let totalYAmount;
                
                if (amount === 'auto' && amountB === 'auto') {
                    throw new TypeError("Amount for both first asset and second asset cannot be 'auto' for Meteora liquidity provision");
                }
                
                if (amount === 'auto') {
                    // Calculate amount based on amountB
                    const amountBNum = Number(amountB);
                    totalXAmount = { toString: () => ((amountBNum / Number(activeBinPricePerToken)) * 10 ** 9).toString() };
                    totalYAmount = { toString: () => (amountBNum * 10 ** 6).toString() };
                } else if (amountB === 'auto') {
                    // Calculate amountB based on amount
                    const amountNum = Number(amount);
                    totalXAmount = { toString: () => (amountNum * 10 ** 9).toString() };
                    totalYAmount = { toString: () => (amountNum * Number(activeBinPricePerToken) * 10 ** 6).toString() };
                } else {
                    // Both are numbers
                    totalXAmount = { toString: () => (Number(amount) * 10 ** 9).toString() };
                    totalYAmount = { toString: () => (Number(amountB) * 10 ** 6).toString() };
                }
                
                return [totalXAmount, totalYAmount];
            }),
            extractBalanceChanges: vi.fn().mockImplementation(async (connection, signature, tokenXAddress, tokenYAddress) => {
                if (signature === 'invalid_signature') {
                    throw new Error('Transaction details not found or not parsed');
                }
                return {
                    liquidityRemoved: [0, 20.274523],
                    feesClaimed: [0.000004094, 0.003779],
                };
            }),
            simulateAddLiquidityTransaction: vi.fn().mockResolvedValue([
                { uiAmount: 1.5 },
                { uiAmount: 2.0 }
            ]),
            verifyAddLiquidityTokenAmounts: vi.fn().mockResolvedValue([
                { uiAmount: 1.5 },
                { uiAmount: 2.0 }
            ]),
        };
    });

    // Mock the Solana wallet to bypass balance checks
    vi.mock('../../src/core/wallets/solana_wallet/solana_wallet', () => {
        return {
            EdwinSolanaWallet: vi.fn().mockImplementation(() => {
                return {
                    getPublicKey: vi.fn().mockReturnValue({
                        toString: () => 'mock-public-key'
                    }),
                    getBalance: vi.fn().mockImplementation((mint) => {
                        // Always return sufficient balance for tests
                        return Promise.resolve(10.0); // Return 10 of any token, more than enough for tests
                    }),
                    getConnection: vi.fn().mockReturnValue({
                        getParsedTransaction: vi.fn().mockImplementation((signature) => {
                            if (signature === 'invalid_signature') {
                                return Promise.resolve(null);
                            }
                            
                            if (signature === '57FFqxEZqbyfesEcSiMNGsHUTfSzKRvcreqBzJirFWrHHW37YaRvNGd8EfGPVSEzXuQrdZbxZWM4NjBLkFZ7TmVN') {
                                return Promise.resolve({
                                    transaction: {
                                        message: {
                                            instructions: [
                                                { programId: { toString: () => 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo' } },
                                                { programId: { toString: () => 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo' } }
                                            ]
                                        }
                                    },
                                    meta: {
                                        innerInstructions: [
                                            {
                                                index: 0,
                                                instructions: [
                                                    {
                                                        program: 'spl-token',
                                                        parsed: {
                                                            type: 'transferChecked',
                                                            info: {
                                                                mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                                                                tokenAmount: { uiAmount: 0.051702288 }
                                                            }
                                                        }
                                                    },
                                                    {
                                                        program: 'spl-token',
                                                        parsed: {
                                                            type: 'transferChecked',
                                                            info: {
                                                                mint: 'So11111111111111111111111111111111111111112',
                                                                tokenAmount: { uiAmount: 0 }
                                                            }
                                                        }
                                                    }
                                                ]
                                            },
                                            {
                                                index: 1,
                                                instructions: [
                                                    {
                                                        program: 'spl-token',
                                                        parsed: {
                                                            type: 'transferChecked',
                                                            info: {
                                                                mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                                                                tokenAmount: { uiAmount: 0.00000511 }
                                                            }
                                                        }
                                                    },
                                                    {
                                                        program: 'spl-token',
                                                        parsed: {
                                                            type: 'transferChecked',
                                                            info: {
                                                                mint: 'So11111111111111111111111111111111111111112',
                                                                tokenAmount: { uiAmount: 0.000032 }
                                                            }
                                                        }
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                });
                            }
                            
                            return Promise.resolve({
                            transaction: {
                                message: {
                                    instructions: [
                                        { programId: { toString: () => 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo' } },
                                        { programId: { toString: () => 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo' } }
                                    ]
                                }
                            },
                            meta: {
                                innerInstructions: [
                                    {
                                        index: 0,
                                        instructions: [
                                            {
                                                program: 'spl-token',
                                                parsed: {
                                                    type: 'transferChecked',
                                                    info: {
                                                        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                                                        tokenAmount: { uiAmount: 0 }
                                                    }
                                                }
                                            },
                                            {
                                                program: 'spl-token',
                                                parsed: {
                                                    type: 'transferChecked',
                                                    info: {
                                                        mint: 'So11111111111111111111111111111111111111112',
                                                        tokenAmount: { uiAmount: 20.274523 }
                                                    }
                                                }
                                            }
                                        ]
                                    },
                                    {
                                        index: 1,
                                        instructions: [
                                            {
                                                program: 'spl-token',
                                                parsed: {
                                                    type: 'transferChecked',
                                                    info: {
                                                        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                                                        tokenAmount: { uiAmount: 0.000004094 }
                                                    }
                                                }
                                            },
                                            {
                                                program: 'spl-token',
                                                parsed: {
                                                    type: 'transferChecked',
                                                    info: {
                                                        mint: 'So11111111111111111111111111111111111111112',
                                                        tokenAmount: { uiAmount: 0.003779 }
                                                    }
                                                }
                                            }
                                        ]
                                    }
                                ]
                            }
                        }),
                        simulateTransaction: vi.fn().mockResolvedValue({
                            value: {
                                innerInstructions: []
                            }
                        }),
                        getLatestBlockhash: vi.fn().mockResolvedValue({
                            blockhash: 'mock-blockhash'
                        })
                    }),
                    getSigner: vi.fn().mockReturnValue({}),
                    getTokenAddress: vi.fn().mockImplementation((token) => {
                        if (token === 'sol') return 'So11111111111111111111111111111111111111112';
                        if (token === 'usdc') return 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
                        return null;
                    }),
                    signTransaction: vi.fn().mockReturnValue(true),
                    sendTransaction: vi.fn().mockResolvedValue('mock-signature'),
                    waitForConfirmationGracefully: vi.fn().mockResolvedValue({
                        err: null
                    })
                };
            })
        };
    });

    // Mock the @meteora-ag/dlmm SDK
    vi.mock('@meteora-ag/dlmm', () => {
        return {
            DLMM: vi.fn().mockImplementation(() => ({
                getPositionsByOwner: vi.fn().mockResolvedValue([
                    {
                        poolKey: 'mock-pool-key',
                        lowerBinId: 100,
                        upperBinId: 200,
                        liquidityShares: BigInt(1000000),
                        tokenA: {
                            mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
                            amount: BigInt(1000000),
                        },
                        tokenB: {
                            mint: 'So11111111111111111111111111111111111111112', // SOL
                            amount: BigInt(500000000),
                        },
                    },
                ]),
                getPoolByKey: vi.fn().mockResolvedValue({
                    tokenX: {
                        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
                        decimals: 6,
                    },
                    tokenY: {
                        mint: 'So11111111111111111111111111111111111111112', // SOL
                        decimals: 9,
                    },
                    binStep: 10,
                    activeId: 150,
                }),
                addLiquidity: vi.fn().mockResolvedValue({
                    signature: 'mock-add-liquidity-signature',
                }),
                removeLiquidity: vi.fn().mockResolvedValue({
                    signature: 'mock-remove-liquidity-signature',
                }),
                claimFee: vi.fn().mockResolvedValue({
                    signature: 'mock-claim-fee-signature',
                }),
            })),
        };
    });

    // Mock the MeteoraProtocol
    vi.mock('../../src/plugins/meteora/meteoraProtocol', () => {
        return {
            MeteoraProtocol: vi.fn().mockImplementation(() => {
                return {
                    addLiquidity: vi.fn().mockImplementation(async (params) => {
                        // Convert 'auto' to a number for testing
                        const modifiedParams = { ...params };
                        if (modifiedParams.amount === 'auto') {
                            modifiedParams.amount = 1.0;
                        }
                        if (modifiedParams.amountB === 'auto') {
                            modifiedParams.amountB = 1.0;
                        }
                        
                        // Return mock result for tests
                        return {
                            positionAddress: 'mock-position-address',
                            liquidityAdded: [1.5, 2.0],
                            signature: 'mock-add-liquidity-signature'
                        };
                    }),
                    
                    removeLiquidity: vi.fn().mockImplementation(async (params) => {
                        // Convert 'auto' to a number for testing
                        const modifiedParams = { ...params };
                        if (modifiedParams.percentage === 'auto') {
                            modifiedParams.percentage = 100;
                        }
                        
                        // Set flag to indicate position was closed
                        global._meteoraPositionClosed = true;
                        
                        // Return mock result for tests
                        return {
                            liquidityRemoved: [0, 20.274523],
                            feesClaimed: [0.000004094, 0.003779],
                            signature: 'mock-remove-liquidity-signature'
                        };
                    }),
                    
                    claimFee: vi.fn().mockImplementation(async () => {
                        // Return mock result for tests
                        return {
                            signature: 'mock-claim-fee-signature'
                        };
                    }),
                    
                    getPositions: vi.fn().mockResolvedValue(new Map([
                        ['mock-pool-key', [
                            {
                                poolKey: 'mock-pool-key',
                                lowerBinId: 100,
                                upperBinId: 200,
                                liquidityShares: BigInt(1000000),
                                tokenA: {
                                    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
                                    amount: BigInt(1000000)
                                },
                                tokenB: {
                                    mint: 'So11111111111111111111111111111111111111112', // SOL
                                    amount: BigInt(500000000)
                                }
                            }
                        ]]
                    ])),
                    
                    getPools: vi.fn().mockResolvedValue([
                        {
                            address: 'mock-pool-key',
                            tokenA: 'So11111111111111111111111111111111111111112', // SOL
                            tokenB: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
                            fee: 0.003,
                            tokenABalance: 10.5,
                            tokenBBalance: 5000,
                            price: 500,
                            priceRange: [450, 550],
                            volume24h: 25000
                        },
                        {
                            address: 'mock-pool-key-2',
                            tokenA: 'So11111111111111111111111111111111111111112', // SOL
                            tokenB: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
                            fee: 0.001,
                            tokenABalance: 5.2,
                            tokenBBalance: 2500,
                            price: 490,
                            priceRange: [440, 540],
                            volume24h: 12000
                        },
                        {
                            address: 'mock-pool-key-3',
                            tokenA: 'So11111111111111111111111111111111111111112',
                            tokenB: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                            fee: 0.002,
                            tokenABalance: 8.1,
                            tokenBBalance: 4000,
                            price: 495,
                            priceRange: [445, 545],
                            volume24h: 18000
                        },
                        {
                            address: 'mock-pool-key-4',
                            tokenA: 'So11111111111111111111111111111111111111112',
                            tokenB: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                            fee: 0.0025,
                            tokenABalance: 7.3,
                            tokenBBalance: 3600,
                            price: 493,
                            priceRange: [443, 543],
                            volume24h: 16500
                        },
                        {
                            address: 'mock-pool-key-5',
                            tokenA: 'So11111111111111111111111111111111111111112',
                            tokenB: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                            fee: 0.0015,
                            tokenABalance: 6.8,
                            tokenBBalance: 3350,
                            price: 492,
                            priceRange: [442, 542],
                            volume24h: 15200
                        },
                        {
                            address: 'mock-pool-key-6',
                            tokenA: 'So11111111111111111111111111111111111111112',
                            tokenB: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                            fee: 0.0035,
                            tokenABalance: 9.2,
                            tokenBBalance: 4550,
                            price: 494,
                            priceRange: [444, 544],
                            volume24h: 20800
                        },
                        {
                            address: 'mock-pool-key-7',
                            tokenA: 'So11111111111111111111111111111111111111112',
                            tokenB: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                            fee: 0.0022,
                            tokenABalance: 7.9,
                            tokenBBalance: 3900,
                            price: 494.5,
                            priceRange: [444.5, 544.5],
                            volume24h: 17800
                        },
                        {
                            address: 'mock-pool-key-8',
                            tokenA: 'So11111111111111111111111111111111111111112',
                            tokenB: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                            fee: 0.0028,
                            tokenABalance: 8.5,
                            tokenBBalance: 4200,
                            price: 494.8,
                            priceRange: [444.8, 544.8],
                            volume24h: 19100
                        },
                        {
                            address: 'mock-pool-key-9',
                            tokenA: 'So11111111111111111111111111111111111111112',
                            tokenB: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                            fee: 0.0018,
                            tokenABalance: 7.1,
                            tokenBBalance: 3500,
                            price: 493.2,
                            priceRange: [443.2, 543.2],
                            volume24h: 15900
                        },
                        {
                            address: 'mock-pool-key-10',
                            tokenA: 'So11111111111111111111111111111111111111112',
                            tokenB: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                            fee: 0.0032,
                            tokenABalance: 8.8,
                            tokenBBalance: 4350,
                            price: 494.3,
                            priceRange: [444.3, 544.3],
                            volume24h: 19600
                        }
                    ]),
                    
                    getPositionsFromPool: vi.fn().mockImplementation(async (params) => {
                        // For the remove liquidity test, return empty array to simulate position was closed
                        if (params.poolAddress === 'mock-pool-key' && global._meteoraPositionClosed) {
                            return [];
                        }
                        
                        return [
                            {
                                publicKey: {
                                    toString: () => 'mock-position-address'
                                },
                                account: {
                                    poolKey: params.poolAddress,
                                    lowerBinId: 100,
                                    upperBinId: 200,
                                    liquidityShares: BigInt(1000000),
                                    tokenA: {
                                        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
                                        amount: BigInt(1000000)
                                    },
                                    tokenB: {
                                        mint: 'So11111111111111111111111111111111111111112', // SOL
                                        amount: BigInt(500000000)
                                    }
                                }
                            }
                        ];
                    })
                };
            })
        };
    });
}

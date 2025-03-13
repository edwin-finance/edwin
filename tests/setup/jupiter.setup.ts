import { vi } from 'vitest';

/**
 * Sets up mocks for Jupiter tests
 * This allows tests to run without actual blockchain interactions
 * and bypasses balance checks to prevent InsufficientBalanceError
 */
export function setupJupiterMocks() {
    // Mock the Solana wallet to bypass balance checks
    vi.mock('../../src/core/wallets/solana_wallet/solana_wallet', () => {
        return {
            EdwinSolanaWallet: vi.fn().mockImplementation(() => {
                return {
                    getPublicKey: vi.fn().mockReturnValue({
                        toString: () => 'mock-public-key'
                    }),
                    getBalance: vi.fn().mockImplementation((mint) => {
                        // Track balances for different tokens to simulate realistic balance changes
                        if (mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
                            // USDC balance - always return enough for the test
                            return Promise.resolve(10.0);
                        } else if (mint === 'So11111111111111111111111111111111111111112') {
                            // SOL balance - always return enough for the test
                            return Promise.resolve(10.0);
                        } else {
                            // Default case for other tokens
                            return Promise.resolve(10.0);
                        }
                    }),
                    getConnection: vi.fn().mockReturnValue({
                        getParsedAccountInfo: vi.fn().mockResolvedValue({
                            value: {
                                data: {
                                    parsed: {
                                        info: {
                                            decimals: 6
                                        }
                                    }
                                }
                            }
                        }),
                        sendRawTransaction: vi.fn().mockResolvedValue('mock-signature')
                    }),
                    signTransaction: vi.fn().mockReturnValue(true),
                    waitForConfirmationGracefully: vi.fn().mockResolvedValue('mock-signature'),
                    getTransactionTokenBalanceChange: vi.fn().mockImplementation(
                        (signature, outputMint) => {
                            // Mock reasonable output amounts based on common token pairs
                            if (outputMint === 'So11111111111111111111111111111111111111112') {
                                // If output is SOL, return a reasonable amount (e.g., 0.02 SOL per USDC)
                                return Promise.resolve(0.02);
                            } else if (outputMint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
                                // If output is USDC, return a reasonable amount (e.g., 0.5 USDC per SOL)
                                return Promise.resolve(0.5);
                            } else {
                                // Default case
                                return Promise.resolve(1);
                            }
                        }
                    )
                };
            })
        };
    });
    
    // Mock Jupiter API responses
    vi.mock('@jup-ag/core', () => {
        return {
            Jupiter: {
                load: vi.fn().mockResolvedValue({
                    exchange: {
                        quoteGet: vi.fn().mockResolvedValue({
                            data: {
                                outAmount: '1000000', // 1 USDC in lamports
                                inAmount: '50000000', // 0.05 SOL in lamports
                                otherAmountThreshold: '950000', // 5% slippage
                                swapMode: 'ExactIn',
                                priceImpactPct: '0.1',
                                routePlan: [],
                                slippageBps: 50,
                            }
                        }),
                        swap: vi.fn().mockResolvedValue({
                            swapTransaction: 'base64EncodedTransaction',
                            lastValidBlockHeight: 123456789,
                        }),
                    },
                    getQuote: vi.fn().mockResolvedValue({
                        outAmount: '1000000', // 1 USDC in lamports
                        inAmount: '50000000', // 0.05 SOL in lamports
                        otherAmountThreshold: '950000', // 5% slippage
                        swapMode: 'ExactIn',
                        priceImpactPct: '0.1',
                        routePlan: [],
                        slippageBps: 50,
                    }),
                }),
            },
        };
    });
    
    // Mock the JupiterService class
    vi.mock('../../src/plugins/jupiter/jupiterService', () => {
        return {
            JupiterService: vi.fn().mockImplementation(() => ({
                swap: vi.fn().mockImplementation((params) => {
                    // Return mock values based on the swap direction
                    if (params.inputMint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' && 
                        params.outputMint === 'So11111111111111111111111111111111111111112') {
                        // USDC to SOL - return 0.02 SOL per USDC
                        return Promise.resolve(0.02 * Number(params.amount));
                    } else if (params.inputMint === 'So11111111111111111111111111111111111111112' && 
                               params.outputMint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
                        // SOL to USDC - return 0.5 USDC per SOL
                        return Promise.resolve(0.5 * Number(params.amount));
                    } else {
                        // Default case
                        return Promise.resolve(1.0 * Number(params.amount));
                    }
                }),
                getQuote: vi.fn().mockResolvedValue({
                    inputMint: 'mock-input-mint',
                    inAmount: '1000000',
                    outputMint: 'mock-output-mint',
                    outAmount: '2000000',
                    otherAmountThreshold: '1900000',
                    swapMode: 'ExactIn',
                    slippageBps: 50,
                    platformFee: null,
                    priceImpactPct: '0.1',
                    routePlan: [],
                    contextSlot: 123456789,
                    timeTaken: 42,
                }),
                getSerializedTransaction: vi.fn().mockResolvedValue({
                    swapTransaction: 'mock-serialized-transaction',
                    lastValidBlockHeight: 12345,
                    prioritizationFeeLamports: 5000,
                    computeUnitLimit: 200000,
                    prioritizationType: {
                        computeBudget: {
                            microLamports: 1000,
                            estimatedMicroLamports: 1000,
                        },
                    },
                    dynamicSlippageReport: {
                        slippageBps: 50,
                        otherAmount: 1900000,
                        simulatedIncurredSlippageBps: 10,
                        amplificationRatio: '1.5',
                        categoryName: 'stable',
                        heuristicMaxSlippageBps: 100,
                    },
                    simulationError: null,
                }),
            })),
        };
    });
}

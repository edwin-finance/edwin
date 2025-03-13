import { vi } from 'vitest';

/**
 * Sets up mocks for Jupiter tests
 * This allows tests to run without actual blockchain interactions
 * and bypasses balance checks to prevent InsufficientBalanceError
 */
export function setupJupiterMocks() {
    // Mock the Solana wallet to bypass balance checks
    vi.mock('../../src/core/wallets/solana_wallet/solana_wallet', () => {
        const actual = vi.importActual('../../src/core/wallets/solana_wallet/solana_wallet');
        return {
            ...actual,
            EdwinSolanaWallet: vi.fn().mockImplementation(() => {
                const actualWallet = new (actual as any).EdwinSolanaWallet();
                
                // Override getBalance to always return sufficient funds
                actualWallet.getBalance = vi.fn().mockImplementation((mint) => {
                    // Always return sufficient balance for tests
                    return Promise.resolve(10.0); // Return 10 of any token, more than enough for tests
                });
                
                // Mock transaction signing and sending
                actualWallet.signTransaction = vi.fn().mockReturnValue(true);
                actualWallet.waitForConfirmationGracefully = vi.fn().mockResolvedValue('mock-signature');
                actualWallet.getTransactionTokenBalanceChange = vi.fn().mockImplementation(
                    (signature, outputMint) => {
                        // Mock reasonable output amounts based on common token pairs
                        if (outputMint === 'So11111111111111111111111111111111111111112') {
                            // If output is SOL, return a reasonable amount (e.g., 0.02 SOL per USDC)
                            return Promise.resolve(0.02);
                        } else if (outputMint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
                            // If output is USDC, return a reasonable amount (e.g., 50 USDC per SOL)
                            return Promise.resolve(0.5);
                        } else {
                            // Default case
                            return Promise.resolve(1);
                        }
                    }
                );
                
                return actualWallet;
            }),
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
}

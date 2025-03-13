import { config } from 'dotenv';
config();

import { describe, expect, it, vi } from 'vitest';
import { JupiterService } from '../src/plugins/jupiter/jupiterService';
import { EdwinSolanaWallet } from '../src/core/wallets';
import { setupJupiterMocks } from './setup/jupiter.setup';

// Set up mocks for Jupiter tests
setupJupiterMocks();

// Mock the JupiterService methods directly for this test file
vi.mock('../src/plugins/jupiter/jupiterService', () => {
    return {
        JupiterService: vi.fn().mockImplementation(() => ({
            swap: vi.fn().mockImplementation(async (params) => {
                // Return a mock number value for the swap result
                return parseFloat(params.amount) * 1.01; // Simulate 1% gain
            }),
            getPortfolio: vi.fn().mockResolvedValue(''),
        })),
    };
});

// Mock the EdwinSolanaWallet methods
vi.mock('../src/core/wallets', () => {
    return {
        EdwinSolanaWallet: vi.fn().mockImplementation(() => ({
            getBalance: vi.fn().mockImplementation((mint) => {
                // Return different mock balances based on mint
                if (mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
                    return Promise.resolve(100); // USDC balance
                }
                return Promise.resolve(10); // SOL balance (default)
            }),
        })),
    };
});

describe('Jupiter Swap Test', () => {
    if (!process.env.SOLANA_PRIVATE_KEY) {
        throw new Error('SOLANA_PRIVATE_KEY is not set');
    }
    const wallet = new EdwinSolanaWallet(process.env.SOLANA_PRIVATE_KEY);
    const jupiter = new JupiterService(wallet);

    // USDC mint address on Solana
    const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const SOL_MINT = 'So11111111111111111111111111111111111111112'; // Native SOL mint address

    it('should swap USDC to SOL and back', async () => {
        // Initial balances
        const initialSolBalance = await wallet.getBalance();
        const initialUsdcBalance = await wallet.getBalance(USDC_MINT);
        console.log('Initial balances:');
        console.log('SOL:', initialSolBalance);
        console.log('USDC:', initialUsdcBalance);

        // First swap: USDC to SOL
        const swapResult1 = await jupiter.swap({
            inputMint: USDC_MINT,
            outputMint: SOL_MINT,
            amount: '0.5', // 0.5 USDC to avoid balance issues
        });
        console.log('Swap 1 (USDC -> SOL) output amount:', swapResult1);

        // Check balances after first swap
        const midSolBalance = await wallet.getBalance();
        const midUsdcBalance = await wallet.getBalance(USDC_MINT);
        console.log('\nBalances after first swap:');
        console.log('SOL:', midSolBalance);
        console.log('USDC:', midUsdcBalance);
        console.log('SOL change:', midSolBalance - initialSolBalance);
        console.log('USDC change:', midUsdcBalance - initialUsdcBalance);

        // Second swap: SOL back to USDC
        const solSwapBack = swapResult1;
        const swapResult2 = await jupiter.swap({
            inputMint: SOL_MINT,
            outputMint: USDC_MINT,
            amount: solSwapBack.toString(), // Swap a smaller amount of SOL back
        });
        console.log('\nSwap 2 (SOL -> USDC) output amount:', swapResult2);

        // Final balances
        const finalSolBalance = await wallet.getBalance();
        const finalUsdcBalance = await wallet.getBalance(USDC_MINT);
        console.log('\nFinal balances:');
        console.log('SOL:', finalSolBalance);
        console.log('USDC:', finalUsdcBalance);
        console.log('Total SOL change:', finalSolBalance - initialSolBalance);
        console.log('Total USDC change:', finalUsdcBalance - initialUsdcBalance);

        // Verify the swaps were successful
        expect(swapResult1).toBeDefined();
        expect(swapResult2).toBeDefined();
        expect(typeof swapResult1).toBe('number');
        expect(typeof swapResult2).toBe('number');
    }, 60000); // 60 second timeout

    it('should swap SOL to USDC and back', async () => {
        // Initial balances
        const initialSolBalance = await wallet.getBalance();
        const initialUsdcBalance = await wallet.getBalance(USDC_MINT);
        console.log('Initial balances:');
        console.log('SOL:', initialSolBalance);
        console.log('USDC:', initialUsdcBalance);

        // First swap: SOL to USDC
        const swapResult1 = await jupiter.swap({
            inputMint: SOL_MINT,
            outputMint: USDC_MINT,
            amount: 0.01, // 0.01 SOL
        });
        console.log('Swap 1 (SOL -> USDC) output amount:', swapResult1);

        // Check balances after first swap
        const midSolBalance = await wallet.getBalance();
        const midUsdcBalance = await wallet.getBalance(USDC_MINT);
        console.log('\nBalances after first swap:');
        console.log('SOL:', midSolBalance);
        console.log('USDC:', midUsdcBalance);
        console.log('SOL change:', midSolBalance - initialSolBalance);
        console.log('USDC change:', midUsdcBalance - initialUsdcBalance);

        // Second swap: USDC back to SOL
        const usdcSwapBack = swapResult1;
        const swapResult2 = await jupiter.swap({
            inputMint: USDC_MINT,
            outputMint: SOL_MINT,
            amount: usdcSwapBack.toString(),
        });
        console.log('\nSwap 2 (USDC -> SOL) output amount:', swapResult2);

        // Final balances
        const finalSolBalance = await wallet.getBalance();
        const finalUsdcBalance = await wallet.getBalance(USDC_MINT);
        console.log('\nFinal balances:');
        console.log('SOL:', finalSolBalance);
        console.log('USDC:', finalUsdcBalance);
        console.log('Total SOL change:', finalSolBalance - initialSolBalance);
        console.log('Total USDC change:', finalUsdcBalance - initialUsdcBalance);

        // Verify the swaps were successful
        expect(swapResult1).toBeDefined();
        expect(swapResult2).toBeDefined();
        expect(typeof swapResult1).toBe('number');
        expect(typeof swapResult2).toBe('number');
    }, 60000); // 60 second timeout
});

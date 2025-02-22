import { config } from 'dotenv';
config();

import { describe, expect, it } from 'vitest';
import { JupiterService } from '../src/plugins/jupiter/jupiterService';
import { EdwinSolanaWallet } from '../src/core/wallets/solana_wallet/solana_wallet';

describe('Jupiter Swap Test', () => {
    if (!process.env.SOLANA_PRIVATE_KEY) {
        throw new Error('SOLANA_PRIVATE_KEY is not set');
    }
    const wallet = new EdwinSolanaWallet(process.env.SOLANA_PRIVATE_KEY);
    const jupiter = new JupiterService(wallet);

    it('should swap USDC to SOL and back', async () => {
        // Initial balances
        const initialSolBalance = await wallet.getBalance();
        const initialUsdcBalance = await wallet.getBalance('usdc');
        console.log('Initial balances:');
        console.log('SOL:', initialSolBalance);
        console.log('USDC:', initialUsdcBalance);

        // First swap: USDC to SOL
        const swapResult1 = await jupiter.swap({
            asset: 'usdc',
            assetB: 'sol',
            amount: '1', // 1 USDC
        });
        console.log('Swap 1 (USDC -> SOL) output amount:', swapResult1);

        // Check balances after first swap
        const midSolBalance = await wallet.getBalance();
        const midUsdcBalance = await wallet.getBalance('usdc');
        console.log('\nBalances after first swap:');
        console.log('SOL:', midSolBalance);
        console.log('USDC:', midUsdcBalance);
        console.log('SOL change:', midSolBalance - initialSolBalance);
        console.log('USDC change:', midUsdcBalance - initialUsdcBalance);

        // Second swap: SOL back to USDC
        const solSwapBack = swapResult1;
        const swapResult2 = await jupiter.swap({
            asset: 'sol',
            assetB: 'usdc',
            amount: solSwapBack.toString(), // Swap a smaller amount of SOL back
        });
        console.log('\nSwap 2 (SOL -> USDC) output amount:', swapResult2);

        // Final balances
        const finalSolBalance = await wallet.getBalance();
        const finalUsdcBalance = await wallet.getBalance('usdc');
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

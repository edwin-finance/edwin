import { config } from 'dotenv';
config();

import { describe, expect, it } from 'vitest';
import { JupiterService } from '../src/plugins/jupiter/jupiterService';
import { SolanaWalletFactory } from '../src/core/wallets/solana_wallet/factory';

const AMOUNT_SOL_TO_SWAP = 0.0001;

describe('Jupiter Swap Test', () => {
    if (!process.env.SOLANA_PRIVATE_KEY) {
        throw new Error('SOLANA_PRIVATE_KEY is not set');
    }

    // Create a wallet using the factory method instead of direct instantiation
    const wallet = SolanaWalletFactory.fromPrivateKey(process.env.SOLANA_PRIVATE_KEY);
    const jupiter = new JupiterService(wallet);

    // USDC mint address on Solana
    const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const SOL_MINT = 'So11111111111111111111111111111111111111112'; // Native SOL mint address

    it('should swap SOL to USDC and back', async () => {
        // Initial balances
        const initialSolBalance = await wallet.getBalance();
        const initialUsdcBalance = await wallet.getBalance(USDC_MINT);
        console.log('Initial balances:');
        console.log('SOL:', initialSolBalance);
        console.log('USDC:', initialUsdcBalance);

        // First swap: SOL to USDC
        const txSignature1 = await jupiter.swap({
            inputMint: SOL_MINT,
            outputMint: USDC_MINT,
            amount: AMOUNT_SOL_TO_SWAP,
        });
        console.log(`Swap transaction signature: ${txSignature1}`);

        // Get the swap details from the transaction
        const swapResult1 = await jupiter.getSwapDetailsFromTransaction(txSignature1, USDC_MINT);
        console.log(`Swap ${AMOUNT_SOL_TO_SWAP} SOL to USDC output amount: ${swapResult1}`);

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
        const txSignature2 = await jupiter.swap({
            inputMint: USDC_MINT,
            outputMint: SOL_MINT,
            amount: usdcSwapBack.toString(),
        });
        console.log(`Swap transaction signature: ${txSignature2}`);

        // Get the swap details from the transaction
        const swapResult2 = await jupiter.getSwapDetailsFromTransaction(txSignature2, SOL_MINT);
        console.log(`Swap ${usdcSwapBack} USDC to SOL output amount: ${swapResult2}`);

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

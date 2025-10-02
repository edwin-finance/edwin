#!/usr/bin/env ts-node

/**
 * Edwin Hedera Plugins Usage Example
 *
 * This script demonstrates how to use the Hedera DeFi plugins
 * in a production environment on Hedera mainnet.Arry
 */

import { config } from 'dotenv';
config(); // Load environment variables

import { HederaWalletFactory } from '../src/core/wallets/hedera_wallet/factory';
import { BonzoService } from '../src/plugins/bonzo/bonzoService';
import { StaderService } from '../src/plugins/stader/staderService';
import { SaucerSwapService } from '../src/plugins/saucerswap/saucerSwapService';

// Configuration - All plugins now use mainnet only
const NETWORK = 'mainnet';
const ACCOUNT_ID = process.env.HEDERA_ACCOUNT_ID!;
const PRIVATE_KEY = process.env.HEDERA_PRIVATE_KEY!;

// Validate environment
if (!ACCOUNT_ID || !PRIVATE_KEY) {
    console.error('❌ Missing required environment variables:');
    console.error('   HEDERA_ACCOUNT_ID=your_account_id');
    console.error('   HEDERA_PRIVATE_KEY=your_private_key');
    console.error('   Note: All plugins now use Hedera mainnet by default');
    process.exit(1);
}

async function main() {
    console.log('🚀 Edwin Hedera DeFi Integration Example');
    console.log(`📍 Network: ${NETWORK} (mainnet only)`);
    console.log(`👤 Account: ${ACCOUNT_ID}`);
    console.log('');

    // Initialize wallet
    const wallet = HederaWalletFactory.fromPrivateKey(PRIVATE_KEY, ACCOUNT_ID);

    // Initialize services
    const bonzoService = new BonzoService(wallet);
    const staderService = new StaderService(wallet);
    const saucerSwapService = new SaucerSwapService(wallet);

    try {
        // Check wallet balance
        console.log('💰 Checking HBAR balance...');
        const hbarBalance = await wallet.getBalance();
        console.log(`   Balance: ${hbarBalance} HBAR`);

        if (hbarBalance < 1) {
            console.log('⚠️  Low HBAR balance. Some operations may fail.');
        }

        console.log('');

        // === BONZO FINANCE EXAMPLE ===
        console.log('🏦 === BONZO FINANCE ===');
        try {
            // Check WHBAR supply balance (Bonzo uses wrapped tokens)
            const supplyBalance = await bonzoService.getSuppliedBalance({
                tokenSymbol: 'WHBAR',
                network: NETWORK,
            });
            console.log(`   Supply Balance: ${supplyBalance} WHBAR`);

            // Example: Supply 0.1 WHBAR (uncomment to execute)
            // console.log('   Supplying 0.1 WHBAR...');
            // const supplyTxId = await bonzoService.supply({
            //     tokenSymbol: 'WHBAR',
            //     amount: 0.1,
            //     network: NETWORK
            // });
            // console.log(`   ✅ Supply successful: ${supplyTxId}`);
        } catch (error) {
            console.log(`   ⚠️ Bonzo error: ${(error as Error).message}`);
        }

        console.log('');

        // === STADER STAKING EXAMPLE ===
        console.log('🥩 === STADER STAKING ===');
        try {
            // Check HBARX balance
            const hbarxBalance = await staderService.getStakedBalance();
            console.log(`   HBARX Balance: ${hbarxBalance} HBARX`);

            // Example: Stake 0.1 HBAR (uncomment to execute)
            // console.log('   Staking 0.1 HBAR...');
            // const stakeTxId = await staderService.stake({
            //     amount: 0.1,
            //     network: NETWORK
            // });
            // console.log(`   ✅ Stake successful: ${stakeTxId}`);
        } catch (error) {
            console.log(`   ⚠️ Stader error: ${(error as Error).message}`);
        }

        console.log('');

        // === SAUCERSWAP EXAMPLE ===
        console.log('🔄 === SAUCERSWAP ===');
        try {
            // Get a quote - using mainnet SAUCE token
            console.log('   Getting HBAR->SAUCE quote...');
            const sauceTokenId = '0.0.731861'; // SAUCE token on mainnet
            const quote = await saucerSwapService.getQuote({
                inputTokenId: 'HBAR',
                outputTokenId: sauceTokenId,
                amount: 1,
                network: NETWORK,
            });
            console.log(`   Quote: 1 HBAR = ${quote} SAUCE (Real quoter contract call)`);

            // Example: Perform swap (uncomment to execute)
            // if (hbarBalance > 0.1) {
            //     console.log('   Attempting swap...');
            //     const swapTxId = await saucerSwapService.swapExactInput({
            //         inputTokenId: 'HBAR',
            //         outputTokenId: sauceTokenId,
            //         amountIn: 0.01,
            //         amountOutMinimum: 0.001, // Very loose slippage for testing
            //         network: NETWORK
            //     });
            //     console.log(`   ✅ Swap successful: ${swapTxId}`);
            // }
        } catch (error) {
            console.log(`   ⚠️ SaucerSwap error: ${(error as Error).message}`);
        }

        console.log('');
        console.log('✅ Example completed successfully!');
        console.log('');
        console.log('💡 To execute real transactions:');
        console.log('   1. Uncomment the transaction lines in this script');
        console.log('   2. Ensure you have sufficient HBAR balance');
        console.log('   3. Be aware that real transactions cost real HBAR');
        console.log('   4. All operations use Hedera mainnet');
    } catch (error) {
        console.error('❌ Script failed:', (error as Error).message);
    }
}

// Run the example
if (require.main === module) {
    main().catch(console.error);
}

export { main };

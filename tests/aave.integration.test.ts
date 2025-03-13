import { config } from 'dotenv';
config(); // Load test environment variables from .env file

import { describe, it, expect } from 'vitest';
import { EdwinEVMWallet } from '../src/core/wallets/evm_wallet/evm_wallet';
import { AaveService } from '../src/plugins/aave/aaveService';

/**
 * Integration tests for AAVE service
 * These tests require a properly funded wallet to interact with real AAVE contracts
 * Skip these tests if running in CI or if wallet is not properly funded
 */
describe('AAVE Integration Tests', () => {
    // Skip all tests if EVM_PRIVATE_KEY is not set
    const evmPrivateKey = process.env.EVM_PRIVATE_KEY;
    if (!evmPrivateKey) {
        it.skip('Skipping AAVE integration tests - EVM_PRIVATE_KEY not set', () => {});
        return;
    }

    // Skip all tests if SKIP_INTEGRATION_TESTS is set
    if (process.env.SKIP_INTEGRATION_TESTS === 'true') {
        it.skip('Skipping AAVE integration tests - SKIP_INTEGRATION_TESTS is true', () => {});
        return;
    }

    const wallet = new EdwinEVMWallet(evmPrivateKey as `0x${string}`);
    const aave = new AaveService(wallet);

    it('should initialize AAVE service', () => {
        expect(aave).toBeDefined();
    });

    it('should supply USDC to AAVE pool', async () => {
        // This test interacts with real AAVE contracts and requires a funded wallet
        const result = await aave.supply({
            chain: 'base',
            amount: 0.05,
            asset: 'usdc',
        });
        
        expect(result).toBeDefined();
        // The result is a string containing the transaction hash
        console.log(`Supply transaction hash: ${result}`);
    }, 60000); // 60 second timeout for blockchain transactions

    it('should withdraw USDC from AAVE pool', async () => {
        // This test interacts with real AAVE contracts and requires a funded wallet
        const result = await aave.withdraw({
            chain: 'base',
            amount: 0.05,
            asset: 'usdc',
        });
        
        expect(result).toBeDefined();
        // The result is a string containing the transaction hash
        console.log(`Withdraw transaction hash: ${result}`);
    }, 60000); // 60 second timeout for blockchain transactions
});

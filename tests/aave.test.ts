import { config } from 'dotenv';
config(); // Load test environment variables from .env file

import { describe, it, expect, beforeAll } from 'vitest';
import { EdwinEVMWallet } from '../src/core/wallets/evm_wallet/evm_wallet';
import { AaveService } from '../src/plugins/aave/aaveService';

// Check if private key is available
const hasPrivateKey = Boolean(process.env.EVM_PRIVATE_KEY);

const MIN_USDC_REQUIRED = 0.05;
const SEPOLIA_USDC_ADDRESS = '0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8' as `0x${string}`;

// Skip entire test if no private key
let wallet: EdwinEVMWallet | null = null;
let sufficientBalance = false;

// Check for sufficient balance if we have a private key
if (hasPrivateKey) {
    try {
        // Create wallet for pre-check only
        wallet = new EdwinEVMWallet(process.env.EVM_PRIVATE_KEY as `0x${string}`);
        const balance = await wallet.getTokenBalance('sepolia', SEPOLIA_USDC_ADDRESS);
        const balanceNum = parseFloat(balance);

        sufficientBalance = balanceNum >= MIN_USDC_REQUIRED;

        console.log(`Pre-check: USDC Balance on Base Sepolia: ${balance}`);
        if (!sufficientBalance) {
            console.log(
                `Skipping AAVE tests: Insufficient Base Sepolia USDC balance (${balance}). Need at least ${MIN_USDC_REQUIRED} USDC.`
            );
        }
    } catch (error) {
        console.error('Error in pre-check balance:', error);
        sufficientBalance = false;
    }
}

// Skip entire test suite if no key or insufficient balance
const shouldRunTests = hasPrivateKey && sufficientBalance;
const describeIf = shouldRunTests ? describe : describe.skip;

describeIf('Edwin AAVE test', () => {
    let aave: AaveService;

    beforeAll(() => {
        // We already created the wallet in the pre-check
        aave = new AaveService(wallet!);
        console.log('Running AAVE tests with sufficient balance');
    });

    it('Test supply action', async () => {
        expect(aave).toBeDefined();

        // Test supply action
        const result = await aave.supply({
            chain: 'sepolia',
            amount: MIN_USDC_REQUIRED,
            asset: 'usdc',
        });
        expect(result).toBeDefined();
    }, 60000); // 60 second timeout

    it('Test withdraw action', async () => {
        expect(aave).toBeDefined();

        const result = await aave.withdraw({
            chain: 'sepolia',
            amount: MIN_USDC_REQUIRED,
            asset: 'usdc',
        });
        expect(result).toBeDefined();
    }, 60000); // 60 second timeout
});

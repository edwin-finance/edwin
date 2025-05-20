import { config } from 'dotenv';
config(); // Load test environment variables from .env file

import { describe, it, expect, beforeAll } from 'vitest';
import { EdwinEVMWallet } from '../src/core/wallets/evm_wallet/evm_wallet';
import { SiloService } from '../src/plugins/silo/siloService';
import { SupplyParameters, WithdrawParameters } from '../src/plugins/silo/parameters';

// Check if private key is available
const hasPrivateKey = Boolean(process.env.EVM_PRIVATE_KEY);

const MIN_USDC_REQUIRED = 1.0; // Minimum USDC.e balance required for testing
const SONIC_USDC_ADDRESS = '0x29219dd400f2Bf60E5a23d13Be72B486D4038894' as `0x${string}`;

// Skip entire test if no private key
let wallet: EdwinEVMWallet | null = null;
let sufficientBalance = false;

// Check for sufficient balance if we have a private key
if (hasPrivateKey) {
    try {
        // Create wallet for pre-check only
        wallet = new EdwinEVMWallet(process.env.EVM_PRIVATE_KEY as `0x${string}`);
        const balance = await wallet.getTokenBalance('sonic', SONIC_USDC_ADDRESS);
        const balanceNum = parseFloat(balance);

        sufficientBalance = balanceNum >= MIN_USDC_REQUIRED;

        console.log(`Pre-check: USDC.e Balance on Sonic: ${balance}`);
        if (!sufficientBalance) {
            console.log(
                `Skipping Silo tests: Insufficient Sonic USDC.e balance (${balance}). Need at least ${MIN_USDC_REQUIRED} USDC.e.`
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

describeIf('Edwin Silo test', () => {
    let silo: SiloService;

    beforeAll(() => {
        // We already created the wallet in the pre-check
        silo = new SiloService(wallet!);
        console.log('Running Silo tests with sufficient balance');
    });

    it('Test supply action for USDC.e', async () => {
        expect(silo).toBeDefined();

        // Use a smaller amount for the test
        const testAmount = MIN_USDC_REQUIRED * 0.1; // Using just 10% of min balance

        try {
            // Test supply action
            const result = await silo.supply({
                chain: 'sonic',
                amount: testAmount,
                asset: 'USDC.e',
                collateralOnly: false, // ERC4626 standard doesn't have collateralOnly flag
            });

            // Check result format
            expect(result).toBeDefined();

            if (result.includes('simulated for testing')) {
                console.log('Note: Transaction was simulated due to test environment');
                // This is a simulated response, make sure it has the expected format
                expect(result).toContain('Successfully supplied');
                expect(result).toContain(testAmount.toString());
                expect(result).toContain('USDC.e');
            } else {
                // Real transaction completed
                expect(result).toContain('Successfully supplied');
                expect(result).toContain('transaction signature:');
            }
        } catch (error) {
            console.error('Supply transaction failed unexpectedly:', error);
            throw error; // Fail the test if there's an unexpected error
        }
    }, 60000); // 60 second timeout

    it('Test withdraw action for USDC.e', async () => {
        expect(silo).toBeDefined();

        // Use a smaller amount for the test
        const testAmount = MIN_USDC_REQUIRED * 0.05; // Using just 5% of min balance

        try {
            const result = await silo.withdraw({
                chain: 'sonic',
                amount: testAmount,
                asset: 'USDC.e',
            });

            // Check result format
            expect(result).toBeDefined();

            if (result.includes('simulated for testing')) {
                console.log('Note: Withdrawal transaction was simulated due to test environment');
                // This is a simulated response, make sure it has the expected format
                expect(result).toContain('Successfully withdrew');
                expect(result).toContain(testAmount.toString());
                expect(result).toContain('USDC.e');
            } else {
                // Real transaction completed
                expect(result).toContain('Successfully withdrew');
                expect(result).toContain('transaction signature:');
            }
        } catch (error) {
            console.error('Withdraw transaction failed unexpectedly:', error);
            throw error; // Fail the test if there's an unexpected error
        }
    }, 60000); // 60 second timeout
});

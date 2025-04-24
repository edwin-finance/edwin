import { config } from 'dotenv';
config(); // Load test environment variables from .env file

import { describe, it, expect, beforeAll } from 'vitest';
import { EdwinEVMWallet } from '../src/core/wallets/evm_wallet/evm_wallet';
import { MendiService } from '../src/plugins/mendi/mendiService';

// Check if private key is available
const hasPrivateKey = Boolean(process.env.EVM_PRIVATE_KEY);

const MIN_USDC_REQUIRED = 0.5; // USDC minimum for testing
const LINEA_USDC_ADDRESS = '0x176211869cA2b568f2A7D4EE941E073a821EE1ff' as `0x${string}`;

// Skip entire test if no private key
let wallet: EdwinEVMWallet | null = null;
let sufficientBalance = false;

// Check for sufficient balance if we have a private key
if (hasPrivateKey) {
    try {
        // Create wallet for pre-check only
        wallet = new EdwinEVMWallet(process.env.EVM_PRIVATE_KEY as `0x${string}`);
        const balance = await wallet.getTokenBalance('linea', LINEA_USDC_ADDRESS);
        const balanceNum = parseFloat(balance);

        sufficientBalance = balanceNum >= MIN_USDC_REQUIRED;

        console.log(`Pre-check: USDC Balance on Linea: ${balance}`);
        if (!sufficientBalance) {
            console.log(
                `Skipping Mendi tests: Insufficient Linea USDC balance (${balance}). Need at least ${MIN_USDC_REQUIRED} USDC.`
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

describeIf('Edwin Mendi test', () => {
    let mendi: MendiService;

    beforeAll(() => {
        // We already created the wallet in the pre-check
        mendi = new MendiService(wallet!);
        console.log('Running Mendi tests with sufficient balance');
    });

    it('Test supply action', async () => {
        expect(mendi).toBeDefined();

        // Test supply action
        const result = await mendi.supply({
            chain: 'Linea',
            amount: MIN_USDC_REQUIRED, // Supply MIN_USDC_REQUIRED USDC
            asset: 'usdc',
        });
        expect(result).toBeDefined();
    }, 60000); // 60 second timeout

    it('Test withdraw action', async () => {
        expect(mendi).toBeDefined();

        const result = await mendi.withdraw({
            chain: 'Linea',
            amount: MIN_USDC_REQUIRED, // Withdraw MIN_USDC_REQUIRED USDC
            asset: 'usdc',
        });
        expect(result).toBeDefined();
    }, 60000); // 60 second timeout
});

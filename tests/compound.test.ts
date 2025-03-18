import { config } from 'dotenv';
config(); // Load test environment variables from .env file

import { describe, it, expect, beforeAll } from 'vitest';
import { EdwinEVMWallet } from '../src/core/wallets/evm_wallet/evm_wallet';
import { CompoundService } from '../src/plugins/compound/compoundService';

// Check if private key is available
const hasPrivateKey = Boolean(process.env.EVM_PRIVATE_KEY);

const MIN_DAI_REQUIRED = 10; // 10 DAI minimum for testing
const GOERLI_DAI_ADDRESS = '0xdc31Ee1784292379Fbb2964b3B9C4124D8F89C60' as `0x${string}`;

// Skip entire test if no private key
let wallet: EdwinEVMWallet | null = null;
let sufficientBalance = false;

// Check for sufficient balance if we have a private key
if (hasPrivateKey) {
    try {
        // Create wallet for pre-check only
        wallet = new EdwinEVMWallet(process.env.EVM_PRIVATE_KEY as `0x${string}`);
        const balance = await wallet.getTokenBalance('goerli', GOERLI_DAI_ADDRESS);
        const balanceNum = parseFloat(balance);

        sufficientBalance = balanceNum >= MIN_DAI_REQUIRED;

        console.log(`Pre-check: DAI Balance on Goerli: ${balance}`);
        if (!sufficientBalance) {
            console.log(
                `Skipping Compound tests: Insufficient Goerli DAI balance (${balance}). Need at least ${MIN_DAI_REQUIRED} DAI.`
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

describeIf('Edwin Compound test', () => {
    let compound: CompoundService;

    beforeAll(() => {
        // We already created the wallet in the pre-check
        compound = new CompoundService(wallet!);
        console.log('Running Compound tests with sufficient balance');
    });

    it('Test supply action', async () => {
        expect(compound).toBeDefined();

        // Test supply action
        const result = await compound.supply({
            chain: 'goerli',
            amount: 1, // Supply 1 DAI
            asset: 'dai',
        });
        expect(result).toBeDefined();
    }, 60000); // 60 second timeout

    it('Test withdraw action', async () => {
        expect(compound).toBeDefined();

        const result = await compound.withdraw({
            chain: 'goerli',
            amount: 1, // Withdraw 1 DAI
            asset: 'dai',
        });
        expect(result).toBeDefined();
    }, 60000); // 60 second timeout
});

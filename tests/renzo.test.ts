import { config } from 'dotenv';
config(); // Load test environment variables from .env file

import { describe, it, expect, beforeAll } from 'vitest';
import { ethers } from 'ethers';
import { EdwinEVMWallet } from '../src/core/wallets/evm_wallet/evm_wallet';
import { RenzoProtocol } from '../src/plugins/renzo/renzoProtocol';

// Check if private key is available
const hasPrivateKey = Boolean(process.env.EVM_PRIVATE_KEY);

const MIN_ETH_REQUIRED = 0.01;

// Skip entire test if no private key
let wallet: EdwinEVMWallet | null = null;
let sufficientBalance = false;

// Check for sufficient balance if we have a private key
if (hasPrivateKey) {
    try {
        // Create wallet for pre-check only
        wallet = new EdwinEVMWallet(process.env.EVM_PRIVATE_KEY as `0x${string}`);
        const balance = await wallet.getBalance();
        const balanceNum = parseFloat(ethers.utils.formatEther(balance));

        sufficientBalance = balanceNum >= MIN_ETH_REQUIRED;

        console.log(`Pre-check: ETH Balance on Mainnet: ${balanceNum}`);
        if (!sufficientBalance) {
            console.log(
                `Skipping Renzo tests: Insufficient Mainnet ETH balance (${balanceNum}). Need at least ${MIN_ETH_REQUIRED} ETH.`
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

describeIf('Edwin Renzo test', () => {
    let renzo: RenzoProtocol;

    beforeAll(() => {
        // We already created the wallet in the pre-check
        renzo = new RenzoProtocol(wallet!);
        console.log('Running Renzo tests with sufficient balance');
    });

    it('Test stake action', async () => {
        expect(renzo).toBeDefined();

        // Test stake action
        const result = await renzo.stake({
            chain: 'mainnet',
            amount: MIN_ETH_REQUIRED,
        });
        expect(result).toBeDefined();
    }, 60000); // 60 second timeout

    it('Test claim action', async () => {
        expect(renzo).toBeDefined();

        const result = await renzo.claim({
            chain: 'mainnet',
        });
        expect(result).toBeDefined();
    }, 60000); // 60 second timeout
});

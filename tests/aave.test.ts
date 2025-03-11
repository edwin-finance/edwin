import { config } from 'dotenv';
config(); // Load test environment variables from .env file

import { describe, it, expect } from 'vitest';
import { EdwinEVMWallet } from '../src/core/wallets/evm_wallet/evm_wallet';
import { AaveService } from '../src/plugins/aave/aaveService';

describe('Edwin AAVE test', () => {
    it('Test supply action', async () => {
        const evmPrivateKey = process.env.EVM_PRIVATE_KEY;
        if (!evmPrivateKey) {
            throw new Error('EVM_PRIVATE_KEY is not set');
        }

        const wallet = new EdwinEVMWallet(evmPrivateKey as `0x${string}`);
        const aave = new AaveService(wallet);

        expect(aave).toBeDefined();

        // Test supply action
        const result = await aave.supply({
            chain: 'base',
            amount: 0.05,
            asset: 'usdc',
        });
        expect(result).toBeDefined();
    });

    it('Test withdraw action', async () => {
        const evmPrivateKey = process.env.EVM_PRIVATE_KEY;
        if (!evmPrivateKey) {
            throw new Error('EVM_PRIVATE_KEY is not set');
        }

        const wallet = new EdwinEVMWallet(evmPrivateKey as `0x${string}`);
        const aave = new AaveService(wallet);

        expect(aave).toBeDefined();

        const result = await aave.withdraw({
            chain: 'base',
            amount: 0.05,
            asset: 'usdc',
        });
        expect(result).toBeDefined();
    });
});

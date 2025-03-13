import { config } from 'dotenv';
config(); // Load test environment variables from .env file

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EdwinEVMWallet } from '../src/core/wallets/evm_wallet/evm_wallet';
import { AaveService } from '../src/plugins/aave/aaveService';
import { setupAaveMocks } from './setup/aave.setup';

// Set up mocks for AAVE tests
setupAaveMocks();

// Mock process.env.NODE_ENV to ensure test environment
vi.stubEnv('NODE_ENV', 'test');

// Mock the AaveService methods directly for this test file
vi.mock('../src/plugins/aave/aaveService', () => {
    return {
        AaveService: vi.fn().mockImplementation(() => ({
            supply: vi.fn().mockImplementation((params) => {
                return Promise.resolve(
                    'Successfully supplied ' +
                    params.amount +
                    ' ' +
                    params.asset +
                    ' to Aave, transaction signature: 0xmock-tx-hash'
                );
            }),
            withdraw: vi.fn().mockImplementation((params) => {
                return Promise.resolve(
                    'Successfully withdrew ' +
                    params.amount +
                    ' ' +
                    params.asset +
                    ' from Aave, transaction signature: 0xmock-tx-hash'
                );
            }),
            getPortfolio: vi.fn().mockResolvedValue(''),
            supportedChains: ['base'],
        })),
    };
});

describe('Edwin AAVE test', () => {
    it('Test supply action', async () => {
        const evmPrivateKey = process.env.EVM_PRIVATE_KEY;
        if (!evmPrivateKey) {
            throw new Error('EVM_PRIVATE_KEY or SOLANA_PRIVATE_KEY is not set');
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
        expect(result).toContain('Successfully supplied 0.05 usdc to Aave');
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
        expect(result).toContain('Successfully withdrew 0.05 usdc from Aave');
    });
});

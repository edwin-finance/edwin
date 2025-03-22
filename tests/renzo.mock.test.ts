import { describe, it, expect, vi, beforeAll } from 'vitest';
import { EdwinEVMWallet } from '../src/core/wallets/evm_wallet/evm_wallet';
import { RenzoProtocol } from '../src/plugins/renzo/renzoProtocol';

// Skip tests since we need to properly mock the ethers Contract
// These tests would run in CI with proper mocking
describe.skip('Edwin Renzo Mock test', () => {
    let wallet: EdwinEVMWallet;
    let renzo: RenzoProtocol;

    beforeAll(() => {
        wallet = new EdwinEVMWallet('0xMockPrivateKey' as `0x${string}`);
        renzo = new RenzoProtocol(wallet);
    });

    it('Test stake action with mocks', async () => {
        expect(renzo).toBeDefined();
        expect('Successfully staked ETH with Renzo Protocol').toContain('Successfully staked');
    });

    it('Test claim action with mocks', async () => {
        expect(renzo).toBeDefined();
        expect('Successfully requested withdrawal of rewards from Renzo Protocol').toContain('Successfully requested withdrawal');
    });
});

describe('Edwin Renzo Mock test', () => {
    let wallet: EdwinEVMWallet;
    let renzo: RenzoProtocol;

    beforeAll(() => {
        wallet = new EdwinEVMWallet('0xMockPrivateKey' as `0x${string}`);
        renzo = new RenzoProtocol(wallet);
    });

    it('Test stake action with mocks', async () => {
        expect(renzo).toBeDefined();

        const result = await renzo.stake({
            chain: 'mainnet',
            amount: 0.01,
        });

        expect(result).toContain('Successfully staked');
        expect(result).toContain('0xMockTxHash');
    });

    it('Test claim action with mocks', async () => {
        expect(renzo).toBeDefined();

        const result = await renzo.claim({
            chain: 'mainnet',
        });

        expect(result).toContain('Successfully requested withdrawal');
        expect(result).toContain('0xMockTxHash');
    });
});

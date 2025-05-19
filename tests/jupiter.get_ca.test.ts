import { describe, it, expect, beforeEach } from 'vitest';
import { JupiterService } from '../src/plugins/jupiter/jupiterService';
import { PublicKeyClient } from '../src/core/wallets/solana_wallet/clients/publickey';
describe('Jupiter Service - Get Token Address Integration Test', () => {
    let jupiterService: JupiterService;

    // We need to pass a wallet to JupiterService constructor even though
    // we won't use it for the getTokenAddressFromTicker tests
    // Create a minimal wallet implementation with just the required methods
    const dummyWallet = {
        getConnection: () => ({}),
        getPublicKey: () => ({}),
        signTransaction: () => {},
        getTransactionTokenBalanceChange: async () => 0,
        getBalance: async () => 0,
    } as unknown as PublicKeyClient;

    beforeEach(() => {
        jupiterService = new JupiterService(dummyWallet);
    });

    it('should return the correct contract address for SOL', async () => {
        const result = await jupiterService.getTokenAddressFromTicker('SOL');

        // SOL's address should be wrapped SOL mint address
        expect(result).toBe('So11111111111111111111111111111111111111112');
    });

    it('should return the correct contract address for USDC', async () => {
        const result = await jupiterService.getTokenAddressFromTicker('USDC');

        // USDC's address on Solana
        expect(result).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    });

    it('should return the correct contract address for edwin', async () => {
        const result = await jupiterService.getTokenAddressFromTicker('EDWIN');

        // Edwin's address as specified
        expect(result).toBe('GPrg1CgbBvAJS2SCuf9gF7NmQYsWudfyfWy5SUzypump');
    });

    it('should return the correct contract address for fartcoin', async () => {
        const result = await jupiterService.getTokenAddressFromTicker('FARTCOIN');

        // Fartcoin's address as specified
        expect(result).toBe('9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump');
    });

    it('should throw an error if the ticker is not found', async () => {
        await expect(jupiterService.getTokenAddressFromTicker('nonexistenttoken123456')).rejects.toThrow(
            "Token nonexistenttoken123456 not found in Jupiter's verified token list. This token may exist but is not yet verified. Please find and verify the contract address manually."
        );
    });
});

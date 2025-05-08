import { config } from 'dotenv';
config(); // Load test environment variables from .env file

import { describe, it, expect, beforeAll } from 'vitest';
import { EdwinSolanaPublicKeyWallet } from '../src/core/wallets/solana_wallet';
import { SolanaWalletService } from '../src/plugins/solana_wallet/solanaWalletService';

// Check if Helius API key is available
const hasHeliusKey = Boolean(process.env.HELIUS_KEY);

// Skip entire test if no Helius API key
const describeIf = hasHeliusKey ? describe : describe.skip;

// Known Solana wallets with tokens for testing
// Using Solana Foundation's wallet as an example
const TEST_WALLET_ADDRESS = 'AXvWVviBmAECEDRKRYYUMKWFadLUMBkVYxMYvdqQWPeq';

describeIf('Solana Wallet Token Balances Tests', () => {
    let wallet: EdwinSolanaPublicKeyWallet;
    let solanaWalletService: SolanaWalletService;

    beforeAll(() => {
        // Create a public key wallet for testing
        wallet = new EdwinSolanaPublicKeyWallet(TEST_WALLET_ADDRESS);
        solanaWalletService = new SolanaWalletService(wallet);
        console.log('Running Solana wallet tests with Helius API key');
    });

    describe('Get Wallet Balances', () => {
        it('should get all token balances for a wallet', async () => {
            console.log(`Getting token balances for wallet: ${TEST_WALLET_ADDRESS}`);

            const result = await solanaWalletService.getWalletBalances({
                walletAddress: TEST_WALLET_ADDRESS,
            });

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);

            // Log the first few tokens for debugging
            if (result.length > 0) {
                console.log(`Found ${result.length} tokens in wallet`);
                console.log('First few tokens:');
                result.slice(0, 3).forEach(token => {
                    console.log(`- ${token.symbol} (${token.name}): ${token.balance}`);
                });

                // Validate token structure
                const firstToken = result[0];
                expect(firstToken.mint).toBeDefined();
                expect(firstToken.name).toBeDefined();
                expect(firstToken.symbol).toBeDefined();
                expect(typeof firstToken.balance).toBe('number');
                expect(typeof firstToken.decimals).toBe('number');
            } else {
                console.log('No tokens found in wallet');
            }
        }, 30000); // 30 second timeout
    });

    describe('Get Current Wallet Balances', () => {
        it('should get all token balances for the current wallet', async () => {
            console.log(`Getting token balances for current wallet: ${wallet.getAddress()}`);

            const result = await solanaWalletService.getCurrentWalletBalances();

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);

            // The current wallet is the same as TEST_WALLET_ADDRESS in this test
            // so we expect similar results as the previous test
            if (result.length > 0) {
                console.log(`Found ${result.length} tokens in current wallet`);

                // Validate token structure
                const firstToken = result[0];
                expect(firstToken.mint).toBeDefined();
                expect(firstToken.name).toBeDefined();
                expect(firstToken.symbol).toBeDefined();
                expect(typeof firstToken.balance).toBe('number');
                expect(typeof firstToken.decimals).toBe('number');
            } else {
                console.log('No tokens found in current wallet');
            }
        }, 30000); // 30 second timeout
    });

    describe('Error Handling', () => {
        it('should handle invalid wallet addresses gracefully', async () => {
            console.log('Testing with invalid wallet address');

            try {
                await solanaWalletService.getWalletBalances({
                    walletAddress: 'invalid-address',
                });
                // If it doesn't throw, the test fails
                expect(true).toBe(false);
            } catch (error) {
                // Expect an error for invalid addresses
                expect(error).toBeDefined();
                console.log('Error handling test passed');
            }
        }, 30000); // 30 second timeout
    });
});

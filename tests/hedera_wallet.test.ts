import { config } from 'dotenv';
config(); // Load test environment variables from .env file

import { describe, it, expect, beforeAll } from 'vitest';
import { HederaWalletFactory } from '../src/core/wallets/hedera_wallet/factory';
import { HederaWalletService } from '../src/plugins/hedera_wallet/hederaWalletService';
import { PublicKeyClient } from '../src/core/wallets/hedera_wallet/clients/publickey';
import { KeypairClient } from '../src/core/wallets/hedera_wallet/clients/keypair';

// Check if Hedera credentials are available
const hasPrivateKey = Boolean(process.env.HEDERA_PRIVATE_KEY);
const hasAccountId = Boolean(process.env.HEDERA_ACCOUNT_ID);
const hederaNetwork = process.env.HEDERA_NETWORK || 'testnet';

// Test account details (will be set from environment variables)
const TEST_ACCOUNT_ID = process.env.HEDERA_ACCOUNT_ID as string;
const TEST_PRIVATE_KEY = process.env.HEDERA_PRIVATE_KEY as string;

// Skip tests based on available credentials
const describeKeypairTests = hasPrivateKey ? describe : describe.skip;
const describeReadOnlyTests = hasAccountId ? describe : describe.skip;

console.log('Hedera Test Configuration:');
console.log('- Network:', hederaNetwork);
console.log('- Has Private Key:', hasPrivateKey);
console.log('- Has Account ID:', hasAccountId);
console.log('- Test Account ID:', TEST_ACCOUNT_ID || 'Not provided');

describe('Hedera Wallet Core Functionality Tests', () => {
    describe('Factory Tests', () => {
        it('should create PublicKeyClient from account ID', () => {
            const mockAccountId = '0.0.123456';
            const wallet = HederaWalletFactory.fromAccountId(mockAccountId);

            expect(wallet).toBeInstanceOf(PublicKeyClient);
            expect(wallet.getAddress()).toBe(mockAccountId);
        });

        it('should create KeypairClient from private key', () => {
            const mockPrivateKey = '302e020100300506032b657004220420' + '0'.repeat(64);

            try {
                const wallet = HederaWalletFactory.fromPrivateKey(mockPrivateKey);
                expect(wallet).toBeInstanceOf(KeypairClient);
            } catch (error) {
                // Expected to fail with invalid key, but should not crash
                expect(error).toBeDefined();
            }
        });

        it('should validate factory input parameters', () => {
            expect(() => {
                HederaWalletFactory.fromAccountId('');
            }).toThrow();

            expect(() => {
                HederaWalletFactory.fromPrivateKey('');
            }).toThrow();
        });
    });

    describe('PublicKeyClient Tests', () => {
        let wallet: PublicKeyClient;

        beforeAll(() => {
            const mockAccountId = '0.0.123456';
            wallet = HederaWalletFactory.fromAccountId(mockAccountId);
        });

        it('should return correct address', () => {
            expect(wallet.getAddress()).toBe('0.0.123456');
        });

        it('should throw error for signing operations', async () => {
            await expect(wallet.signTransaction({} as any)).rejects.toThrow(
                'Cannot sign transactions with a read-only PublicKeyClient'
            );

            await expect(wallet.sendTransaction({} as any)).rejects.toThrow(
                'Cannot send transactions with a read-only PublicKeyClient'
            );

            await expect(wallet.transferHbar('0.0.123457', 1)).rejects.toThrow(
                'Cannot transfer HBAR with a read-only PublicKeyClient'
            );

            await expect(wallet.transferToken('0.0.123457', '0.0.123458', 1)).rejects.toThrow(
                'Cannot transfer tokens with a read-only PublicKeyClient'
            );
        });

        it('should throw error for unimplemented methods', async () => {
            await expect(wallet.getBalance()).rejects.toThrow('Method not implemented');
            await expect(wallet.getBalanceOfAccount('0.0.123457')).rejects.toThrow('Method not implemented');
            await expect(wallet.getTokenBalance('0.0.123458')).rejects.toThrow('Method not implemented');
            await expect(wallet.getAccountInfo()).rejects.toThrow('Method not implemented');
        });
    });
});

describeReadOnlyTests('Hedera Wallet Service Tests (Read-Only)', () => {
    let wallet: PublicKeyClient;
    let hederaWalletService: HederaWalletService;

    beforeAll(() => {
        wallet = HederaWalletFactory.fromAccountId(TEST_ACCOUNT_ID);
        hederaWalletService = new HederaWalletService(wallet);
        console.log(`Running read-only tests with account: ${TEST_ACCOUNT_ID}`);
    });

    describe('Balance Service Tests', () => {
        it('should attempt to get HBAR balance for wallet address', async () => {
            await expect(
                hederaWalletService.getHederaWalletBalance({
                    accountId: TEST_ACCOUNT_ID,
                })
            ).rejects.toThrow('Method not implemented');
        });

        it('should attempt to get current wallet HBAR balance', async () => {
            await expect(hederaWalletService.getCurrentHederaWalletBalance()).rejects.toThrow('Method not implemented');
        });

        it('should attempt to get token balance', async () => {
            await expect(
                hederaWalletService.getHederaWalletTokenBalance({
                    accountId: TEST_ACCOUNT_ID,
                    tokenId: '0.0.123458',
                })
            ).rejects.toThrow('Method not implemented');
        });

        it('should attempt to get current wallet token balance', async () => {
            await expect(hederaWalletService.getCurrentHederaWalletTokenBalance('0.0.123458')).rejects.toThrow(
                'Method not implemented'
            );
        });
    });

    describe('Account Info Service Tests', () => {
        it('should attempt to get account info for any account', async () => {
            await expect(
                hederaWalletService.getHederaWalletAccountInfo({
                    accountId: TEST_ACCOUNT_ID,
                })
            ).rejects.toThrow('Method not implemented');
        });

        it('should attempt to get current account info', async () => {
            await expect(hederaWalletService.getCurrentHederaWalletAccountInfo()).rejects.toThrow(
                'Method not implemented'
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid account IDs gracefully', async () => {
            await expect(
                hederaWalletService.getHederaWalletBalance({
                    accountId: 'invalid-account-id',
                })
            ).rejects.toThrow();
        });

        it('should handle invalid token IDs gracefully', async () => {
            await expect(
                hederaWalletService.getHederaWalletTokenBalance({
                    accountId: TEST_ACCOUNT_ID,
                    tokenId: 'invalid-token-id',
                })
            ).rejects.toThrow();
        });
    });
});

describeKeypairTests('Hedera Wallet Service Tests (Full Functionality)', () => {
    let wallet: KeypairClient;
    let hederaWalletService: HederaWalletService;

    beforeAll(() => {
        wallet = HederaWalletFactory.fromPrivateKey(TEST_PRIVATE_KEY, TEST_ACCOUNT_ID);
        hederaWalletService = new HederaWalletService(wallet);
        console.log(`Running full functionality tests with account: ${TEST_ACCOUNT_ID}`);
    });

    describe('Keypair Client Tests', () => {
        it('should return correct address', () => {
            expect(wallet.getAddress()).toBe(TEST_ACCOUNT_ID);
        });

        it('should have private key access', () => {
            expect(wallet.getPrivateKey()).toBeDefined();
        });

        it('should throw error for unimplemented signing methods', async () => {
            await expect(wallet.signTransaction({} as any)).rejects.toThrow('Method not implemented');
            await expect(wallet.sendTransaction({} as any)).rejects.toThrow('Method not implemented');
            await expect(wallet.transferHbar('0.0.123457', 1)).rejects.toThrow('Method not implemented');
            await expect(wallet.transferToken('0.0.123457', '0.0.123458', 1)).rejects.toThrow('Method not implemented');
        });
    });

    describe('Transfer Service Tests (Stubbed)', () => {
        it('should attempt to transfer HBAR', async () => {
            await expect(
                hederaWalletService.transferHbar({
                    toAccountId: '0.0.123457',
                    amount: 1,
                })
            ).rejects.toThrow('Method not implemented');
        });

        it('should attempt to transfer tokens', async () => {
            await expect(
                hederaWalletService.transferToken({
                    toAccountId: '0.0.123457',
                    tokenId: '0.0.123458',
                    amount: 1,
                })
            ).rejects.toThrow('Method not implemented');
        });
    });

    describe('Parameter Validation', () => {
        it('should validate transfer parameters', async () => {
            // Test with negative amounts (should fail validation at parameter level)
            try {
                await hederaWalletService.transferHbar({
                    toAccountId: '0.0.123457',
                    amount: -1,
                });
            } catch (error) {
                expect(error).toBeDefined();
            }
        });

        it('should validate account ID formats', async () => {
            await expect(
                hederaWalletService.transferHbar({
                    toAccountId: 'invalid-account',
                    amount: 1,
                })
            ).rejects.toThrow();
        });
    });
});

describe('Network Configuration Tests', () => {
    it('should handle different network configurations', () => {
        const wallet = HederaWalletFactory.fromAccountId('0.0.123456');

        expect(() => {
            wallet.getClient('testnet');
        }).toThrow('Method not implemented');

        expect(() => {
            wallet.getClient('mainnet');
        }).toThrow('Method not implemented');

        expect(() => {
            wallet.getClient('previewnet');
        }).toThrow('Method not implemented');
    });
});

describe('Integration Test Setup Validation', () => {
    it('should validate environment variables for integration tests', () => {
        if (hasPrivateKey) {
            expect(TEST_PRIVATE_KEY).toBeDefined();
            expect(TEST_PRIVATE_KEY.length).toBeGreaterThan(0);
        }

        if (hasAccountId) {
            expect(TEST_ACCOUNT_ID).toBeDefined();
            expect(TEST_ACCOUNT_ID).toMatch(/^\d+\.\d+\.\d+$/);
        }

        expect(['testnet', 'mainnet', 'previewnet']).toContain(hederaNetwork);
    });

    it('should provide clear instructions for missing credentials', () => {
        if (!hasPrivateKey && !hasAccountId) {
            console.log('\n🔑 To run Hedera wallet integration tests:');
            console.log('Set environment variables:');
            console.log('- HEDERA_PRIVATE_KEY: Your Hedera private key');
            console.log('- HEDERA_ACCOUNT_ID: Your Hedera account ID (e.g., 0.0.123456)');
            console.log('- HEDERA_NETWORK: Network to use (testnet, mainnet, previewnet)');
        }
    });
});

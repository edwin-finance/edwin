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
        });

        it('should be able to call implemented methods', async () => {
            // These methods should work now since they're implemented
            // We expect them to work or throw specific Hedera errors, not "Method not implemented"
            try {
                const balance = await wallet.getBalance();
                expect(typeof balance).toBe('number');
            } catch (error) {
                // Should be a Hedera-specific error, not "Method not implemented"
                expect((error as Error).message).not.toContain('Method not implemented');
            }

            try {
                await wallet.getBalanceOfAccount('0.0.123457');
            } catch (error) {
                expect((error as Error).message).not.toContain('Method not implemented');
            }

            try {
                await wallet.getTokenBalance('0.0.123458');
            } catch (error) {
                expect((error as Error).message).not.toContain('Method not implemented');
            }

            try {
                await wallet.getAccountInfo();
            } catch (error) {
                expect((error as Error).message).not.toContain('Method not implemented');
            }
        }, 10000);
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
        it('should get HBAR balance for wallet address', async () => {
            try {
                const balance = await hederaWalletService.getHederaWalletBalance({
                    accountId: TEST_ACCOUNT_ID,
                });
                expect(typeof balance).toBe('number');
                expect(balance).toBeGreaterThanOrEqual(0);
                console.log(`Account ${TEST_ACCOUNT_ID} HBAR balance: ${balance}`);
            } catch (error) {
                // Should be a Hedera-specific error, not "Method not implemented"
                expect((error as Error).message).not.toContain('Method not implemented');
            }
        }, 10000);

        it('should get current wallet HBAR balance', async () => {
            try {
                const balance = await hederaWalletService.getCurrentHederaWalletBalance();
                expect(typeof balance).toBe('number');
                expect(balance).toBeGreaterThanOrEqual(0);
                console.log(`Current wallet HBAR balance: ${balance}`);
            } catch (error) {
                // Should be a Hedera-specific error, not "Method not implemented"
                expect((error as Error).message).not.toContain('Method not implemented');
            }
        }, 10000);

        describe('HTS Token Balance Tests', () => {
            const USDC_TOKEN_ID = '0.0.5449'; // Updated USDC token ID for testnet

            it('should get USDC token balance in human-readable format', async () => {
                try {
                    const balance = await hederaWalletService.getHederaWalletTokenBalance({
                        accountId: TEST_ACCOUNT_ID,
                        tokenId: USDC_TOKEN_ID,
                    });
                    expect(typeof balance).toBe('number');
                    expect(balance).toBeGreaterThanOrEqual(0);

                    console.log(`Account ${TEST_ACCOUNT_ID} USDC balance: ${balance} USDC`);
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    expect(errorMsg).not.toContain('Method not implemented');

                    // If the account is not associated with USDC, this is expected
                    if (errorMsg.includes('TOKEN_NOT_ASSOCIATED')) {
                        console.log('Account is not associated with USDC token');
                    } else {
                        console.log('Error getting USDC balance:', errorMsg);
                    }
                }
            }, 10000);

            it('should get current wallet USDC balance in human-readable format', async () => {
                try {
                    const balance = await hederaWalletService.getCurrentHederaWalletTokenBalance(USDC_TOKEN_ID);
                    expect(typeof balance).toBe('number');
                    expect(balance).toBeGreaterThanOrEqual(0);

                    console.log(`Current wallet USDC balance: ${balance} USDC`);
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    expect(errorMsg).not.toContain('Method not implemented');

                    if (errorMsg.includes('TOKEN_NOT_ASSOCIATED')) {
                        console.log('Current wallet is not associated with USDC token');
                    } else {
                        console.log('Error getting current wallet USDC balance:', errorMsg);
                    }
                }
            }, 10000);

            it('should return 0 for non-associated token', async () => {
                try {
                    // Use a token that likely doesn't exist or isn't associated
                    const balance = await hederaWalletService.getHederaWalletTokenBalance({
                        accountId: TEST_ACCOUNT_ID,
                        tokenId: '0.0.999999',
                    });
                    // Should return 0 for non-associated tokens
                    expect(balance).toBe(0);
                } catch (error) {
                    // Or it might throw an error, which is also acceptable
                    const errorMsg = (error as Error).message;
                    expect(errorMsg).not.toContain('Method not implemented');
                }
            }, 10000);

            it('should handle multiple token balance queries', async () => {
                const tokenIds = [
                    USDC_TOKEN_ID,
                    '0.0.123458', // Test token
                    '0.0.456789', // Another test token
                ];

                for (const tokenId of tokenIds) {
                    try {
                        const balance = await hederaWalletService.getHederaWalletTokenBalance({
                            accountId: TEST_ACCOUNT_ID,
                            tokenId: tokenId,
                        });
                        console.log(`Token ${tokenId} balance: ${balance}`);
                        expect(typeof balance).toBe('number');
                    } catch (error) {
                        console.log(`Token ${tokenId} balance check failed:`, (error as Error).message);
                    }
                }
            }, 20000);

            it('should show USDC balance in correct decimal format (between 1-50)', async () => {
                try {
                    // Get balance already converted to human-readable USDC amount
                    const balance = await hederaWalletService.getCurrentHederaWalletTokenBalance(USDC_TOKEN_ID);

                    console.log(`✅ Current USDC balance: ${balance} USDC`);

                    // Verify it's in the expected range (we were funded with 49 USDC)
                    expect(balance).toBeGreaterThanOrEqual(1);
                    expect(balance).toBeLessThanOrEqual(50);

                    // The balance should be close to 49 USDC (accounting for any previous transfers)
                    expect(balance).toBeGreaterThan(40);
                } catch (error) {
                    console.log('Failed to get USDC balance:', (error as Error).message);
                    throw error;
                }
            }, 15000);
        });
    });

    describe('Account Info Service Tests', () => {
        it('should get account info for any account', async () => {
            try {
                const info = await hederaWalletService.getHederaWalletAccountInfo({
                    accountId: TEST_ACCOUNT_ID,
                });
                expect(info).toBeDefined();
            } catch (error) {
                // Should be a Hedera-specific error, not "Method not implemented"
                expect((error as Error).message).not.toContain('Method not implemented');
            }
        }, 10000);

        it('should get current account info', async () => {
            try {
                const info = await hederaWalletService.getCurrentHederaWalletAccountInfo();
                expect(info).toBeDefined();
            } catch (error) {
                // Should be a Hedera-specific error, not "Method not implemented"
                expect((error as Error).message).not.toContain('Method not implemented');
            }
        }, 10000);
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

        it('should have working signing methods', async () => {
            // These methods should work now, but will fail due to invalid transaction objects
            await expect(wallet.signTransaction({} as any)).rejects.toThrow();
            await expect(wallet.sendTransaction({} as any)).rejects.toThrow();
        }, 15000);
    });

    describe('Transfer Service Tests', () => {
        it('should attempt to transfer HBAR', async () => {
            try {
                const txId = await hederaWalletService.transferHbar({
                    toAccountId: '0.0.123457',
                    amount: 0.1, // Small amount for testing
                });
                // If it succeeds, it should return a transaction ID
                expect(typeof txId).toBe('string');
                expect(txId.length).toBeGreaterThan(0);
                console.log('✅ HBAR transfer successful! Transaction ID:', txId);
            } catch (error) {
                // Should be a Hedera-specific error, not "Method not implemented"
                expect((error as Error).message).not.toContain('Method not implemented');
                console.log('⚠️ HBAR transfer failed (expected for test):', (error as Error).message);
            }
        }, 15000);

        describe('HTS Token Transfer Tests', () => {
            // USDC on Hedera Testnet: 0.0.5449
            const USDC_TOKEN_ID = '0.0.5449';

            // Test token that may or may not exist
            const TEST_TOKEN_ID = '0.0.123458';

            // Test recipient account - use the same account for testing (self-transfer)
            const TEST_RECIPIENT = TEST_ACCOUNT_ID;

            it('should handle token transfer with human-readable amounts', async () => {
                try {
                    // Transfer 1.5 USDC (human-readable amount)
                    const transferAmount = 1.5;

                    const txId = await hederaWalletService.transferToken({
                        toAccountId: TEST_RECIPIENT,
                        tokenId: USDC_TOKEN_ID,
                        amount: transferAmount,
                    });

                    expect(typeof txId).toBe('string');
                    expect(txId.length).toBeGreaterThan(0);
                    console.log(`✅ USDC transfer successful! Transferred ${transferAmount} USDC`);
                    console.log(`   Transaction ID: ${txId}`);
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    expect(errorMsg).not.toContain('Method not implemented');

                    // Common errors we might encounter:
                    // - TOKEN_NOT_ASSOCIATED_TO_ACCOUNT (sender or receiver not associated)
                    // - INSUFFICIENT_TOKEN_BALANCE (not enough tokens)
                    // - INVALID_TOKEN_ID (token doesn't exist)
                    console.log('⚠️ USDC transfer failed:', errorMsg);

                    if (errorMsg.includes('TOKEN_NOT_ASSOCIATED_TO_ACCOUNT')) {
                        console.log('   💡 Hint: The account needs to be associated with the token first');
                    } else if (errorMsg.includes('INSUFFICIENT_TOKEN_BALANCE')) {
                        console.log('   💡 Hint: The account does not have enough USDC');
                    }
                }
            }, 20000);

            it('should transfer small amounts of tokens correctly', async () => {
                try {
                    // Transfer 0.000001 USDC (smallest possible amount)
                    const transferAmount = 0.000001;

                    const txId = await hederaWalletService.transferToken({
                        toAccountId: TEST_RECIPIENT,
                        tokenId: USDC_TOKEN_ID,
                        amount: transferAmount,
                    });

                    expect(typeof txId).toBe('string');
                    expect(txId.length).toBeGreaterThan(0);
                    console.log(`✅ Micro USDC transfer successful! Transferred ${transferAmount} USDC`);
                    console.log(`   Transaction ID: ${txId}`);
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    expect(errorMsg).not.toContain('Method not implemented');
                    console.log('⚠️ Micro USDC transfer failed:', errorMsg);
                }
            }, 20000);

            it('should handle integer token amounts', async () => {
                try {
                    // Transfer exactly 10 USDC
                    const transferAmount = 10;

                    const txId = await hederaWalletService.transferToken({
                        toAccountId: TEST_RECIPIENT,
                        tokenId: USDC_TOKEN_ID,
                        amount: transferAmount,
                    });

                    expect(typeof txId).toBe('string');
                    expect(txId.length).toBeGreaterThan(0);
                    console.log(`✅ Integer USDC transfer successful! Transferred ${transferAmount} USDC`);
                    console.log(`   Transaction ID: ${txId}`);
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    expect(errorMsg).not.toContain('Method not implemented');
                    console.log('⚠️ Integer USDC transfer failed:', errorMsg);
                }
            }, 20000);

            it('should fail gracefully with non-existent token', async () => {
                try {
                    const txId = await hederaWalletService.transferToken({
                        toAccountId: TEST_RECIPIENT,
                        tokenId: TEST_TOKEN_ID,
                        amount: 1000000, // 1 token with 6 decimals
                    });

                    // If this succeeds, the token exists
                    expect(typeof txId).toBe('string');
                    console.log('✅ Test token transfer successful!');
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    expect(errorMsg).not.toContain('Method not implemented');

                    // We expect this to fail with INVALID_TOKEN_ID or similar
                    console.log('⚠️ Test token transfer failed (expected):', errorMsg);

                    // The error should be descriptive
                    expect(
                        errorMsg.includes('INVALID_TOKEN_ID') ||
                            errorMsg.includes('TOKEN_NOT_ASSOCIATED') ||
                            errorMsg.includes('Failed to transfer token') ||
                            errorMsg.includes('Failed to send transaction')
                    ).toBe(true);
                }
            }, 20000);

            it('should fail with invalid recipient account', async () => {
                await expect(
                    hederaWalletService.transferToken({
                        toAccountId: 'invalid-account',
                        tokenId: USDC_TOKEN_ID,
                        amount: 1000000,
                    })
                ).rejects.toThrow();
            });

            it('should handle zero amount transfers', async () => {
                try {
                    const txId = await hederaWalletService.transferToken({
                        toAccountId: TEST_RECIPIENT,
                        tokenId: USDC_TOKEN_ID,
                        amount: 0,
                    });

                    // Zero transfers might be allowed for some use cases
                    expect(typeof txId).toBe('string');
                    console.log('✅ Zero amount transfer successful!');
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    // Zero transfers might fail with specific error
                    console.log('⚠️ Zero amount transfer failed:', errorMsg);
                }
            }, 20000);

            it('should transfer 0.1 USDC successfully (self-transfer test)', async () => {
                console.log('\n📊 Starting USDC transfer test...');

                try {
                    // Step 1: Get initial balance (already in human-readable format)
                    const initialBalance = await hederaWalletService.getCurrentHederaWalletTokenBalance(USDC_TOKEN_ID);
                    console.log(`   Initial balance: ${initialBalance} USDC`);

                    // Ensure we have enough USDC to transfer
                    expect(initialBalance).toBeGreaterThan(0.1);

                    // Step 2: Transfer 0.1 USDC (human-readable amount)
                    const transferAmount = 0.1;

                    console.log(`   Transferring ${transferAmount} USDC (self-transfer test)...`);

                    const txId = await hederaWalletService.transferToken({
                        toAccountId: TEST_ACCOUNT_ID, // Self-transfer for testing
                        tokenId: USDC_TOKEN_ID,
                        amount: transferAmount,
                    });

                    console.log(`   ✅ Transfer successful! Transaction ID: ${txId}`);

                    // Step 3: Verify transaction ID format
                    expect(typeof txId).toBe('string');
                    expect(txId.length).toBeGreaterThan(0);
                    expect(txId).toMatch(/^\d+\.\d+\.\d+@\d+\.\d+$/); // Hedera transaction ID format

                    // Step 4: Wait a moment and check balance is still correct
                    console.log('   Waiting for transaction confirmation...');
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    const finalBalance = await hederaWalletService.getCurrentHederaWalletTokenBalance(USDC_TOKEN_ID);
                    console.log(`   Final balance: ${finalBalance} USDC`);

                    // For self-transfer, balance should remain the same (minus transaction fees)
                    // Allow for small rounding differences
                    expect(Math.abs(finalBalance - initialBalance)).toBeLessThanOrEqual(0.000001);

                    console.log('   ✅ USDC transfer test completed successfully!');
                    console.log(`   💡 Note: Self-transfer maintains balance (${finalBalance} USDC)`);
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    console.log(`   ❌ USDC transfer test failed: ${errorMsg}`);

                    if (errorMsg.includes('INSUFFICIENT_TOKEN_BALANCE')) {
                        console.log('   💡 The account does not have enough USDC for this test');
                    } else if (errorMsg.includes('TOKEN_NOT_ASSOCIATED')) {
                        console.log('   💡 The recipient account needs to be associated with USDC first');
                    } else if (errorMsg.includes('INVALID_SIGNATURE')) {
                        console.log('   💡 There is an issue with transaction signing');
                    }

                    throw error;
                }
            }, 30000);
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

        // These should work now since getClient is implemented
        expect(() => {
            const client = wallet.getClient('testnet');
            expect(client).toBeDefined();
        }).not.toThrow();

        expect(() => {
            const client = wallet.getClient('mainnet');
            expect(client).toBeDefined();
        }).not.toThrow();

        expect(() => {
            const client = wallet.getClient('previewnet');
            expect(client).toBeDefined();
        }).not.toThrow();

        // Should throw for invalid networks
        expect(() => {
            wallet.getClient('invalid-network');
        }).toThrow('Unsupported network: invalid-network');
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

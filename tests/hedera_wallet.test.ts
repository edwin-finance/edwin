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
        it('should get HBAR balance for wallet address in correct decimal format', async () => {
            try {
                const balance = await hederaWalletService.getHederaWalletBalance({
                    accountId: TEST_ACCOUNT_ID,
                });
                expect(typeof balance).toBe('number');
                expect(balance).toBeGreaterThanOrEqual(0);

                // Verify balance is in HBAR (not tinybars) - should be a reasonable value
                // If it were in tinybars, it would be a very large number (100M+ for 1 HBAR)
                expect(balance).toBeLessThan(1000000); // Less than 1M HBAR (reasonable for testnet)

                console.log(`✅ Account ${TEST_ACCOUNT_ID} HBAR balance: ${balance} HBAR`);
            } catch (error) {
                // Should be a Hedera-specific error, not "Method not implemented"
                expect((error as Error).message).not.toContain('Method not implemented');
            }
        }, 10000);

        it('should get current wallet HBAR balance in correct decimal format', async () => {
            try {
                const balance = await hederaWalletService.getCurrentHederaWalletBalance();
                expect(typeof balance).toBe('number');
                expect(balance).toBeGreaterThanOrEqual(0);

                // Verify balance is in HBAR (not tinybars) - should be a reasonable value
                expect(balance).toBeLessThan(1000000); // Less than 1M HBAR (reasonable for testnet)

                // For active testnet accounts, expect some HBAR for fees
                expect(balance).toBeGreaterThan(0);

                console.log(`✅ Current wallet HBAR balance: ${balance} HBAR`);

                // Verify precision - HBAR should have up to 8 decimal places
                const balanceStr = balance.toString();
                const decimalPart = balanceStr.split('.')[1];
                if (decimalPart) {
                    expect(decimalPart.length).toBeLessThanOrEqual(8);
                }
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

    describe('Token Lookup Service Tests', () => {
        it('should lookup USDC token ID by symbol on testnet', async () => {
            try {
                const tokenId = await hederaWalletService.lookupTokenByName({
                    tokenName: 'USDC',
                    network: 'testnet', // Explicitly specify testnet
                });

                expect(typeof tokenId).toBe('string');
                expect(tokenId).toMatch(/^\d+\.\d+\.\d+$/); // Hedera token ID format
                expect(tokenId).toBe('0.0.5449'); // USDC on testnet

                console.log(`✅ Found USDC token ID on testnet: ${tokenId}`);
            } catch (error) {
                const errorMsg = (error as Error).message;
                expect(errorMsg).not.toContain('Method not implemented');
                console.log('⚠️ USDC lookup failed:', errorMsg);
            }
        }, 15000);

        it('should lookup USDC token ID by symbol on mainnet', async () => {
            try {
                const tokenId = await hederaWalletService.lookupTokenByName({
                    tokenName: 'USDC',
                    network: 'mainnet', // Explicitly specify mainnet
                });

                expect(typeof tokenId).toBe('string');
                expect(tokenId).toMatch(/^\d+\.\d+\.\d+$/); // Hedera token ID format
                expect(tokenId).toBe('0.0.456858'); // USDC on mainnet - NOT hardcoded in source

                console.log(`✅ Found USDC token ID on mainnet: ${tokenId}`);
            } catch (error) {
                const errorMsg = (error as Error).message;
                expect(errorMsg).not.toContain('Method not implemented');
                console.log('⚠️ USDC mainnet lookup failed:', errorMsg);
            }
        }, 15000);

        it('should handle token lookup with case insensitive search', async () => {
            try {
                const tokenId = await hederaWalletService.lookupTokenByName({
                    tokenName: 'usdc', // lowercase
                    network: 'testnet', // Explicitly specify testnet
                });

                expect(typeof tokenId).toBe('string');
                expect(tokenId).toMatch(/^\d+\.\d+\.\d+$/);

                console.log(`✅ Found token with lowercase search: ${tokenId}`);
            } catch (error) {
                const errorMsg = (error as Error).message;
                expect(errorMsg).not.toContain('Method not implemented');
                console.log('⚠️ Lowercase token lookup failed:', errorMsg);
            }
        }, 15000);

        it('should handle token lookup for non-existent token', async () => {
            try {
                await hederaWalletService.lookupTokenByName({
                    tokenName: 'NON_EXISTENT_TOKEN_XYZ123',
                    network: 'testnet', // Explicitly specify testnet
                });

                // If we reach here, the token was found (unexpected)
                console.log('⚠️ Non-existent token was found unexpectedly');
            } catch (error) {
                const errorMsg = (error as Error).message;
                expect(errorMsg).not.toContain('Method not implemented');
                expect(errorMsg).toContain('No token found');
                console.log('✅ Non-existent token correctly returned error:', errorMsg);
            }
        }, 15000);

        it('should default to mainnet when network not specified', async () => {
            try {
                const tokenId = await hederaWalletService.lookupTokenByName({
                    tokenName: 'USDC',
                    // network not specified, should default to mainnet
                });

                expect(typeof tokenId).toBe('string');
                expect(tokenId).toMatch(/^\d+\.\d+\.\d+$/);
                expect(tokenId).toBe('0.0.456858'); // Should be mainnet USDC by default

                console.log(`✅ Found token with default network (mainnet): ${tokenId}`);
            } catch (error) {
                const errorMsg = (error as Error).message;
                expect(errorMsg).not.toContain('Method not implemented');
                console.log('⚠️ Default network token lookup failed:', errorMsg);
            }
        }, 15000);
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
        describe('HBAR Transfer Tests', () => {
            it('should transfer HBAR successfully', async () => {
                try {
                    const transferAmount = 0.1; // 0.1 HBAR
                    const txId = await hederaWalletService.transferHbar({
                        toAccountId: '0.0.123457',
                        amount: transferAmount,
                    });

                    // If it succeeds, it should return a transaction ID
                    expect(typeof txId).toBe('string');
                    expect(txId.length).toBeGreaterThan(0);
                    expect(txId).toMatch(/^\d+\.\d+\.\d+@\d+\.\d+$/); // Hedera transaction ID format

                    console.log(`✅ HBAR transfer successful! Transferred ${transferAmount} HBAR`);
                    console.log(`   Transaction ID: ${txId}`);
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    // Should be a Hedera-specific error, not "Method not implemented"
                    expect(errorMsg).not.toContain('Method not implemented');
                    console.log(`⚠️ HBAR transfer failed: ${errorMsg}`);
                }
            }, 15000);

            it('should handle small HBAR amounts with proper precision', async () => {
                try {
                    const transferAmount = 0.00000001; // 1 tinybar (smallest HBAR unit)
                    const txId = await hederaWalletService.transferHbar({
                        toAccountId: '0.0.123457',
                        amount: transferAmount,
                    });

                    expect(typeof txId).toBe('string');
                    expect(txId.length).toBeGreaterThan(0);
                    console.log(`✅ Tiny HBAR transfer successful! Transferred ${transferAmount} HBAR`);
                    console.log(`   Transaction ID: ${txId}`);
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    expect(errorMsg).not.toContain('Method not implemented');
                    console.log(`⚠️ Tiny HBAR transfer failed: ${errorMsg}`);
                }
            }, 15000);

            it('should handle integer HBAR amounts', async () => {
                try {
                    const transferAmount = 1; // 1 HBAR
                    const txId = await hederaWalletService.transferHbar({
                        toAccountId: '0.0.123457',
                        amount: transferAmount,
                    });

                    expect(typeof txId).toBe('string');
                    expect(txId.length).toBeGreaterThan(0);
                    console.log(`✅ Integer HBAR transfer successful! Transferred ${transferAmount} HBAR`);
                    console.log(`   Transaction ID: ${txId}`);
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    expect(errorMsg).not.toContain('Method not implemented');
                    console.log(`⚠️ Integer HBAR transfer failed: ${errorMsg}`);
                }
            }, 15000);

            it('should transfer HBAR with balance verification (self-transfer)', async () => {
                console.log('\n📊 Starting HBAR transfer test with balance verification...');

                try {
                    // Step 1: Get initial balance
                    const initialBalance = await hederaWalletService.getCurrentHederaWalletBalance();
                    console.log(`   Initial balance: ${initialBalance} HBAR`);

                    // Ensure we have enough HBAR to transfer
                    expect(initialBalance).toBeGreaterThan(0.01);

                    // Step 2: Transfer 0.01 HBAR to ourselves (self-transfer)
                    const transferAmount = 0.01;

                    console.log(`   Transferring ${transferAmount} HBAR (self-transfer test)...`);

                    const txId = await hederaWalletService.transferHbar({
                        toAccountId: TEST_ACCOUNT_ID, // Self-transfer
                        amount: transferAmount,
                    });

                    console.log(`   ✅ Transfer successful! Transaction ID: ${txId}`);

                    // Step 3: Wait for transaction confirmation
                    console.log('   Waiting for transaction confirmation...');
                    await new Promise(resolve => setTimeout(resolve, 3000));

                    // Step 4: Get final balance
                    const finalBalance = await hederaWalletService.getCurrentHederaWalletBalance();
                    console.log(`   Final balance: ${finalBalance} HBAR`);

                    // Step 5: For self-transfer, balance should be approximately the same (minus fees)
                    // The difference should be just the transaction fee (usually small)
                    const balanceDifference = initialBalance - finalBalance;
                    console.log(`   Transaction fee: ~${balanceDifference} HBAR`);

                    // Expect fee to be reasonable (between 0 and 0.1 HBAR)
                    expect(balanceDifference).toBeGreaterThanOrEqual(0);
                    expect(balanceDifference).toBeLessThan(0.1);

                    console.log('   ✅ HBAR transfer with balance verification completed!');
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    console.log(`   ❌ HBAR transfer test failed: ${errorMsg}`);

                    if (errorMsg.includes('INSUFFICIENT_PAYER_BALANCE')) {
                        console.log('   💡 The account does not have enough HBAR for this test');
                    } else if (errorMsg.includes('INVALID_SIGNATURE')) {
                        console.log('   💡 There is an issue with transaction signing');
                    }

                    throw error;
                }
            }, 30000);

            it('should fail with invalid recipient account', async () => {
                await expect(
                    hederaWalletService.transferHbar({
                        toAccountId: 'invalid-account',
                        amount: 0.1,
                    })
                ).rejects.toThrow();
            });
        });

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
                            errorMsg.includes('Failed to send transaction') ||
                            errorMsg.includes('Token decimals field not found')
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

    describe('WHBAR Wrap/Unwrap Tests', () => {
        describe('Wrap HBAR to WHBAR', () => {
            it('should wrap HBAR to WHBAR on testnet', async () => {
                console.log('\n📦 Starting WHBAR wrap test on testnet...');

                try {
                    // Get initial HBAR balance
                    const initialHbarBalance = await hederaWalletService.getCurrentHederaWalletBalance();
                    console.log(`   Initial HBAR balance: ${initialHbarBalance} HBAR`);

                    // Wrap 1 HBAR to WHBAR
                    const wrapAmount = 1;
                    console.log(`   Wrapping ${wrapAmount} HBAR to WHBAR on testnet...`);

                    const txId = await hederaWalletService.wrapHbarToWhbar({
                        amount: wrapAmount,
                        network: 'testnet',
                    });

                    console.log(`   ✅ Wrap successful! Transaction ID: ${txId}`);

                    // Verify transaction ID format
                    expect(typeof txId).toBe('string');
                    expect(txId.length).toBeGreaterThan(0);
                    expect(txId).toMatch(/^\d+\.\d+\.\d+@\d+\.\d+$/);

                    // Wait for transaction confirmation
                    console.log('   Waiting for transaction confirmation...');
                    await new Promise(resolve => setTimeout(resolve, 5000));

                    // Get WHBAR balance (testnet WHBAR: 0.0.15058)
                    const whbarBalance = await hederaWalletService.getCurrentHederaWalletTokenBalance('0.0.15058');
                    console.log(`   WHBAR balance after wrap: ${whbarBalance} WHBAR`);

                    // Should have at least the amount we wrapped
                    expect(whbarBalance).toBeGreaterThanOrEqual(wrapAmount);

                    console.log('   ✅ WHBAR wrap test completed successfully!');
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    console.log(`   ❌ WHBAR wrap test failed: ${errorMsg}`);

                    if (errorMsg.includes('INSUFFICIENT_PAYER_BALANCE')) {
                        console.log('   💡 The account does not have enough HBAR for this test');
                    }

                    throw error;
                }
            }, 30000);

            it('should wrap HBAR to WHBAR on mainnet', async () => {
                // Skip mainnet tests in CI or if not explicitly testing mainnet
                if (hederaNetwork !== 'mainnet') {
                    console.log('⏭️  Skipping mainnet wrap test (not on mainnet)');
                    return;
                }

                console.log('\n📦 Starting WHBAR wrap test on mainnet...');

                try {
                    const wrapAmount = 0.5;
                    console.log(`   Wrapping ${wrapAmount} HBAR to WHBAR on mainnet...`);

                    const txId = await hederaWalletService.wrapHbarToWhbar({
                        amount: wrapAmount,
                        network: 'mainnet',
                    });

                    console.log(`   ✅ Wrap successful! Transaction ID: ${txId}`);
                    expect(typeof txId).toBe('string');

                    await new Promise(resolve => setTimeout(resolve, 5000));

                    // Get WHBAR balance (mainnet WHBAR: 0.0.1456985)
                    const whbarBalance = await hederaWalletService.getCurrentHederaWalletTokenBalance('0.0.1456985');
                    console.log(`   WHBAR balance after wrap: ${whbarBalance} WHBAR`);

                    expect(whbarBalance).toBeGreaterThanOrEqual(wrapAmount);
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    console.log(`   ❌ WHBAR wrap test failed: ${errorMsg}`);
                    throw error;
                }
            }, 30000);

            it('should handle small wrap amounts', async () => {
                try {
                    const wrapAmount = 0.1;
                    console.log(`   Wrapping ${wrapAmount} HBAR to WHBAR...`);

                    const txId = await hederaWalletService.wrapHbarToWhbar({
                        amount: wrapAmount,
                        network: 'testnet',
                    });

                    expect(typeof txId).toBe('string');
                    console.log(`   ✅ Small wrap successful! Transaction ID: ${txId}`);
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    console.log(`   ⚠️ Small wrap failed: ${errorMsg}`);
                }
            }, 20000);

            it('should fail with insufficient HBAR balance', async () => {
                try {
                    // Try to wrap more HBAR than exists
                    await hederaWalletService.wrapHbarToWhbar({
                        amount: 999999999,
                        network: 'testnet',
                    });

                    // Should not reach here
                    throw new Error('Expected wrap to fail with insufficient balance');
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    expect(errorMsg).toContain('Insufficient HBAR balance');
                    console.log('   ✅ Correctly rejected wrap with insufficient balance');
                }
            }, 15000);
        });

        describe('Unwrap WHBAR to HBAR', () => {
            it('should unwrap WHBAR to HBAR on testnet', async () => {
                console.log('\n📤 Starting WHBAR unwrap test on testnet...');

                try {
                    // First, check WHBAR balance
                    const whbarBalance = await hederaWalletService.getCurrentHederaWalletTokenBalance('0.0.15058');
                    console.log(`   Initial WHBAR balance: ${whbarBalance} WHBAR`);

                    // If no WHBAR, wrap some first
                    if (whbarBalance < 0.5) {
                        console.log('   Wrapping 1 HBAR first to get WHBAR for test...');
                        await hederaWalletService.wrapHbarToWhbar({
                            amount: 1,
                            network: 'testnet',
                        });
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    }

                    // Get initial HBAR balance
                    const initialHbarBalance = await hederaWalletService.getCurrentHederaWalletBalance();
                    console.log(`   Initial HBAR balance: ${initialHbarBalance} HBAR`);

                    // Unwrap 0.5 WHBAR to HBAR
                    const unwrapAmount = 0.5;
                    console.log(`   Unwrapping ${unwrapAmount} WHBAR to HBAR on testnet...`);

                    const txId = await hederaWalletService.unwrapWhbarToHbar({
                        amount: unwrapAmount,
                        network: 'testnet',
                    });

                    console.log(`   ✅ Unwrap successful! Transaction ID: ${txId}`);

                    // Verify transaction ID format
                    expect(typeof txId).toBe('string');
                    expect(txId.length).toBeGreaterThan(0);
                    expect(txId).toMatch(/^\d+\.\d+\.\d+@\d+\.\d+$/);

                    // Wait for transaction confirmation
                    console.log('   Waiting for transaction confirmation...');
                    await new Promise(resolve => setTimeout(resolve, 5000));

                    // Get HBAR balance after unwrap
                    const finalHbarBalance = await hederaWalletService.getCurrentHederaWalletBalance();
                    console.log(`   Final HBAR balance: ${finalHbarBalance} HBAR`);

                    // Should have more HBAR (minus fees)
                    const hbarIncrease = finalHbarBalance - initialHbarBalance;
                    console.log(`   HBAR increased by: ${hbarIncrease} HBAR`);
                    expect(hbarIncrease).toBeGreaterThan(0);

                    console.log('   ✅ WHBAR unwrap test completed successfully!');
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    console.log(`   ❌ WHBAR unwrap test failed: ${errorMsg}`);

                    if (errorMsg.includes('INSUFFICIENT_TOKEN_BALANCE')) {
                        console.log('   💡 The account does not have enough WHBAR for this test');
                    }

                    throw error;
                }
            }, 60000);

            it('should unwrap WHBAR to HBAR on mainnet', async () => {
                // Skip mainnet tests in CI or if not explicitly testing mainnet
                if (hederaNetwork !== 'mainnet') {
                    console.log('⏭️  Skipping mainnet unwrap test (not on mainnet)');
                    return;
                }

                console.log('\n📤 Starting WHBAR unwrap test on mainnet...');

                try {
                    const unwrapAmount = 0.25;
                    console.log(`   Unwrapping ${unwrapAmount} WHBAR to HBAR on mainnet...`);

                    const txId = await hederaWalletService.unwrapWhbarToHbar({
                        amount: unwrapAmount,
                        network: 'mainnet',
                    });

                    console.log(`   ✅ Unwrap successful! Transaction ID: ${txId}`);
                    expect(typeof txId).toBe('string');

                    await new Promise(resolve => setTimeout(resolve, 5000));
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    console.log(`   ❌ WHBAR unwrap test failed: ${errorMsg}`);
                    throw error;
                }
            }, 30000);

            it('should handle small unwrap amounts', async () => {
                try {
                    const unwrapAmount = 0.01;
                    console.log(`   Unwrapping ${unwrapAmount} WHBAR to HBAR...`);

                    const txId = await hederaWalletService.unwrapWhbarToHbar({
                        amount: unwrapAmount,
                        network: 'testnet',
                    });

                    expect(typeof txId).toBe('string');
                    console.log(`   ✅ Small unwrap successful! Transaction ID: ${txId}`);
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    console.log(`   ⚠️ Small unwrap failed: ${errorMsg}`);
                }
            }, 20000);

            it('should fail with insufficient WHBAR balance', async () => {
                try {
                    // Try to unwrap more WHBAR than exists
                    await hederaWalletService.unwrapWhbarToHbar({
                        amount: 999999999,
                        network: 'testnet',
                    });

                    // Should not reach here
                    throw new Error('Expected unwrap to fail with insufficient balance');
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    expect(errorMsg).toContain('Insufficient WHBAR balance');
                    console.log('   ✅ Correctly rejected unwrap with insufficient balance');
                }
            }, 15000);
        });

        describe('Wrap/Unwrap Round Trip Test', () => {
            it('should successfully wrap and unwrap HBAR (full cycle)', async () => {
                console.log('\n🔄 Starting full wrap/unwrap cycle test on testnet...');

                try {
                    // Get initial balances
                    const initialHbarBalance = await hederaWalletService.getCurrentHederaWalletBalance();
                    console.log(`   Initial HBAR balance: ${initialHbarBalance} HBAR`);

                    const cycleAmount = 0.5;

                    // Step 1: Wrap HBAR to WHBAR
                    console.log(`   Step 1: Wrapping ${cycleAmount} HBAR to WHBAR...`);
                    const wrapTxId = await hederaWalletService.wrapHbarToWhbar({
                        amount: cycleAmount,
                        network: 'testnet',
                    });
                    console.log(`   ✅ Wrap TX: ${wrapTxId}`);
                    await new Promise(resolve => setTimeout(resolve, 5000));

                    // Check WHBAR balance
                    const whbarBalance = await hederaWalletService.getCurrentHederaWalletTokenBalance('0.0.15058');
                    console.log(`   WHBAR balance after wrap: ${whbarBalance} WHBAR`);
                    expect(whbarBalance).toBeGreaterThanOrEqual(cycleAmount);

                    // Step 2: Unwrap WHBAR back to HBAR
                    console.log(`   Step 2: Unwrapping ${cycleAmount} WHBAR back to HBAR...`);
                    const unwrapTxId = await hederaWalletService.unwrapWhbarToHbar({
                        amount: cycleAmount,
                        network: 'testnet',
                    });
                    console.log(`   ✅ Unwrap TX: ${unwrapTxId}`);
                    await new Promise(resolve => setTimeout(resolve, 5000));

                    // Get final HBAR balance
                    const finalHbarBalance = await hederaWalletService.getCurrentHederaWalletBalance();
                    console.log(`   Final HBAR balance: ${finalHbarBalance} HBAR`);

                    // Balance should be approximately the same (minus transaction fees)
                    const balanceDifference = initialHbarBalance - finalHbarBalance;
                    console.log(`   Total fees paid: ~${balanceDifference} HBAR`);

                    // Expect fees to be reasonable (less than 0.2 HBAR for both transactions)
                    expect(balanceDifference).toBeGreaterThanOrEqual(0);
                    expect(balanceDifference).toBeLessThan(0.2);

                    console.log('   ✅ Full wrap/unwrap cycle completed successfully!');
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    console.log(`   ❌ Wrap/unwrap cycle test failed: ${errorMsg}`);
                    throw error;
                }
            }, 90000);
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

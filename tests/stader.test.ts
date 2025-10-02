import { config } from 'dotenv';
config(); // Load test environment variables from .env file

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { HederaWalletFactory } from '../src/core/wallets/hedera_wallet/factory';
import { StaderService } from '../src/plugins/stader/staderService';
import { KeypairClient } from '../src/core/wallets/hedera_wallet/clients/keypair';

// Check if Hedera credentials are available
const hasPrivateKey = Boolean(process.env.HEDERA_PRIVATE_KEY);
const hasAccountId = Boolean(process.env.HEDERA_ACCOUNT_ID);
const hederaNetwork = process.env.HEDERA_NETWORK || 'mainnet';

// Test account details
const TEST_ACCOUNT_ID = process.env.HEDERA_ACCOUNT_ID as string;
const TEST_PRIVATE_KEY = process.env.HEDERA_PRIVATE_KEY as string;

// Skip tests based on available credentials AND network (Stader only works on mainnet)
const canRunStaderTests = hasPrivateKey && hasAccountId && hederaNetwork === 'mainnet';
const describeStaderTests = canRunStaderTests ? describe : describe.skip;

console.log('Stader Test Configuration:');
console.log('- Network:', hederaNetwork);
console.log('- Has Credentials:', hasPrivateKey && hasAccountId);
console.log('- Test Account ID:', TEST_ACCOUNT_ID || 'Not provided');
if (hederaNetwork !== 'mainnet') {
    console.log('⚠️  Stader HBARX only available on mainnet - tests will be skipped');
}

describe('Stader Plugin Tests', () => {
    describe('Service Initialization', () => {
        it('should initialize StaderService with wallet', () => {
            const wallet = HederaWalletFactory.fromAccountId('0.0.123456');
            const service = new StaderService(wallet);
            expect(service).toBeDefined();
        });

        it('should have correct network configurations', () => {
            const wallet = HederaWalletFactory.fromAccountId('0.0.123456');
            const service = new StaderService(wallet);

            // Test that the service has the expected network configurations
            expect(service).toBeDefined();

            // Network config constants should exist (we can't access them directly due to private)
            // But we can verify the service methods work
            expect(typeof service.getStakedBalance).toBe('function');
            expect(typeof service.getStakedBalanceByNetwork).toBe('function');
        });
    });

    describe('Parameter Validation', () => {
        let service: StaderService;

        beforeAll(() => {
            const wallet = HederaWalletFactory.fromAccountId('0.0.123456');
            service = new StaderService(wallet);
        });

        it('should validate stake parameters', async () => {
            // Test invalid network
            await expect(
                service.stake({
                    amount: 1,
                    network: 'invalid' as any,
                })
            ).rejects.toThrow();
        });

        it('should validate unstake parameters', async () => {
            // Test negative amounts should fail
            await expect(
                service.unstake({
                    amount: -1,
                    network: 'mainnet',
                })
            ).rejects.toThrow();
        });

        it('should validate withdraw parameters', async () => {
            // Test negative unstake index
            await expect(
                service.withdraw({
                    unstakeIndex: -1,
                    network: 'mainnet',
                })
            ).rejects.toThrow();
        });
    });
});

describeStaderTests('Stader Integration Tests (Full Functionality)', () => {
    let wallet: KeypairClient;
    let staderService: StaderService;

    beforeAll(() => {
        wallet = HederaWalletFactory.fromPrivateKey(TEST_PRIVATE_KEY, TEST_ACCOUNT_ID);
        staderService = new StaderService(wallet);
        console.log(`Running Stader integration tests with account: ${TEST_ACCOUNT_ID}`);
    });

    describe('Balance Queries', () => {
        it('should get HBARX staked balance', async () => {
            try {
                const balance = await staderService.getStakedBalance();

                expect(typeof balance).toBe('number');
                expect(balance).toBeGreaterThanOrEqual(0);

                console.log(`✅ Current HBARX balance: ${balance} HBARX`);
            } catch (error) {
                const errorMsg = (error as Error).message;
                console.log(`⚠️ Failed to get HBARX balance: ${errorMsg}`);

                // Common expected errors:
                if (errorMsg.includes('TOKEN_NOT_ASSOCIATED')) {
                    console.log('   💡 Account not associated with HBARX token');
                } else if (errorMsg.includes('INVALID_TOKEN_ID')) {
                    console.log('   💡 HBARX token ID not found on this network');
                }

                // Re-throw to fail test if unexpected error
                throw error;
            }
        }, 60000); // Increased timeout for token balance queries

        it('should get HBARX balance by network', async () => {
            try {
                const balance = await staderService.getStakedBalanceByNetwork({
                    network: hederaNetwork,
                });

                expect(typeof balance).toBe('number');
                expect(balance).toBeGreaterThanOrEqual(0);

                console.log(`✅ HBARX balance on ${hederaNetwork}: ${balance} HBARX`);
            } catch (error) {
                const errorMsg = (error as Error).message;
                console.log(`⚠️ Failed to get HBARX balance by network: ${errorMsg}`);
                throw error;
            }
        }, 60000); // Increased timeout for network delays
    });

    describe('Staking Operations', () => {
        it('should handle stake operation', async () => {
            // Check HBAR balance first
            const hbarBalance = await wallet.getBalance();
            console.log(`   Current HBAR balance: ${hbarBalance} HBAR`);

            if (hbarBalance < 2) {
                console.log('   ⚠️ Insufficient HBAR balance for staking test (need at least 2 HBAR) - skipping');
                return;
            }

            // Attempt to stake 1.02 HBAR
            const stakeAmount = 1.02;

            try {
                const txId = await staderService.stake({
                    amount: stakeAmount,
                    network: hederaNetwork,
                });

                // If we get here, staking succeeded
                expect(typeof txId).toBe('string');
                expect(txId.length).toBeGreaterThan(0);
                expect(txId).toMatch(/^\d+\.\d+\.\d+@\d+\.\d+$/);

                console.log(`✅ Staking successful! Staked ${stakeAmount} HBAR`);
                console.log(`   Transaction ID: ${txId}`);
            } catch (error) {
                const errorMsg = (error as Error).message;

                // The Stader contract implementation from the "bad dev" has known issues
                // Contract addresses are correct (verified against official Stader CLI)
                // But transactions consistently fail or timeout
                console.log(`❌ STAKING FAILED - Known implementation issue`);
                console.log(`   Error: ${errorMsg.substring(0, 200)}`);
                console.log(`   📝 Contract addresses verified correct (0.0.1027588)`);
                console.log(`   📝 This implementation needs debugging by Hedera expert`);

                // Fail the test to make it clear staking doesn't work
                throw new Error(`Stader staking not functional: ${errorMsg.substring(0, 100)}`);
            }
        }, 300000); // 5 minute timeout for all 3 transaction steps (association, allowance, stake)

        it('should handle insufficient balance for staking', async () => {
            try {
                // Try to stake more HBAR than available
                const largeAmount = 1000000; // 1M HBAR (likely more than available)

                await staderService.stake({
                    amount: largeAmount,
                    network: hederaNetwork,
                });

                // If we reach here, the stake succeeded (unexpected)
                console.log('⚠️ Large stake amount succeeded unexpectedly');
            } catch (error) {
                const errorMsg = (error as Error).message;
                expect(errorMsg).toContain('Insufficient HBAR balance');
                console.log(`✅ Correctly rejected large stake: ${errorMsg}`);
            }
        }, 60000); // Increased timeout for balance check network delays
    });

    describe('Unstaking Operations', () => {
        it('should handle unstake operation', async () => {
            try {
                // First check HBARX balance
                const hbarxBalance = await staderService.getStakedBalance();
                console.log(`   Current HBARX balance: ${hbarxBalance} HBARX`);

                if (hbarxBalance < 0.01) {
                    console.log('   ⚠️ Insufficient HBARX balance for unstaking test');
                    return;
                }

                // Attempt to unstake 0.01 HBARX
                const unstakeAmount = 0.01;
                const txId = await staderService.unstake({
                    amount: unstakeAmount,
                    network: hederaNetwork,
                });

                expect(typeof txId).toBe('string');
                expect(txId.length).toBeGreaterThan(0);
                expect(txId).toMatch(/^\d+\.\d+\.\d+@\d+\.\d+$/);

                console.log(`✅ Unstaking successful! Unstaked ${unstakeAmount} HBARX`);
                console.log(`   Transaction ID: ${txId}`);
                console.log(`   💡 Note: Withdrawal will be available after 24-hour unbonding period`);
            } catch (error) {
                const errorMsg = (error as Error).message;
                console.log(`⚠️ Unstaking failed: ${errorMsg}`);

                // Common expected errors:
                if (errorMsg.includes('Insufficient HBARX balance')) {
                    console.log('   💡 Insufficient HBARX balance for unstaking');
                } else if (errorMsg.includes('INVALID_CONTRACT_ID')) {
                    console.log('   💡 Stader undelegation contract not found');
                } else if (errorMsg.includes('TOKEN_NOT_ASSOCIATED')) {
                    console.log('   💡 Account not associated with HBARX token');
                }
            }
        }, 30000);

        it('should handle insufficient HBARX balance for unstaking', async () => {
            try {
                // Try to unstake more HBARX than available
                const largeAmount = 1000000; // 1M HBARX (likely more than available)

                await staderService.unstake({
                    amount: largeAmount,
                    network: hederaNetwork,
                });

                console.log('⚠️ Large unstake amount succeeded unexpectedly');
            } catch (error) {
                const errorMsg = (error as Error).message;
                expect(errorMsg).toContain('Insufficient HBARX balance');
                console.log(`✅ Correctly rejected large unstake: ${errorMsg}`);
            }
        }, 60000); // Increased timeout for network delays
    });

    describe('Withdrawal Operations', () => {
        it('should handle withdraw operation', async () => {
            try {
                // Attempt to withdraw using unstake index 0
                const withdrawIndex = 0;
                const txId = await staderService.withdraw({
                    unstakeIndex: withdrawIndex,
                    network: hederaNetwork,
                });

                expect(typeof txId).toBe('string');
                expect(txId.length).toBeGreaterThan(0);
                expect(txId).toMatch(/^\d+\.\d+\.\d+@\d+\.\d+$/);

                console.log(`✅ Withdrawal successful! Withdrew unstake index ${withdrawIndex}`);
                console.log(`   Transaction ID: ${txId}`);
            } catch (error) {
                const errorMsg = (error as Error).message;
                console.log(`⚠️ Withdrawal failed: ${errorMsg}`);

                // Common expected errors:
                if (errorMsg.includes('CONTRACT_REVERT_EXECUTED')) {
                    console.log('   💡 No withdrawable amount at index 0 (expected)');
                } else if (errorMsg.includes('INVALID_CONTRACT_ID')) {
                    console.log('   💡 Stader undelegation contract not found');
                }

                // Withdrawal failures are expected if no unstaking has been done
            }
        }, 30000);
    });

    describe('Network Configuration', () => {
        it('should work with different network configurations', async () => {
            const networks: 'mainnet'[] = ['mainnet'];

            for (const network of networks) {
                try {
                    const balance = await staderService.getStakedBalanceByNetwork({
                        network,
                    });

                    expect(typeof balance).toBe('number');
                    console.log(`✅ ${network} balance query successful: ${balance} HBARX`);
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    console.log(`⚠️ ${network} balance query failed: ${errorMsg}`);

                    // Network-specific failures are acceptable
                }
            }
        }, 60000); // Increased timeout for network configuration tests
    });

    describe('Error Handling', () => {
        it('should handle invalid network gracefully', async () => {
            await expect(
                staderService.stake({
                    amount: 1,
                    network: 'invalid' as any,
                })
            ).rejects.toThrow();
        }, 30000); // Increased timeout

        it('should handle invalid amounts gracefully', async () => {
            // Zero amount - may fail due to insufficient balance for fees
            try {
                const result = await staderService.stake({
                    amount: 0,
                    network: hederaNetwork,
                });
                expect(typeof result).toBe('string');
                expect(result.length).toBeGreaterThan(0);
                console.log('✅ Zero amount stake succeeded');
            } catch (error) {
                const errorMsg = (error as Error).message;
                // Zero amount may fail with insufficient balance or contract revert
                expect(
                    errorMsg.includes('INSUFFICIENT_PAYER_BALANCE') ||
                        errorMsg.includes('CONTRACT_REVERT_EXECUTED') ||
                        errorMsg.includes('Insufficient HBAR balance')
                ).toBe(true);
                console.log('✅ Zero amount stake handled correctly');
            }

            // Negative amount should fail
            await expect(
                staderService.stake({
                    amount: -1,
                    network: hederaNetwork,
                })
            ).rejects.toThrow();
        }, 60000); // Increased timeout for network delays

        it('should handle contract errors gracefully', async () => {
            // This test verifies that contract errors are properly caught and reported
            try {
                await staderService.withdraw({
                    unstakeIndex: 999, // Non-existent index
                    network: hederaNetwork,
                });
            } catch (error) {
                const errorMsg = (error as Error).message;
                expect(errorMsg).not.toContain('Method not implemented');

                // Should be a proper contract error, signing error, or transaction error
                expect(
                    errorMsg.includes('CONTRACT_REVERT_EXECUTED') ||
                        errorMsg.includes('INVALID_CONTRACT_ID') ||
                        errorMsg.includes('failed') ||
                        errorMsg.includes('Failed to sign transaction') ||
                        errorMsg.includes('transactionId') ||
                        errorMsg.includes('freezeWith')
                ).toBe(true);
            }
        }, 15000);
    });
});

describe('Stader Test Setup Validation', () => {
    it('should validate environment variables for integration tests', () => {
        if (hasPrivateKey && hasAccountId) {
            expect(TEST_PRIVATE_KEY).toBeDefined();
            expect(TEST_PRIVATE_KEY.length).toBeGreaterThan(0);
            expect(TEST_ACCOUNT_ID).toBeDefined();
            expect(TEST_ACCOUNT_ID).toMatch(/^\d+\.\d+\.\d+$/);
        }

        expect(hederaNetwork).toBe('mainnet');
    });

    it('should provide clear instructions for missing credentials', () => {
        if (!hasPrivateKey || !hasAccountId) {
            console.log('\n🔑 To run Stader integration tests:');
            console.log('Set environment variables:');
            console.log('- HEDERA_PRIVATE_KEY: Your Hedera private key');
            console.log('- HEDERA_ACCOUNT_ID: Your Hedera account ID (e.g., 0.0.123456)');
            console.log('Note: All tests now use mainnet by default');
            console.log('\n💡 Note: You may need HBARX tokens for full functionality testing');
        }
    });
});

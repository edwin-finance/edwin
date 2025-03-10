import { config } from 'dotenv';
config(); // Load test environment variables from .env file

import { describe, expect, it, beforeAll } from 'vitest';
import { safeJsonStringify } from '../src/utils';
import edwinLogger from '../src/utils/logger';
import { calculateAmounts, extractBalanceChanges } from '../src/plugins/meteora/utils';
import DLMM from '@meteora-ag/dlmm';
import { BN } from '@coral-xyz/anchor';
import { EdwinSolanaWallet } from '../src/core/wallets';
import { MeteoraProtocol } from '../src/plugins/meteora/meteoraProtocol';
import { Keypair } from '@solana/web3.js';
import * as web3 from '@solana/web3.js';
import bs58 from 'bs58';

// Meteora test with Devnet setup
describe('Meteora test', () => {
    // Create a dedicated devnet wallet for testing
    const testWalletKeypair = Keypair.generate();
    const testWallet = new EdwinSolanaWallet(bs58.encode(testWalletKeypair.secretKey));
    console.log('testWallet public key', testWallet.getPublicKey().toString());
    console.log('testWallet private key', bs58.encode(testWalletKeypair.secretKey));
    const meteora = new MeteoraProtocol(testWallet);

    // Set up with airdrop before running tests
    beforeAll(async () => {
        const connection = testWallet.getConnection('https://api.devnet.solana.com');
        const walletAddressString = testWallet.getAddress();
        const walletPublicKey = new web3.PublicKey(walletAddressString);

        edwinLogger.info(`Test wallet address: ${walletAddressString}`);

        // Try to airdrop with retry logic
        let balance = 0;
        const RETRY_COUNT = 3;

        for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
            try {
                // Request a smaller airdrop (1 SOL instead of 2)
                const airdropSignature = await connection.requestAirdrop(walletPublicKey, 1 * 10 ** 9);

                // Wait for confirmation
                await connection.confirmTransaction(airdropSignature);

                // Check balance
                balance = await connection.getBalance(walletPublicKey);
                if (balance > 0) break;

                // Wait a bit before retrying
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (err) {
                edwinLogger.warn(`Airdrop attempt ${attempt + 1} failed: ${err.message}`);
                if (attempt === RETRY_COUNT - 1) {
                    edwinLogger.warn('All airdrop attempts failed. Continuing test with 0 balance.');
                }
                // Wait longer between retries
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        edwinLogger.info(`Wallet balance after airdrop attempts: ${balance / 10 ** 9} SOL`);

        // We'll continue even with 0 balance, but log a warning
        if (balance === 0) {
            edwinLogger.warn('Could not get airdrop. Some tests may be skipped.');
        }
    }, 60000); // Increase timeout to 60 seconds

    it('test meteora getPools', async () => {
        const results = await meteora.getPools({
            asset: 'sol',
            assetB: 'usdc',
        });
        expect(results).toBeDefined();
        expect(results).toBeInstanceOf(Array);
        // On devnet, the number of pools might differ from mainnet
        // We just verify there are some pools returned
        expect(results.length).toBeGreaterThan(0);
    }, 30000); // 30 second timeout

    it('test meteora getPositions on devnet', async () => {
        const positions = await meteora.getPositions();
        edwinLogger.info('🚀 ~ it ~ getPositions result:', safeJsonStringify(positions));
        // In a fresh wallet, we expect no positions initially
        expect(positions.size).toBe(0);
    }, 60000); // 60 second timeout

    it('test meteora create position and add liquidity, then check for new position', async () => {
        // Get pools first
        const results = await meteora.getPools({
            asset: 'sol',
            assetB: 'usdc',
        });

        // Skip test if no pools available on devnet
        if (results.length === 0) {
            edwinLogger.warn('No SOL/USDC pools found on devnet, skipping test');
            return;
        }

        const topPoolAddress = results[0].address;

        // Use smaller amounts for devnet testing
        const result = await meteora.addLiquidity({
            poolAddress: topPoolAddress,
            amount: '0.1', // 0.1 SOL
            amountB: 'auto',
        });

        // Verify liquidity was added correctly
        expect(result.liquidityAdded).toBeDefined();
        expect(result.liquidityAdded).toHaveLength(2);
        expect(result.liquidityAdded[0]).toBeCloseTo(0.1, 1); // Verify SOL amount is approximately 0.1
        expect(result.liquidityAdded[1]).toBeGreaterThan(0); // Verify USDC amount is non-zero
        edwinLogger.info('🚀 ~ it ~ result:', result);

        const positionAddress = result.positionAddress;
        // Get positions after adding liquidity
        const positions = await meteora.getPositionsFromPool({
            poolAddress: topPoolAddress,
        });
        // Check that positions is ok - should be 1 position
        expect(positions).toBeDefined();
        expect(positions.length).toBe(1);
        expect(positions[0].publicKey.toString()).toBe(positionAddress);
    }, 120000); // 120 second timeout

    it('test meteora remove liquidity', async () => {
        // Get initial positions
        const positions = await meteora.getPositions();
        edwinLogger.info('🚀 ~ it ~ initial positions:', positions);

        if (!positions || positions.size === 0) {
            edwinLogger.warn('No positions found to close - skipping test');
            return;
        }

        // Remove liquidity from first position found
        const poolAddress = Array.from(positions.keys())[0];
        const result = await meteora.removeLiquidity({
            poolAddress: poolAddress,
            shouldClosePosition: true,
        });
        edwinLogger.info('🚀 ~ it ~ removeLiquidity result:', result);

        // Check positions after removal
        const positionsAfter = await meteora.getPositionsFromPool({
            poolAddress: poolAddress,
        });
        edwinLogger.info('🚀 ~ it ~ positions after removal:', positionsAfter);

        // Verify position was closed
        expect(positionsAfter.length).toBe(0);
    }, 60000); // 60 second timeout
});

describe('Meteora utils', () => {
    // Create a dedicated devnet wallet for utility tests
    const testWalletKeypair = Keypair.generate();
    const wallet = new EdwinSolanaWallet(bs58.encode(testWalletKeypair.secretKey));
    const meteora = new MeteoraProtocol(wallet);

    describe('calculateAmounts', () => {
        // Mock DLMM instance
        const mockDlmmPool = {
            tokenX: { decimal: 9 },
            tokenY: { decimal: 6 },
        } as DLMM;

        it('should calculate amounts when amount is auto', async () => {
            const result = await calculateAmounts(
                'auto',
                '100',
                '2', // price per token
                mockDlmmPool
            );

            expect(result[0]).toBeInstanceOf(BN);
            expect(result[1]).toBeInstanceOf(BN);

            // For amountB = 100 and price = 2
            // amountA should be 50 (100/2) in base units
            expect(result[0].toString()).toBe((50 * 10 ** 9).toString());
            // amountB should be 100 in base units
            expect(result[1].toString()).toBe((100 * 10 ** 6).toString());
        });

        it('should calculate amounts when amountB is auto', async () => {
            const result = await calculateAmounts(
                '50',
                'auto',
                '2', // price per token
                mockDlmmPool
            );

            expect(result[0]).toBeInstanceOf(BN);
            expect(result[1]).toBeInstanceOf(BN);

            // For amountA = 50 and price = 2
            // amountA should be 50 in base units
            expect(result[0].toString()).toBe((50 * 10 ** 9).toString());
            // amountB should be 100 (50*2) in base units
            expect(result[1].toString()).toBe((100 * 10 ** 6).toString());
        });

        it('should handle direct amounts', async () => {
            const result = await calculateAmounts(
                '50',
                '100',
                '2', // price per token (not used in this case)
                mockDlmmPool
            );

            expect(result[0]).toBeInstanceOf(BN);
            expect(result[1]).toBeInstanceOf(BN);

            expect(result[0].toString()).toBe((50 * 10 ** 9).toString());
            expect(result[1].toString()).toBe((100 * 10 ** 6).toString());
        });

        it('should throw error when both amounts are auto', async () => {
            await expect(calculateAmounts('auto', 'auto', '2', mockDlmmPool)).rejects.toThrow(TypeError);
        });

        it('should throw error for invalid number inputs', async () => {
            await expect(calculateAmounts('invalid', '100', '2', mockDlmmPool)).rejects.toThrow(TypeError);
        });
    });

    describe('extractBalanceChanges', () => {
        it('should correctly extract balance changes from a transaction', async () => {
            const tokenXMint = await wallet.getTokenAddress('sol');
            const tokenYMint = await wallet.getTokenAddress('usdc');
            if (!tokenXMint || !tokenYMint) {
                throw new Error('Token address not found');
            }

            const connection = wallet.getConnection();
            const result = await extractBalanceChanges(
                connection,
                '31brBmpbZMqduwi3u1Z6Si2Xt4izdkX2TE45jdeeq1oVreiahKyfaHSArMKdyqKWeYFT6GwGWRBxwfnwfbGbPypR',
                tokenXMint,
                tokenYMint
            );

            expect(result).toHaveProperty('liquidityRemoved');
            expect(result).toHaveProperty('feesClaimed');
            expect(result.liquidityRemoved).toHaveLength(2);
            expect(result.feesClaimed).toHaveLength(2);

            // Test against known values from the transaction
            expect(result).toEqual({
                liquidityRemoved: [0, 20.274523],
                feesClaimed: [0.000004094, 0.003779],
            });

            const result2 = await extractBalanceChanges(
                connection,
                '57FFqxEZqbyfesEcSiMNGsHUTfSzKRvcreqBzJirFWrHHW37YaRvNGd8EfGPVSEzXuQrdZbxZWM4NjBLkFZ7TmVN',
                tokenXMint,
                tokenYMint
            );

            // Test against known values from the transaction
            expect(result2).toEqual({
                liquidityRemoved: [0.051702288, 0],
                feesClaimed: [0.00000511, 0.000032],
            });
        }, 20000);

        it('should handle transaction not found', async () => {
            const connection = wallet.getConnection();
            await expect(
                extractBalanceChanges(connection, 'invalid_signature', 'token_x_address', 'token_y_address')
            ).rejects.toThrow(Error);
        }, 20000);
    });
});

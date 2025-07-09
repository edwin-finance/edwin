import { SolanaWalletClient } from '../../core/wallets/solana_wallet';
import DLMM, { StrategyType, BinLiquidity, PositionData, LbPosition, PositionInfo } from '@meteora-ag/dlmm';
import { Keypair, PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import edwinLogger from '../../utils/logger';
import { calculateAmounts, extractBalanceChanges, verifyAddLiquidityTokenAmounts } from './utils';
import { withRetry } from '../../utils';
import { MeteoraStatisticalBugError } from './errors';
import { AddLiquidityParameters, RemoveLiquidityParameters, PoolParameters, GetPoolsParameters } from './parameters';
import { InsufficientBalanceError } from '../../errors';

interface MeteoraPoolResult {
    pairs: MeteoraPool[];
}

interface MeteoraPool {
    address: string;
    name: string;
    bin_step: number;
    base_fee_percentage: string;
    max_fee_percentage: string;
    protocol_fee_percentage: string;
    liquidity: string;
    fees_24h: number;
    trade_volume_24h: number;
    current_price: number;
    apr: number;
}

interface MeteoraPoolOutput {
    address: string;
    name: string;
    bin_step: number;
    base_fee_percentage: string;
    max_fee_percentage: string;
    protocol_fee_percentage: string;
    liquidity: string;
    fees_24h: number;
    trade_volume_24h: number;
    current_price: number;
    apr_percentage: number;
}

interface Position {
    address: string;
    pair_address: string;
}

export class MeteoraProtocol {
    private static readonly BASE_URL = 'https://dlmm-api.meteora.ag';
    private wallet: SolanaWalletClient;

    constructor(wallet: SolanaWalletClient) {
        this.wallet = wallet;
    }

    async getPortfolio(): Promise<string> {
        return '';
    }

    async getPositionInfo(positionAddress: string): Promise<Position> {
        try {
            const response = await fetch(`https://dlmm-api.meteora.ag/position_v2/${positionAddress}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch position info: ${response.statusText}`);
            }
            return await response.json();
        } catch (error: unknown) {
            edwinLogger.error('Error fetching Meteora position info:', error);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to get Meteora position info: ${message}`);
        }
    }

    async getPools(params: GetPoolsParameters): Promise<MeteoraPoolOutput[]> {
        const { asset, assetB } = params;
        const limit = 10;
        if (!asset || !assetB) {
            throw new Error('Asset A and Asset B are required for Meteora getPools');
        }
        const response = await fetch(
            `${MeteoraProtocol.BASE_URL}/pair/all_with_pagination?search_term=${asset}-${assetB}&limit=${limit}`
        );
        const result: MeteoraPoolResult = await response.json();
        if (!result.pairs) {
            throw new Error(`No pool found for ${asset}-${assetB}`);
        }

        return result.pairs.map(pool => ({
            address: pool.address,
            name: pool.name,
            bin_step: pool.bin_step,
            base_fee_percentage: pool.base_fee_percentage,
            max_fee_percentage: pool.max_fee_percentage,
            protocol_fee_percentage: pool.protocol_fee_percentage,
            liquidity: pool.liquidity,
            fees_24h: pool.fees_24h,
            trade_volume_24h: pool.trade_volume_24h,
            current_price: pool.current_price,
            apr_percentage: pool.apr,
        }));
    }

    async getPositionsFromPool(params: PoolParameters): Promise<Array<LbPosition>> {
        const { poolAddress } = params;
        if (!poolAddress) {
            throw new Error('Pool address is required for Meteora getPositionsFromPool');
        }
        const connection = this.wallet.getConnection();
        const dlmmPool = await DLMM.create(connection, new PublicKey(poolAddress));
        const { userPositions } = await withRetry(
            async () => dlmmPool.getPositionsByUserAndLbPair(this.wallet.publicKey),
            'Meteora get user positions'
        );
        return userPositions;
    }

    async getPositions(): Promise<Map<string, PositionInfo>> {
        try {
            const connection = this.wallet.getConnection();

            return await withRetry(
                async () => DLMM.getAllLbPairPositionsByUser(connection, this.wallet.publicKey),
                'Meteora getPositions'
            );
        } catch (error: unknown) {
            edwinLogger.error('Meteora getPositions error:', error);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Meteora getPositions failed: ${message}`);
        }
    }

    async getActiveBin(params: PoolParameters): Promise<BinLiquidity> {
        const { poolAddress } = params;
        if (!poolAddress) {
            throw new Error('Pool address is required for Meteora getActiveBin');
        }
        return await withRetry(async () => {
            // Ensure we use the Helius RPC URL from environment
            const connection = this.wallet.getConnection();
            const dlmmPool = await DLMM.create(connection, new PublicKey(poolAddress));
            return dlmmPool.getActiveBin();
        }, 'Meteora getActiveBin');
    }

    /**
     * Helper method for adding liquidity to a Meteora pool
     * @returns Transaction signature
     */
    private async innerAddLiquidity(
        poolAddress: string,
        amount: string,
        amountB: string,
        rangeInterval: number = 10
    ): Promise<string> {
        // Ensure we use the Helius RPC URL from environment to avoid rate limits
        const connection = this.wallet.getConnection();
        const dlmmPool = await withRetry(
            async () => DLMM.create(connection, new PublicKey(poolAddress)),
            'Meteora create pool'
        );

        const balance = await this.wallet.getBalance(dlmmPool.tokenX.publicKey.toString());
        if (balance < Number(amount)) {
            throw new InsufficientBalanceError(Number(amount), balance, dlmmPool.tokenX.publicKey.toString());
        }
        const balanceB = await this.wallet.getBalance(dlmmPool.tokenY.publicKey.toString());
        if (balanceB < Number(amountB)) {
            throw new InsufficientBalanceError(Number(amountB), balanceB, dlmmPool.tokenY.publicKey.toString());
        }

        // Wrap the position check in retry logic
        const positionInfo = await withRetry(
            async () => dlmmPool.getPositionsByUserAndLbPair(this.wallet.publicKey),
            'Meteora get user positions'
        );
        const existingPosition = positionInfo?.userPositions?.[0];

        const activeBin = await withRetry(async () => dlmmPool.getActiveBin(), 'Meteora get active bin');
        const activeBinPricePerToken = dlmmPool.fromPricePerLamport(Number(activeBin.price));
        const [totalXAmount, totalYAmount]: [BN, BN] = await calculateAmounts(
            amount,
            amountB,
            activeBinPricePerToken,
            dlmmPool
        );
        if (totalXAmount.isZero() && totalYAmount.isZero()) {
            throw new TypeError('Total liquidity trying to add is 0');
        }
        edwinLogger.debug(`Adding liquidity with Total X amount: ${totalXAmount}, Total Y amount: ${totalYAmount}`);

        let tx;
        let positionPubKey: PublicKey;
        const signers: Keypair[] = [];

        if (existingPosition) {
            edwinLogger.debug(`Adding liquidity to existing position`);
            // Get min and max bin ids from the existing position
            const binData = existingPosition.positionData.positionBinData;
            const minBinId = Math.min(...binData.map(bin => bin.binId));
            const maxBinId = Math.max(...binData.map(bin => bin.binId));
            positionPubKey = existingPosition.publicKey;
            // Add liquidity to the existing position
            await dlmmPool.refetchStates();

            tx = await dlmmPool.addLiquidityByStrategy({
                positionPubKey: positionPubKey,
                user: this.wallet.publicKey,
                totalXAmount,
                totalYAmount,
                strategy: {
                    maxBinId,
                    minBinId,
                    strategyType: StrategyType.Spot,
                },
            });
        } else {
            // Create new position
            edwinLogger.debug(`Opening new position`);
            const minBinId = activeBin.binId - rangeInterval;
            const maxBinId = activeBin.binId + rangeInterval;

            // Create a new keypair for the position
            const newPositionKeypair = Keypair.generate();
            positionPubKey = newPositionKeypair.publicKey;
            signers.push(newPositionKeypair);

            await dlmmPool.refetchStates();

            // Add a short delay to avoid hitting rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Use try-catch to handle compute unit estimation failures gracefully
            // Add simple retry logic for rate limiting (429 errors)
            let retryCount = 0;
            const maxRetries = 3;
            let _lastError: unknown;

            while (retryCount <= maxRetries) {
                try {
                    tx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
                        positionPubKey: positionPubKey,
                        user: this.wallet.publicKey,
                        totalXAmount,
                        totalYAmount,
                        strategy: {
                            maxBinId,
                            minBinId,
                            strategyType: StrategyType.Spot,
                        },
                    });
                    break; // Success, exit retry loop
                } catch (error: unknown) {
                    _lastError = error;

                    // Log the actual error for debugging
                    edwinLogger.debug('Error in initializePositionAndAddLiquidityByStrategy:', error);

                    // Check if it's a rate limiting error
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    const isRateLimit =
                        errorMessage.includes('429') ||
                        errorMessage.includes('Request failed with status code 429') ||
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (error as any)?.response?.status === 429;

                    if (isRateLimit && retryCount < maxRetries) {
                        retryCount++;
                        edwinLogger.warn(`Rate limited, retrying in 3 seconds (attempt ${retryCount}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        continue;
                    }

                    // If not a rate limiting error or out of retries, throw the error
                    throw error;
                }
            }

            // Ensure tx is defined
            if (!tx) {
                throw new Error('Failed to create transaction after retries');
            }
        }

        // Simplified: Skip transaction simulation checks as they may be working around old SDK bugs

        // Unified approach: Let the wallet's sendTransaction method handle all signing
        // KeypairClient will handle additional signers in its sendTransaction method
        // Terminal wallet will need to handle multiple signers differently
        const signature = await this.wallet.sendTransaction(connection, tx, signers);

        // Wait for transaction confirmation
        const { value: confirmation } = await connection.confirmTransaction(signature, 'confirmed');

        if (confirmation.err) {
            throw new Error(`Transaction failed: Signature: ${signature}, Error: ${confirmation.err.toString()}`);
        }
        edwinLogger.info(`Transaction successful: ${signature}`);

        // Store the position address in our logs for reference
        edwinLogger.info(`Position public key: ${positionPubKey.toString()}`);

        // Just return the transaction signature
        return signature;
    }

    async addLiquidity(params: AddLiquidityParameters): Promise<string> {
        const { amount, amountB, poolAddress, rangeInterval } = params;
        edwinLogger.info(
            `Calling Meteora protocol to add liquidity to pool ${poolAddress} with ${amount} and ${amountB}`
        );

        try {
            if (!amount) {
                throw new Error('Amount for Asset A is required for Meteora liquidity provision');
            } else if (!amountB) {
                throw new Error('Amount for Asset B is required for Meteora liquidity provision');
            } else if (!poolAddress) {
                throw new Error('Pool address is required for Meteora liquidity provision');
            }

            // Retry logic at the higher level to catch all rate limiting errors
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount <= maxRetries) {
                try {
                    const result = await this.innerAddLiquidity(
                        poolAddress,
                        amount.toString(),
                        amountB.toString(),
                        rangeInterval ?? undefined
                    );
                    return result;
                } catch (error: unknown) {
                    // Handle MeteoraStatisticalBugError
                    if (error instanceof MeteoraStatisticalBugError) {
                        edwinLogger.info(
                            'Encountered Meteora statistical bug, closing position before raising error...'
                        );
                        try {
                            await withRetry(
                                async () =>
                                    this.removeLiquidity({
                                        poolAddress,
                                        positionAddress: error.positionAddress,
                                        shouldClosePosition: true,
                                    }),
                                'Meteora remove liquidity'
                            );
                        } catch (closeError) {
                            edwinLogger.error('Failed to close position:', closeError);
                        }
                        throw error;
                    }

                    // Check if it's a rate limiting error at any level
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    const isRateLimit =
                        errorMessage.includes('429') ||
                        errorMessage.includes('Request failed with status code 429') ||
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (error as any)?.response?.status === 429;

                    if (isRateLimit && retryCount < maxRetries) {
                        retryCount++;

                        // Check for Retry-After header in the response
                        let retryAfterSeconds = 5; // Default fallback
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const errorWithResponse = error as any;
                        if (errorWithResponse?.response?.headers) {
                            const retryAfterHeader =
                                errorWithResponse.response.headers['retry-after'] ||
                                errorWithResponse.response.headers['Retry-After'];
                            if (retryAfterHeader) {
                                const parsedRetryAfter = parseInt(retryAfterHeader, 10);
                                if (!isNaN(parsedRetryAfter)) {
                                    retryAfterSeconds = Math.min(parsedRetryAfter, 30); // Cap at 30 seconds
                                    edwinLogger.info(`Server requested retry after ${retryAfterSeconds} seconds`);
                                }
                            }
                        }

                        edwinLogger.warn(
                            `Rate limited, retrying in ${retryAfterSeconds} seconds (attempt ${retryCount}/${maxRetries})`
                        );
                        await new Promise(resolve => setTimeout(resolve, retryAfterSeconds * 1000));
                        continue;
                    }

                    // If not a rate limit error or out of retries, re-throw
                    throw error;
                }
            }

            // This should never be reached, but satisfies TypeScript
            throw new Error('Unexpected error: retry loop completed without result');
        } catch (error: unknown) {
            edwinLogger.error('Meteora add liquidity error:', error);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Meteora add liquidity failed: ${message}`);
        }
    }

    /**
     * Get position information from a transaction hash
     * @param txHash The transaction hash/signature from the addLiquidity operation
     * @returns Position address and liquidity added
     */
    async getPositionInfoFromTransaction(
        txHash: string
    ): Promise<{ positionAddress: string; liquidityAdded: [number, number] }> {
        try {
            const connection = this.wallet.getConnection();

            // Fetch transaction information
            const txInfo = await connection.getParsedTransaction(txHash, { maxSupportedTransactionVersion: 0 });
            if (!txInfo || !txInfo.meta) {
                throw new Error('Transaction information not found');
            }

            // Extract the position account (will be a signer other than the wallet)
            const positionAccount = txInfo.transaction.message.accountKeys.find(
                (account: { signer: boolean; pubkey: PublicKey }) =>
                    account.signer && !account.pubkey.equals(this.wallet.publicKey)
            );

            if (!positionAccount) {
                throw new Error('Position account not found in transaction');
            }

            const positionPubKey = positionAccount.pubkey.toString();

            // Get token amounts
            const verifiedTokenAmounts = await verifyAddLiquidityTokenAmounts(connection, txHash);
            if (verifiedTokenAmounts.length !== 2) {
                throw new Error('Expected 2 token amounts in tx verification, got ' + verifiedTokenAmounts.length);
            }

            return {
                positionAddress: positionPubKey,
                liquidityAdded: [verifiedTokenAmounts[0].uiAmount, verifiedTokenAmounts[1].uiAmount],
            };
        } catch (error) {
            edwinLogger.error('Error getting position info from transaction:', error);
            throw new Error(`Failed to get position info: ${error}`);
        }
    }

    async claimFees(params: PoolParameters): Promise<string> {
        const { poolAddress } = params;

        try {
            // Use Helius connection to avoid rate limits
            const connection = this.wallet.getConnection();
            const dlmmPool = await DLMM.create(connection, new PublicKey(poolAddress));
            const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(this.wallet.publicKey);

            if (!userPositions || userPositions.length === 0) {
                throw new Error('No positions found in this pool');
            }

            // Get the first position's data and log fees before claiming
            const position = userPositions[0];
            const positionBefore: PositionData = position.positionData;

            // Create claim fee transaction
            const claimFeeTx = await dlmmPool.claimSwapFee({
                owner: this.wallet.publicKey,
                position: position,
            });
            if (!claimFeeTx) {
                throw new Error('Failed to create claim fee transaction');
            }

            // Sign the transaction
            await this.wallet.signTransaction(claimFeeTx);

            // Send the transaction
            const signature = await connection.sendRawTransaction(claimFeeTx.serialize(), {
                skipPreflight: true,
                maxRetries: 3,
            });

            await connection.confirmTransaction(signature, 'confirmed');

            // Get updated position data after claiming
            const { userPositions: updatedPositions } = await dlmmPool.getPositionsByUserAndLbPair(
                this.wallet.publicKey
            );
            const updatedPosition = updatedPositions[0].positionData;

            return `Successfully claimed fees from pool ${poolAddress}
Transaction signature: ${signature}
Fees claimed:
- Token X: ${positionBefore.feeX.sub(updatedPosition.feeX).toString()}
- Token Y: ${positionBefore.feeY.sub(updatedPosition.feeY).toString()}`;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Meteora claim fees failed: ${message}`);
        }
    }

    async removeLiquidity(
        params: RemoveLiquidityParameters
    ): Promise<{ liquidityRemoved: [number, number]; feesClaimed: [number, number] }> {
        const { poolAddress, positionAddress, shouldClosePosition } = params;
        try {
            if (!poolAddress) {
                throw new Error('Pool address is required for Meteora liquidity removal');
            }
            const shouldClaimAndClose = shouldClosePosition ?? true;

            // Use Helius connection to avoid rate limits
            const connection = this.wallet.getConnection();
            const dlmmPool = await withRetry(
                async () => DLMM.create(connection, new PublicKey(poolAddress)),
                'Meteora create pool'
            );

            let position: LbPosition;
            if (!positionAddress) {
                const positionInfo = await withRetry(
                    async () => dlmmPool.getPositionsByUserAndLbPair(this.wallet.publicKey),
                    'Meteora get user positions'
                );
                const userPositions = positionInfo?.userPositions;
                if (!userPositions || userPositions.length === 0) {
                    throw new Error('No positions found in this pool');
                }
                // Get just the first position. Can be expanded in the future
                position = userPositions[0];
            } else {
                position = await withRetry(
                    async () => dlmmPool.getPosition(new PublicKey(positionAddress)),
                    'Meteora get position'
                );
            }

            const binData = position.positionData.positionBinData;
            const binIdsToRemove = binData.map(bin => bin.binId);
            // Remove 100% of liquidity from all bins
            const removeLiquidityTx = await dlmmPool.removeLiquidity({
                position: position.publicKey,
                user: this.wallet.publicKey,
                fromBinId: Math.min(...binIdsToRemove),
                toBinId: Math.max(...binIdsToRemove),
                bps: new BN(100 * 100), // 100%
                shouldClaimAndClose: shouldClaimAndClose,
            });

            // Handle multiple transactions if needed
            // Sum the total liquidity and fees claimed per token
            const tokenXAddress = dlmmPool.tokenX.publicKey.toString();
            const tokenYAddress = dlmmPool.tokenY.publicKey.toString();

            const liquidityRemoved: [number, number] = [0, 0];
            const feesClaimed: [number, number] = [0, 0];

            // Process transactions (could be an array)
            const txArray = Array.isArray(removeLiquidityTx) ? removeLiquidityTx : [removeLiquidityTx];

            for (const tx of txArray) {
                // Sign the transaction
                await this.wallet.signTransaction(tx);

                // Send the transaction
                const signature = await connection.sendRawTransaction(tx.serialize(), {
                    skipPreflight: true,
                    maxRetries: 3,
                });

                await connection.confirmTransaction(signature, 'confirmed');
                edwinLogger.info(`Transaction successful: ${signature}`);

                const balanceChanges = await extractBalanceChanges(connection, signature, tokenXAddress, tokenYAddress);
                liquidityRemoved[0] += balanceChanges.liquidityRemoved[0];
                liquidityRemoved[1] += balanceChanges.liquidityRemoved[1];
                feesClaimed[0] += balanceChanges.feesClaimed[0];
                feesClaimed[1] += balanceChanges.feesClaimed[1];
            }

            return { liquidityRemoved, feesClaimed };
        } catch (error: unknown) {
            edwinLogger.error('Meteora remove liquidity error:', error);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Meteora remove liquidity failed: ${message}`);
        }
    }
}

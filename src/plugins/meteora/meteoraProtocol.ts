import { EdwinSolanaWallet } from '../../core/wallets';
import DLMM, { StrategyType, BinLiquidity, PositionData, LbPosition, PositionInfo } from '@meteora-ag/dlmm';
import { Keypair, PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import edwinLogger from '../../utils/logger';
import {
    calculateAmounts,
    extractBalanceChanges,
    simulateAddLiquidityTransaction,
    verifyAddLiquidityTokenAmounts,
} from './utils';
import { withRetry } from '../../utils';
import { MeteoraStatisticalBugError } from './errors';
import {
    AddLiquidityParameters,
    RemoveLiquidityParameters,
    PoolParameters,
    GetPoolsParameters,
} from './parameters';
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
    private wallet: EdwinSolanaWallet;

    constructor(wallet: EdwinSolanaWallet) {
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
            async () => dlmmPool.getPositionsByUserAndLbPair(this.wallet.getPublicKey()),
            'Meteora get user positions'
        );
        return userPositions;
    }

    async getPositions(): Promise<Map<string, PositionInfo>> {
        try {
            const connection = this.wallet.getConnection();

            return await withRetry(
                async () => DLMM.getAllLbPairPositionsByUser(connection, this.wallet.getPublicKey()),
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
        const connection = this.wallet.getConnection();

        return await withRetry(async () => {
            const dlmmPool = await DLMM.create(connection, new PublicKey(poolAddress));
            return dlmmPool.getActiveBin();
        }, 'Meteora getActiveBin');
    }

    private async innerAddLiquidity(
        poolAddress: string,
        amount: string,
        amountB: string,
        rangeInterval: number = 10
    ): Promise<{ positionAddress: string; liquidityAdded: [number, number] }> {
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
            async () => dlmmPool.getPositionsByUserAndLbPair(this.wallet.getPublicKey()),
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
        const signers: Keypair[] = [this.wallet.getSigner()];

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
                user: this.wallet.getPublicKey(),
                totalXAmount,
                totalYAmount,
                strategy: {
                    maxBinId,
                    minBinId,
                    strategyType: StrategyType.SpotImBalanced,
                },
            });
        } else {
            // Create new position
            edwinLogger.debug(`Opening new position`);
            const minBinId = activeBin.binId - rangeInterval;
            const maxBinId = activeBin.binId + rangeInterval;

            const newBalancePosition = Keypair.generate();
            positionPubKey = newBalancePosition.publicKey;
            await dlmmPool.refetchStates();
            tx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
                positionPubKey: positionPubKey,
                user: this.wallet.getPublicKey(),
                totalXAmount,
                totalYAmount,
                strategy: {
                    maxBinId,
                    minBinId,
                    strategyType: StrategyType.SpotImBalanced,
                },
            });
            signers.push(newBalancePosition as Keypair);
        }

        const simulatedTokenAmounts = await simulateAddLiquidityTransaction(connection, tx, this.wallet);
        if (simulatedTokenAmounts.length != 2) {
            throw new Error('Expected 2 token amounts in tx simulation, got ' + simulatedTokenAmounts.length);
        }
        for (const tokenAmount of simulatedTokenAmounts) {
            if (tokenAmount.uiAmount === 0) {
                throw new Error('Token amount in transaction simulation is 0, aborting transaction');
            }
        }
        const signature = await this.wallet.sendTransaction(connection, tx, signers);
        const confirmation = await this.wallet.waitForConfirmationGracefully(connection, signature);
        if (confirmation.err) {
            throw new Error(`Transaction failed: Signature: ${signature}, Error: ${confirmation.err.toString()}`);
        }
        edwinLogger.info(`Transaction successful: ${signature}`);

        const verifiedTokenAmounts = await verifyAddLiquidityTokenAmounts(connection, signature);
        if (verifiedTokenAmounts.length != 2) {
            throw new Error('Expected 2 token amounts in tx verification, got ' + verifiedTokenAmounts.length);
        }
        if (
            (Number(amount) > 0 && verifiedTokenAmounts[0].uiAmount == 0) ||
            (Number(amountB) > 0 && verifiedTokenAmounts[1].uiAmount == 0)
        ) {
            edwinLogger.info('Encountered a statistical bug where not all of the liquidity was added to the pool');
            throw new MeteoraStatisticalBugError('Meteora statistical bug', positionPubKey.toString());
        }
        return {
            positionAddress: positionPubKey.toString(),
            liquidityAdded: [verifiedTokenAmounts[0].uiAmount, verifiedTokenAmounts[1].uiAmount],
        };
    }

    async addLiquidity(
        params: AddLiquidityParameters
    ): Promise<{ positionAddress: string; liquidityAdded: [number, number] }> {
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

            try {
                const result = await this.innerAddLiquidity(
                    poolAddress,
                    amount.toString(),
                    amountB.toString(),
                    rangeInterval
                );
                return result;
            } catch (error) {
                if (error instanceof MeteoraStatisticalBugError) {
                    edwinLogger.info('Encountered Meteora statistical bug, closing position before raising error...');
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
                }
                throw error;
            }
        } catch (error: unknown) {
            edwinLogger.error('Meteora add liquidity error:', error);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Meteora add liquidity failed: ${message}`);
        }
    }

    async claimFees(params: PoolParameters): Promise<string> {
        const { poolAddress } = params;

        try {
            const connection = this.wallet.getConnection();
            const dlmmPool = await DLMM.create(connection, new PublicKey(poolAddress));
            const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(this.wallet.getPublicKey());

            if (!userPositions || userPositions.length === 0) {
                throw new Error('No positions found in this pool');
            }

            // Get the first position's data and log fees before claiming
            const position = userPositions[0];
            const positionBefore: PositionData = position.positionData;

            // Create claim fee transaction
            const claimFeeTx = await dlmmPool.claimSwapFee({
                owner: this.wallet.getPublicKey(),
                position: position,
            });

            // Send and confirm transaction
            const signature = await this.wallet.sendTransaction(connection, claimFeeTx, [this.wallet.getSigner()]);
            await this.wallet.waitForConfirmationGracefully(connection, signature);

            // Get updated position data after claiming
            const { userPositions: updatedPositions } = await dlmmPool.getPositionsByUserAndLbPair(
                this.wallet.getPublicKey()
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
            const shouldClaimAndClose = shouldClosePosition !== undefined ? shouldClosePosition : true;

            const connection = this.wallet.getConnection();
            const dlmmPool = await withRetry(
                async () => DLMM.create(connection, new PublicKey(poolAddress)),
                'Meteora create pool'
            );

            let position: LbPosition;
            if (!positionAddress) {
                const positionInfo = await withRetry(
                    async () => dlmmPool.getPositionsByUserAndLbPair(this.wallet.getPublicKey()),
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
                user: this.wallet.getPublicKey(),
                binIds: binIdsToRemove,
                bps: new BN(100 * 100), // 100%
                shouldClaimAndClose: shouldClaimAndClose,
            });

            // Handle multiple transactions if needed
            // Sum the total liquidity and fees claimed per token
            const tokenXAddress = dlmmPool.tokenX.publicKey.toString();
            const tokenYAddress = dlmmPool.tokenY.publicKey.toString();

            const liquidityRemoved: [number, number] = [0, 0];
            const feesClaimed: [number, number] = [0, 0];

            for (const tx of Array.isArray(removeLiquidityTx) ? removeLiquidityTx : [removeLiquidityTx]) {
                const signature = await this.wallet.sendTransaction(connection, tx, [this.wallet.getSigner()]);
                await this.wallet.waitForConfirmationGracefully(connection, signature);
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

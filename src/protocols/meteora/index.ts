import { IDEXProtocol, LiquidityParams, SupportedChain } from '../../types';
import { EdwinSolanaWallet } from '../../edwin-core/wallets/solana_wallet/solana_wallet';
import DLMM, { StrategyType, BinLiquidity, PositionData, LbPosition } from '@meteora-ag/dlmm';
import { Keypair, PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import edwinLogger from '../../utils/logger';
import {
    calculateAmounts,
    extractBalanceChanges,
    withRetry,
    simulateAddLiquidityTransaction,
    verifyAddLiquidityTokenAmounts,
} from './utils';
import { MeteoraStatisticalBugError } from '../../errors';

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

export class MeteoraProtocol implements IDEXProtocol {
    private static readonly BASE_URL = 'https://dlmm-api.meteora.ag';
    public supportedChains: SupportedChain[] = ['solana'];

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

    async getPools(params: LiquidityParams, limit: number = 10): Promise<MeteoraPoolOutput[]> {
        const { asset, assetB } = params;
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

    async getPositionsFromPool(params: LiquidityParams): Promise<Array<LbPosition>> {
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

    async getPositions(params: LiquidityParams): Promise<any> {
        try {
            edwinLogger.info('GetPositions params: ', params);
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

    async getActiveBin(params: LiquidityParams): Promise<BinLiquidity> {
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
        amountB: string
    ): Promise<{ liquidityAdded: [number, number] }> {
        const connection = this.wallet.getConnection();
        const dlmmPool = await withRetry(
            async () => DLMM.create(connection, new PublicKey(poolAddress)),
            'Meteora create pool'
        );
        // Wrap the position check in retry logic
        const positionInfo = await withRetry(
            async () => dlmmPool.getPositionsByUserAndLbPair(this.wallet.getPublicKey()),
            'Meteora get user positions'
        );
        const existingPosition = positionInfo?.userPositions?.[0];

        const activeBin = await withRetry(async () => dlmmPool.getActiveBin(), 'Meteora get active bin');
        const activeBinPricePerToken = dlmmPool.fromPricePerLamport(Number(activeBin.price));
        const [totalXAmount, totalYAmount] = await calculateAmounts(amount, amountB, activeBinPricePerToken, dlmmPool);
        edwinLogger.debug(`Adding liquidity with Total X amount: ${totalXAmount}, Total Y amount: ${totalYAmount}`);

        let tx;
        let positionPubKey: PublicKey;
        let signers: Keypair[] = [this.wallet.getSigner()];

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
            let newBalancePosition;
            edwinLogger.debug(`Opening new position`);
            const rangeInterval = Number(process.env.METEORA_TOTAL_RANGE_INTERVAL) || 10;
            const minBinId = activeBin.binId - rangeInterval;
            const maxBinId = activeBin.binId + rangeInterval;

            newBalancePosition = Keypair.generate();
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
            throw new MeteoraStatisticalBugError('Meteora statistical bug');
        }
        return { liquidityAdded: [verifiedTokenAmounts[0].uiAmount, verifiedTokenAmounts[1].uiAmount] };
    }

    async addLiquidity(params: LiquidityParams): Promise<{ liquidityAdded: [number, number] }> {
        const { chain, amount, amountB, poolAddress } = params;
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
            } else if (chain.toLowerCase() !== 'solana') {
                throw new Error('Meteora protocol only supports Solana');
            }

            let attempts = 0;
            const MAX_ATTEMPTS = 3;

            while (attempts < MAX_ATTEMPTS) {
                try {
                    const result = await this.innerAddLiquidity(poolAddress, amount, amountB);
                    return result;
                } catch (error) {
                    if (error instanceof MeteoraStatisticalBugError) {
                        attempts++;
                        edwinLogger.info(
                            `Attempt ${attempts}: Encountered Meteora statistical bug, closing position and retrying...`
                        );

                        if (attempts < MAX_ATTEMPTS) {
                            // Close the position before retrying
                            await this.removeLiquidity({
                                chain: 'solana',
                                poolAddress,
                                shouldClosePosition: true,
                            });
                            continue;
                        }
                    }
                    throw error;
                }
            }

            throw new Error(`Failed to add liquidity after ${MAX_ATTEMPTS} attempts due to statistical bug`);
        } catch (error: unknown) {
            edwinLogger.error('Meteora add liquidity error:', error);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Meteora add liquidity failed: ${message}`);
        }
    }

    async claimFees(params: any): Promise<string> {
        const { chain, poolAddress } = params;
        if (chain !== 'solana') {
            throw new Error('Meteora protocol only supports Solana');
        }

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

    async removeLiquidity(params: any): Promise<{ liquidityRemoved: [number, number]; feesClaimed: [number, number] }> {
        const { chain, poolAddress, shouldClosePosition } = params;
        try {
            if (chain !== 'solana') {
                throw new Error('Meteora protocol only supports Solana');
            }
            if (!poolAddress) {
                throw new Error('Pool address is required for Meteora liquidity removal');
            }
            let shouldClaimAndClose = shouldClosePosition !== undefined ? shouldClosePosition : true;

            const connection = this.wallet.getConnection();
            const dlmmPool = await withRetry(
                async () => DLMM.create(connection, new PublicKey(poolAddress)),
                'Meteora create pool'
            );

            const positionInfo = await withRetry(
                async () => dlmmPool.getPositionsByUserAndLbPair(this.wallet.getPublicKey()),
                'Meteora get user positions'
            );
            const userPositions = positionInfo?.userPositions;
            if (!userPositions || userPositions.length === 0) {
                throw new Error('No positions found in this pool');
            }
            ``;
            // Get just the first position. Can be expanded in the future
            const binData = userPositions[0].positionData.positionBinData;
            const binIdsToRemove = binData.map(bin => bin.binId);
            // Remove 100% of liquidity from all bins
            const removeLiquidityTx = await dlmmPool.removeLiquidity({
                position: userPositions[0].publicKey,
                user: this.wallet.getPublicKey(),
                binIds: binIdsToRemove,
                bps: new BN(100 * 100), // 100%
                shouldClaimAndClose: shouldClaimAndClose,
            });

            // Handle multiple transactions if needed
            // Sum the total liquidity and fees claimed per token
            const tokenXAddress = dlmmPool.tokenX.publicKey.toString();
            const tokenYAddress = dlmmPool.tokenY.publicKey.toString();

            let liquidityRemoved: [number, number] = [0, 0];
            let feesClaimed: [number, number] = [0, 0];

            for (let tx of Array.isArray(removeLiquidityTx) ? removeLiquidityTx : [removeLiquidityTx]) {
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

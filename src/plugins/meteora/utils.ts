import {
    Connection,
    ParsedTransactionWithMeta,
    Transaction,
    TransactionMessage,
    VersionedTransaction,
    ParsedInstruction as SolanaParsedInstruction,
} from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import DLMM, { TokenReserve } from '@meteora-ag/dlmm';
import edwinLogger from '../../utils/logger';
import { EdwinSolanaWallet } from '../../core/wallets';

interface TokenAmount {
    amount: string;
    decimals: number;
    uiAmount: number;
    uiAmountString: string;
}

interface TransferInfo {
    amount: string;
    authority: string;
    destination: string;
    mint: string;
    source: string;
    tokenAmount: TokenAmount;
}

interface ParsedInstruction extends Omit<SolanaParsedInstruction, 'program' | 'parsed'> {
    program: string | undefined;
    parsed?: {
        type: string;
        info: TransferInfo;
    };
}

interface InnerInstruction {
    index: number;
    instructions: ParsedInstruction[];
}

interface BalanceChanges {
    liquidityRemoved: [number, number];
    feesClaimed: [number, number];
}

export async function calculateAmounts(
    amount: string,
    amountB: string,
    activeBinPricePerToken: string,
    dlmmPool: DLMM
): Promise<[BN, BN]> {
    let totalXAmount;
    let totalYAmount;

    // Helper function to safely get decimals
    const getDecimals = (token: TokenReserve): number => {
        if (token.mint) {
            return token.mint.decimals;
        } else if ('decimal' in token) {
            if (typeof token.decimal === 'number') {
                return token.decimal;
            }
            return 0;
        } else {
            return 0;
        }
    };

    const tokenXDecimals = getDecimals(dlmmPool.tokenX);
    const tokenYDecimals = getDecimals(dlmmPool.tokenY);

    if (amount === 'auto' && amountB === 'auto') {
        throw new TypeError(
            "Amount for both first asset and second asset cannot be 'auto' for Meteora liquidity provision"
        );
    } else if (!amount || !amountB) {
        throw new TypeError('Both amounts must be specified for Meteora liquidity provision');
    }

    if (amount === 'auto') {
        // Calculate amount based on amountB
        if (!isNaN(Number(amountB))) {
            totalXAmount = new BN((Number(amountB) / Number(activeBinPricePerToken)) * 10 ** tokenXDecimals);
            totalYAmount = new BN(Number(amountB) * 10 ** tokenYDecimals);
        } else {
            throw new TypeError('Invalid amountB value for second token for Meteora liquidity provision');
        }
    } else if (amountB === 'auto') {
        // Calculate amountB based on amount
        if (!isNaN(Number(amount))) {
            totalXAmount = new BN(Number(amount) * 10 ** tokenXDecimals);
            totalYAmount = new BN(Number(amount) * Number(activeBinPricePerToken) * 10 ** tokenYDecimals);
        } else {
            throw new TypeError('Invalid amount value for first token for Meteora liquidity provision');
        }
    } else if (!isNaN(Number(amount)) && !isNaN(Number(amountB))) {
        // Both are numbers
        totalXAmount = new BN(Number(amount) * 10 ** tokenXDecimals);
        totalYAmount = new BN(Number(amountB) * 10 ** tokenYDecimals);
    } else {
        throw new TypeError("Both amounts must be numbers or 'auto' for Meteora liquidity provision");
    }
    return [totalXAmount, totalYAmount];
}

export async function getParsedTransactionWithRetries(
    connection: Connection,
    signature: string
): Promise<ParsedTransactionWithMeta> {
    for (let i = 0; i < 5; i++) {
        const txInfo = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
        if (txInfo) {
            return txInfo;
        }
        if (i < 2) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    throw new Error('Failed to get parsed transaction after 3 attempts');
}

export async function extractBalanceChanges(
    connection: Connection,
    signature: string,
    tokenXAddress: string,
    tokenYAddress: string
): Promise<BalanceChanges> {
    const METEORA_DLMM_PROGRAM_ID = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo';

    const txInfo = await getParsedTransactionWithRetries(connection, signature);

    if (!txInfo || !txInfo.meta) {
        throw new Error('Transaction details not found or not parsed');
    }

    const outerInstructions = txInfo.transaction.message.instructions as ParsedInstruction[];
    const innerInstructions = txInfo.meta.innerInstructions || [];

    const innerMap: Record<number, ParsedInstruction[]> = {};
    for (const inner of innerInstructions) {
        innerMap[inner.index] = inner.instructions as ParsedInstruction[];
    }

    const meteoraInstructionIndices: number[] = [];
    outerInstructions.forEach((ix, index) => {
        if (ix.programId?.toString() === METEORA_DLMM_PROGRAM_ID) {
            meteoraInstructionIndices.push(index);
        }
    });

    if (meteoraInstructionIndices.length < 2) {
        throw new Error('Expected at least two Meteora instructions in the transaction');
    }

    const removeLiquidityIndex = meteoraInstructionIndices[0];
    const claimFeeIndex = meteoraInstructionIndices[1];

    const decodeTokenTransfers = (instructions: ParsedInstruction[]): TransferInfo[] => {
        const transfers: TransferInfo[] = [];
        for (const ix of instructions) {
            if (ix.program === 'spl-token' && ix.parsed?.type === 'transferChecked') {
                transfers.push(ix.parsed.info);
            }
        }
        return transfers;
    };

    const removeLiquidityTransfers = innerMap[removeLiquidityIndex]
        ? decodeTokenTransfers(innerMap[removeLiquidityIndex])
        : [];
    const claimFeeTransfers = innerMap[claimFeeIndex] ? decodeTokenTransfers(innerMap[claimFeeIndex]) : [];

    const liquidityRemovedA =
        removeLiquidityTransfers.find(transfer => transfer.mint === tokenXAddress)?.tokenAmount.uiAmount || 0;
    const liquidityRemovedB =
        removeLiquidityTransfers.find(transfer => transfer.mint === tokenYAddress)?.tokenAmount.uiAmount || 0;

    const feesClaimedA = claimFeeTransfers.find(transfer => transfer.mint === tokenXAddress)?.tokenAmount.uiAmount || 0;
    const feesClaimedB = claimFeeTransfers.find(transfer => transfer.mint === tokenYAddress)?.tokenAmount.uiAmount || 0;

    return {
        liquidityRemoved: [liquidityRemovedA, liquidityRemovedB],
        feesClaimed: [feesClaimedA, feesClaimedB],
    };
}

export async function extractAddLiquidityTokenAmounts(innerInstructions: InnerInstruction[]): Promise<TokenAmount[]> {
    const tokenAmounts: TokenAmount[] = [];
    for (const innerInstruction of innerInstructions) {
        if (innerInstruction.instructions) {
            for (const instruction of innerInstruction.instructions) {
                if (instruction.parsed?.type === 'transferChecked') {
                    edwinLogger.debug(`Transfer info amounts: ${JSON.stringify(instruction.parsed.info.tokenAmount)}`);
                    tokenAmounts.push(instruction.parsed.info.tokenAmount);
                }
            }
        }
    }
    return tokenAmounts;
}

interface SimulationInnerInstructions {
    innerInstructions?: InnerInstruction[];
}

interface SimulationResult {
    value: SimulationInnerInstructions;
}

export async function simulateAddLiquidityTransaction(
    connection: Connection,
    tx: Transaction,
    wallet: EdwinSolanaWallet
): Promise<TokenAmount[]> {
    const latestBlockhash = await connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
        payerKey: wallet.getPublicKey(),
        recentBlockhash: latestBlockhash.blockhash,
        instructions: tx.instructions,
    }).compileToV0Message();
    const versionedTx = new VersionedTransaction(messageV0);

    const simulationResult = (await connection.simulateTransaction(versionedTx, {
        innerInstructions: true,
    })) as SimulationResult;

    const innerInstructions = simulationResult.value.innerInstructions;
    if (!innerInstructions) {
        throw new Error('Inner instructions not found in simulation result');
    }

    return extractAddLiquidityTokenAmounts(innerInstructions);
}

export async function verifyAddLiquidityTokenAmounts(
    connection: Connection,
    signature: string
): Promise<TokenAmount[]> {
    const txInfo = await getParsedTransactionWithRetries(connection, signature);

    if (!txInfo || !txInfo.meta) {
        throw new Error('Transaction details not found or not parsed');
    }

    const innerInstructions = txInfo.meta.innerInstructions || [];
    return extractAddLiquidityTokenAmounts(innerInstructions as InnerInstruction[]);
}

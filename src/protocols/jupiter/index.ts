import { ISwapProtocol, SupportedChain } from '../../types';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import { EdwinSolanaWallet } from '../../edwin-core/wallets/solana_wallet/solana_wallet';
import { withRetry } from '../../utils';

interface JupiterQuoteParams {
    inputMint: string;
    outputMint: string;
    amount: string | number;
    slippageBps?: number;
}

interface SwapInfo {
    ammKey: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
}

interface RoutePlan {
    swapInfo: SwapInfo;
    percent: number;
}

interface JupiterQuoteResponse {
    inputMint: string;
    inAmount: string;
    outputMint: string;
    outAmount: string;
    otherAmountThreshold: string;
    swapMode: string;
    slippageBps: number;
    platformFee: null | any;
    priceImpactPct: string;
    routePlan: RoutePlan[];
    contextSlot: number;
    timeTaken: number;
}

interface PriorityLevel {
    maxLamports: number;
    priorityLevel: 'veryHigh' | 'high' | 'medium' | 'low';
}

interface SwapRequestBody {
    quoteResponse: JupiterQuoteResponse;
    userPublicKey: string;
    dynamicComputeUnitLimit?: boolean;
    dynamicSlippage?: boolean;
    prioritizationFeeLamports?: {
        priorityLevelWithMaxLamports: PriorityLevel;
    };
}

interface DynamicSlippageReport {
    slippageBps: number;
    otherAmount: number;
    simulatedIncurredSlippageBps: number;
    amplificationRatio: string;
    categoryName: string;
    heuristicMaxSlippageBps: number;
}

interface PrioritizationType {
    computeBudget: {
        microLamports: number;
        estimatedMicroLamports: number;
    };
}

interface SwapResponse {
    swapTransaction: string;
    lastValidBlockHeight: number;
    prioritizationFeeLamports: number;
    computeUnitLimit: number;
    prioritizationType: PrioritizationType;
    dynamicSlippageReport: DynamicSlippageReport;
    simulationError: null | string;
}

interface SwapParams {
    asset: string;
    assetB: string;
    amount: string;
}

export class JupiterProtocol implements ISwapProtocol {
    supportedChains: SupportedChain[] = ['solana'];
    JUPITER_API_URL = 'https://api.jup.ag/swap/v1/';

    private wallet: EdwinSolanaWallet;

    constructor(wallet: EdwinSolanaWallet) {
        this.wallet = wallet;
    }

    async swap(params: SwapParams): Promise<number> {
        const { asset, assetB, amount } = params;
        if (!asset || !assetB || !amount) {
            throw new Error('Invalid swap params. Need: asset, assetB, amount');
        }
        await this.wallet.verifyBalance(asset, Number(amount));

        // 1. Get quote from Jupiter
        const inputMint = await this.wallet.getTokenAddress(asset);
        const outputMint = await this.wallet.getTokenAddress(assetB);
        if (!inputMint || !outputMint) {
            throw new Error(`Invalid asset: ${asset} or ${assetB}`);
        }

        // Get token decimals and adjust amount
        const connection = this.wallet.getConnection();
        const mintInfo = await connection.getParsedAccountInfo(new PublicKey(inputMint));
        if (!mintInfo.value || !('parsed' in mintInfo.value.data)) {
            throw new Error('Could not fetch mint info');
        }
        const decimals = mintInfo.value.data.parsed.info.decimals;
        const adjustedAmount = (Number(amount) * Math.pow(10, decimals)).toString();
        // Cast adjusted amount to integer to avoid scientific notation
        const adjustedAmountInt = BigInt(Math.floor(Number(adjustedAmount))).toString();
        const quoteParams = { inputMint, outputMint, amount: adjustedAmountInt };
        const quote = await this.getQuote(quoteParams);

        // 2. Get serialized transaction
        const swapResponse = await this.getSerializedTransaction(quote, this.wallet.getPublicKey().toString());

        // 3. Deserialize the transaction
        const transaction = VersionedTransaction.deserialize(Buffer.from(swapResponse.swapTransaction, 'base64'));

        // 4. Sign the transaction
        this.wallet.signTransaction(transaction);

        // 5. Serialize and send the transaction
        const rawTransaction = transaction.serialize();
        // 6. Send transaction with optimized parameters
        const signature = await connection.sendRawTransaction(rawTransaction, {
            maxRetries: 2,
            skipPreflight: true,
        });

        // 7. Wait for confirmation
        await this.wallet.waitForConfirmationGracefully(connection, signature);

        // 8. Retrieve the actual output amount based on the output asset type:
        //    - For SOL, check lamport balance changes (and add back the fee).
        //    - For SPL tokens, check the token account balance changes.
        let actualOutputAmount: number;
        // Fetch the parsed transaction details (make sure to set the proper options)
        const txInfo = await withRetry(
            () => connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 }),
            'Get parsed transaction',
            20
        );
        if (!txInfo || !txInfo.meta) {
            throw new Error('Could not fetch transaction details');
        }

        actualOutputAmount = await this.wallet.getTransactionTokenBalanceChange(signature, assetB);
        return actualOutputAmount;
    }

    async getQuote(params: JupiterQuoteParams): Promise<JupiterQuoteResponse> {
        const { inputMint, outputMint, amount, slippageBps = 50 } = params;

        const queryParams = new URLSearchParams({
            inputMint,
            outputMint,
            amount: amount.toString(),
            slippageBps: slippageBps.toString(),
        });

        const response = await fetch(`${this.JUPITER_API_URL}quote?${queryParams}`);

        if (!response.ok) {
            throw new Error(`Jupiter API error: ${response.statusText}`);
        }

        return response.json();
    }

    async getSerializedTransaction(quote: JupiterQuoteResponse, walletAddress: string): Promise<SwapResponse> {
        const body: SwapRequestBody = {
            quoteResponse: quote,
            userPublicKey: walletAddress,
            // Optimize for transaction landing
            dynamicComputeUnitLimit: true,
            dynamicSlippage: true,
            prioritizationFeeLamports: {
                priorityLevelWithMaxLamports: {
                    maxLamports: 1000000,
                    priorityLevel: 'veryHigh',
                },
            },
        };

        const response = await fetch(`${this.JUPITER_API_URL}swap`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Jupiter API error: ${response.statusText}`);
        }

        return response.json();
    }
}

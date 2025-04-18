import { SupportedChain } from '../../core/types';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import { EdwinSolanaWallet } from '../../core/wallets';
import { SwapParameters } from './parameters';
import { InsufficientBalanceError } from '../../errors';
import { createJupiterApiClient } from '@jup-ag/api';

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

export interface JupiterQuoteParameters {
    inputMint: string;
    outputMint: string;
    amount: string | number;
    slippageBps?: number;
}

interface PlatformFee {
    amount: string;
    feeBps: number;
}

interface JupiterQuoteResponse {
    inputMint: string;
    inAmount: string;
    outputMint: string;
    outAmount: string;
    otherAmountThreshold: string;
    swapMode: string;
    slippageBps: number;
    platformFee: PlatformFee | null;
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

export class JupiterService {
    supportedChains: SupportedChain[] = ['solana'];
    JUPITER_API_URL = 'https://api.jup.ag/swap/v1/';
    TOKEN_LIST_URL = 'https://tokens.jup.ag/tokens?tags=verified';

    private wallet: EdwinSolanaWallet;
    private jupiterClient: ReturnType<typeof createJupiterApiClient>;

    constructor(wallet: EdwinSolanaWallet) {
        this.wallet = wallet;
        this.jupiterClient = createJupiterApiClient();
    }

    async swap(params: SwapParameters): Promise<number> {
        const { inputMint, outputMint, amount } = params;
        if (!inputMint || !outputMint || !amount) {
            throw new Error('Invalid swap params. Need: inputMint, outputMint, amount');
        }

        const balance = await this.wallet.getBalance(inputMint);
        if (balance < Number(amount)) {
            throw new InsufficientBalanceError(Number(amount), balance, inputMint);
        }

        // 1. Get quote from Jupiter
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

        // 8. Retrieve the actual output amount based on the output mint
        return await this.wallet.getTransactionTokenBalanceChange(signature, outputMint);
    }

    async getQuote(params: JupiterQuoteParameters): Promise<JupiterQuoteResponse> {
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

    /**
     * Gets the token mint address for a given ticker symbol
     * @param ticker The token ticker/symbol to lookup (case-sensitive)
     * @returns The mint address or null if not found
     */
    async getTokenAddressFromTicker(ticker: string): Promise<string | null> {
        try {
            const response = await fetch(this.TOKEN_LIST_URL);
            if (!response.ok) {
                throw new Error(`Failed to fetch token list: ${response.statusText}`);
            }

            interface JupiterToken {
                symbol: string;
                address: string;
            }

            const tokens = (await response.json()) as JupiterToken[];
            const hit = tokens.find(t => t.symbol.toUpperCase() === ticker.toUpperCase());

            if (!hit) {
                throw new Error(
                    `Token ${ticker} not found in Jupiter's verified token list. This token may exist but is not yet verified. Please find and verify the contract address manually.`
                );
            }

            return hit.address;
        } catch (error) {
            console.error('Error fetching token address:', error);
            throw error;
        }
    }
}

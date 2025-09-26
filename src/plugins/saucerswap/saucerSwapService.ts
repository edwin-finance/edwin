import { EdwinService } from '../../core/classes/edwinToolProvider';
import { HederaWalletClient } from '../../core/wallets/hedera_wallet';
import edwinLogger from '../../utils/logger';
import {
    ContractExecuteTransaction,
    ContractId,
    AccountId,
    Hbar,
    HbarUnit,
    TokenAssociateTransaction,
    AccountAllowanceApproveTransaction,
    TokenId
} from '@hashgraph/sdk';
import { ethers } from 'ethers';
import {
    SaucerSwapQuoteParameters,
    SaucerSwapQuoteExactOutputParameters,
    SaucerSwapExactInputParameters,
    SaucerSwapExactOutputParameters,
} from './parameters';

interface NetworkConfig {
    swapRouterContractId: string;
    quoterContractId: string;
    hbarTokenId: string;
    whbarTokenId: string;
    hederaJsonRpcUrl: string;
}

export class SaucerSwapService extends EdwinService {
    private static readonly NETWORK_CONFIG = {
        mainnet: {
            swapRouterContractId: '0.0.3949434', // SaucerSwapV2SwapRouter
            quoterContractId: '0.0.3949424', // SaucerSwapV2QuoterV2
            hbarTokenId: 'HBAR', // Native HBAR
            whbarTokenId: '0.0.1456986', // Wrapped HBAR token ID (from official SaucerSwap docs)
            hederaJsonRpcUrl: 'https://mainnet.hashio.io/api', // Hedera JSON RPC
        },
    };

    private static readonly DEFAULT_FEE = '0001F4'; // 0.05% fee (500 basis points = 0x01F4) - most common pool tier
    private static readonly MEDIUM_FEE = '000BB8'; // 0.30% fee (3000 basis points = 0x0BB8) - medium pool tier
    private static readonly HIGH_FEE = '002710'; // 1.00% fee (10000 basis points = 0x2710) - high pool tier
    private static readonly USDC_TOKEN_ID = '0.0.456858'; // USDC token ID for multi-hop routing
    private static readonly GAS_LIMIT = 3000000;
    private static readonly HBAR_DECIMALS = 8;

    // Official SaucerSwap V2 ABIs from docs
    private static readonly QUOTER_ABI = [
        'function quoteExactInput(bytes memory path, uint256 amountIn) external returns (uint256 amountOut, uint160[] memory sqrtPriceX96AfterList, uint32[] memory initializedTicksCrossedList, uint256 gasEstimate)',
        'function quoteExactOutput(bytes memory path, uint256 amountOut) external returns (uint256 amountIn, uint160[] memory sqrtPriceX96AfterList, uint32[] memory initializedTicksCrossedList, uint256 gasEstimate)',
    ];

    private static readonly SWAP_ROUTER_ABI = [
        'function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum) params) external payable returns (uint256 amountOut)',
        'function exactOutput((bytes path, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum) params) external payable returns (uint256 amountIn)',
        'function refundETH() external payable',
        'function unwrapWHBAR(uint256 amountMinimum, address recipient) external payable',
        'function multicall(bytes[] calldata data) external payable returns (bytes[] memory results)',
    ];

    constructor(private wallet: HederaWalletClient) {
        super();
    }

    /**
     * Get a quote for swapping tokens using official SaucerSwap V2 quoter with multi-hop routing
     */
    async getQuote(params: SaucerSwapQuoteParameters): Promise<number> {
        edwinLogger.info(
            `Getting SaucerSwap quote for ${params.amount} ${params.inputTokenId} -> ${params.outputTokenId} on ${params.network}`
        );

        // Early parameter validation
        if (params.amount <= 0) {
            throw new Error('Quote amount must be greater than zero');
        }

        try {
            const config = SaucerSwapService.NETWORK_CONFIG.mainnet;

            // Set up ethers provider (Ethers v5 syntax)
            const provider = new ethers.providers.JsonRpcProvider(config.hederaJsonRpcUrl);

            // Load ABI data containing QuoterV2 functions (per docs)
            const abiInterfaces = new ethers.utils.Interface(SaucerSwapService.QUOTER_ABI);

            // QuoterV2.sol contract (per docs)
            const quoterEvmAddress = `0x${ContractId.fromString(config.quoterContractId).toEvmAddress()}`;

            // Handle HBAR -> WHBAR conversion for path encoding (per docs)
            const inputTokenForPath = params.inputTokenId === 'HBAR' ? config.whbarTokenId : params.inputTokenId;

            // Convert token IDs to solidity addresses (per docs)
            const inputToken = ContractId.fromString(inputTokenForPath);
            const outputToken = ContractId.fromString(params.outputTokenId);

            // Get proper decimals for calculations
            const inputDecimals =
                params.inputTokenId === 'HBAR'
                    ? SaucerSwapService.HBAR_DECIMALS
                    : await this.wallet.getTokenDecimals(params.inputTokenId);

            const inputAmountInSmallestUnit = Math.floor(params.amount * Math.pow(10, inputDecimals));

            // Try different fee tiers and multi-hop routing
            const pathVariations = await this.generatePathVariations(
                inputToken.toEvmAddress(),
                outputToken.toEvmAddress()
            );

            // Try each path variation until one works
            let lastError: Error | null = null;
            for (const { path, description } of pathVariations) {
                try {
                    edwinLogger.info(`Trying ${description}`);
                    const encodedPathData = this.hexToUint8Array(path);

                    // Continue with quote attempt using this path
                    return await this.attemptQuote(
                        provider,
                        abiInterfaces,
                        quoterEvmAddress,
                        encodedPathData,
                        inputAmountInSmallestUnit,
                        params.outputTokenId
                    );
                } catch (error) {
                    lastError = error as Error;
                    edwinLogger.warn(`${description} failed: ${lastError.message}`);
                    continue;
                }
            }

            // If all variations failed, throw the last error
            if (lastError) {
                throw lastError;
            }

            throw new Error('No valid liquidity pools found for this token pair');
        } catch (error) {
            edwinLogger.error('Failed to get quote:', error);

            if (error instanceof Error) {
                if (error.message.includes('revert')) {
                    throw new Error(
                        `Quote failed: No liquidity pool exists for ${params.inputTokenId}->${params.outputTokenId} on mainnet. Tried multiple fee tiers and routing paths.`
                    );
                }
            }

            throw error;
        }
    }

    /**
     * Attempt quote with specific path
     */
    private async attemptQuote(
        provider: ethers.providers.JsonRpcProvider,
        abiInterfaces: ethers.utils.Interface,
        quoterEvmAddress: string,
        encodedPathData: Uint8Array,
        inputAmountInSmallestUnit: number,
        outputTokenId: string
    ): Promise<number> {
        // Encode function call (per docs) - path should be bytes, amount should be uint256
        const data = abiInterfaces.encodeFunctionData('quoteExactInput', [
            encodedPathData,
            inputAmountInSmallestUnit.toString(),
        ]);

        // Send a call to the JSON-RPC provider directly (per docs)
        const result = await provider.call({
            to: quoterEvmAddress,
            data: data,
        });

        // Decode result (per docs)
        const decoded = abiInterfaces.decodeFunctionResult('quoteExactInput', result);
        const finalOutputAmount = decoded.amountOut; // in token's smallest unit

        // Convert back to human readable
        const outputDecimals = await this.wallet.getTokenDecimals(outputTokenId);
        const quotedAmount = Number(finalOutputAmount) / Math.pow(10, outputDecimals);

        edwinLogger.info(`Quote result: ${quotedAmount} ${outputTokenId}`);
        return quotedAmount;
    }

    /**
     * Generate different path variations to try (direct paths with different fees + multi-hop)
     */
    private async generatePathVariations(inputTokenAddress: string, outputTokenAddress: string): Promise<Array<{path: string, description: string}>> {
        const variations: Array<{path: string, description: string}> = [];

        // Direct paths with different fee tiers
        const fees = [
            { fee: SaucerSwapService.DEFAULT_FEE, name: '0.05%' },
            { fee: SaucerSwapService.MEDIUM_FEE, name: '0.30%' },
            { fee: SaucerSwapService.HIGH_FEE, name: '1.00%' }
        ];

        for (const { fee, name } of fees) {
            const directPath = `${inputTokenAddress}${fee}${outputTokenAddress}`;
            variations.push({
                path: directPath,
                description: `Direct path with ${name} fee`
            });
        }

        // Multi-hop through USDC (if not already USDC)
        const usdcToken = ContractId.fromString(SaucerSwapService.USDC_TOKEN_ID);
        const usdcAddress = usdcToken.toEvmAddress();

        if (inputTokenAddress !== usdcAddress && outputTokenAddress !== usdcAddress) {
            // Try input -> USDC -> output with various fee combinations
            for (const { fee: fee1, name: name1 } of fees) {
                for (const { fee: fee2, name: name2 } of fees) {
                    const multiHopPath = `${inputTokenAddress}${fee1}${usdcAddress}${fee2}${outputTokenAddress}`;
                    variations.push({
                        path: multiHopPath,
                        description: `Multi-hop via USDC (${name1} -> ${name2})`
                    });
                }
            }
        }

        return variations;
    }

    /**
     * Get a quote for exact output swap using official SaucerSwap V2 quoter (following docs exactly)
     */
    async getQuoteExactOutput(params: SaucerSwapQuoteExactOutputParameters): Promise<number> {
        edwinLogger.info(
            `Getting SaucerSwap exact output quote for ${params.amountOut} ${params.outputTokenId} from ${params.inputTokenId} on ${params.network}`
        );

        try {
            const config = SaucerSwapService.NETWORK_CONFIG.mainnet;

            // Set up ethers provider (Ethers v5 syntax, docs show v6)
            const provider = new ethers.providers.JsonRpcProvider(config.hederaJsonRpcUrl);

            // Load ABI data containing QuoterV2 functions (per docs)
            const abiInterfaces = new ethers.utils.Interface(SaucerSwapService.QUOTER_ABI);

            // QuoterV2.sol contract (per docs)
            const quoterEvmAddress = `0x${ContractId.fromString(config.quoterContractId).toEvmAddress()}`;

            // Handle HBAR -> WHBAR conversion for path encoding (per docs)
            const inputTokenForPath = params.inputTokenId === 'HBAR' ? config.whbarTokenId : params.inputTokenId;

            // Convert token IDs to solidity addresses (per docs)
            const inputToken = ContractId.fromString(inputTokenForPath);
            const outputToken = ContractId.fromString(params.outputTokenId);

            // Create REVERSED swap path as per docs for exactOutput
            // Path format: [outputToken, fee, inputToken] - REVERSED!
            const pathData: string[] = [];
            pathData.push(outputToken.toEvmAddress()); // Output first for reversed path
            pathData.push(SaucerSwapService.DEFAULT_FEE); // 3 bytes
            pathData.push(inputToken.toEvmAddress()); // Input last for reversed path

            // Use hexToUint8Array as per docs for bytes parameter
            const encodedPathData = this.hexToUint8Array(pathData.join(''));

            // Get proper decimals for calculations
            const outputDecimals = await this.wallet.getTokenDecimals(params.outputTokenId);
            const outputAmountInSmallestUnit = Math.floor(params.amountOut * Math.pow(10, outputDecimals));

            // Encode function call (per docs) - path should be bytes (reversed), amount should be uint256
            const data = abiInterfaces.encodeFunctionData('quoteExactOutput', [
                encodedPathData,
                outputAmountInSmallestUnit.toString(), // Convert to string as per docs
            ]);

            edwinLogger.info(`Calling quoter at ${quoterEvmAddress} with encoded data for exact output`);

            // Send a call to the JSON-RPC provider directly (per docs)
            const result = await provider.call({
                to: quoterEvmAddress,
                data: data,
            });

            // Decode result (per docs)
            const decoded = abiInterfaces.decodeFunctionResult('quoteExactOutput', result);
            const finalInputAmount = decoded.amountIn; // in token's smallest unit

            // Convert back to human readable
            const inputDecimals =
                params.inputTokenId === 'HBAR'
                    ? SaucerSwapService.HBAR_DECIMALS
                    : await this.wallet.getTokenDecimals(params.inputTokenId);
            const quotedAmount = Number(finalInputAmount) / Math.pow(10, inputDecimals);

            edwinLogger.info(`Exact output quote result: ${quotedAmount} ${params.inputTokenId} needed for ${params.amountOut} ${params.outputTokenId}`);
            return quotedAmount;
        } catch (error) {
            edwinLogger.error('Failed to get exact output quote:', error);

            if (error instanceof Error) {
                if (error.message.includes('revert')) {
                    throw new Error(
                        `Quote failed: No liquidity pool exists for ${params.inputTokenId}->${params.outputTokenId} on mainnet`
                    );
                }
            }

            throw error;
        }
    }

    /**
     * Swap exact input tokens for output tokens (following official docs exactly)
     */
    async swapExactInput(params: SaucerSwapExactInputParameters): Promise<string> {
        edwinLogger.info(
            `Swapping ${params.amountIn} ${params.inputTokenId} for ${params.outputTokenId} on ${params.network}`
        );

        if (params.amountIn <= 0) {
            throw new Error('Swap amount must be greater than zero');
        }

        try {
            const config = SaucerSwapService.NETWORK_CONFIG.mainnet;

            const deadline = params.deadline || Math.floor(Date.now() / 1000) + 1200;
            const recipientAddress = '0x' + AccountId.fromString(this.wallet.getAddress()).toEvmAddress();

            // Handle different swap scenarios per official docs
            if (params.inputTokenId === config.hbarTokenId) {
                // HBAR -> Token: Use multicall with exactInput + refundETH
                return await this.swapHBARForTokens(params, config, deadline, recipientAddress);
            } else if (params.outputTokenId === config.hbarTokenId) {
                // Token -> HBAR: Use multicall with exactInput + unwrapWHBAR
                return await this.swapTokensForHBAR(params, config, deadline, recipientAddress);
            } else {
                // Token -> Token: Use direct exactInput (no multicall per docs)
                return await this.swapTokensForTokens(params, config, deadline, recipientAddress);
            }
        } catch (error) {
            edwinLogger.error('Failed to swap exact input:', error);
            const errorStr = error instanceof Error ? error.message : String(error);
            if (errorStr.includes('CONTRACT_REVERT_EXECUTED')) {
                throw new Error(`Swap contract execution failed: ${errorStr}. This could be due to insufficient liquidity, slippage tolerance, or token approval issues.`);
            }
            throw error;
        }
    }

    /**
     * Swap input tokens for exact output tokens (following official docs exactly)
     */
    async swapExactOutput(params: SaucerSwapExactOutputParameters): Promise<string> {
        edwinLogger.info(
            `Swapping ${params.inputTokenId} for exactly ${params.amountOut} ${params.outputTokenId} on ${params.network}`
        );

        if (params.amountOut <= 0) {
            throw new Error('Output amount must be greater than zero');
        }

        try {
            const config = SaucerSwapService.NETWORK_CONFIG.mainnet;

            const deadline = params.deadline || Math.floor(Date.now() / 1000) + 1200;
            const recipientAddress = '0x' + AccountId.fromString(this.wallet.getAddress()).toEvmAddress();

            // Handle different swap scenarios per official docs
            if (params.inputTokenId === config.hbarTokenId) {
                // HBAR -> Token: Use multicall with exactOutput + refundETH
                return await this.swapHBARForTokensExactOutput(params, config, deadline, recipientAddress);
            } else if (params.outputTokenId === config.hbarTokenId) {
                // Token -> HBAR: Use multicall with exactOutput + unwrapWHBAR
                return await this.swapTokensForHBARExactOutput(params, config, deadline, recipientAddress);
            } else {
                // Token -> Token: Use direct exactOutput (no multicall per docs)
                return await this.swapTokensForTokensExactOutput(params, config, deadline, recipientAddress);
            }
        } catch (error) {
            edwinLogger.error('Failed to swap exact output:', error);
            const errorStr = error instanceof Error ? error.message : String(error);
            if (errorStr.includes('CONTRACT_REVERT_EXECUTED')) {
                throw new Error(`Swap contract execution failed: ${errorStr}. This could be due to insufficient liquidity, slippage tolerance, or token approval issues.`);
            }
            throw error;
        }
    }

    /**
     * Convert hex string to Uint8Array for contract calls (per official docs)
     */
    private hexToUint8Array(hex: string): Uint8Array {
        if (hex.startsWith('0x')) {
            hex = hex.slice(2);
        }
        const bytes = [];
        for (let i = 0; i < hex.length; i += 2) {
            bytes.push(parseInt(hex.substr(i, 2), 16));
        }
        return new Uint8Array(bytes);
    }

    /**
     * HBAR -> Token swap using multicall (per official docs)
     */
    private async swapHBARForTokens(
        params: SaucerSwapExactInputParameters,
        config: NetworkConfig,
        deadline: number,
        recipientAddress: string
    ): Promise<string> {
        // Critical: Ensure token association for output token (required per docs)
        await this.associateToken(params.outputTokenId);

        // Load ABI data containing SwapRouter, PeripheryPayments and Multicall functions (per docs)
        const abiInterfaces = new ethers.utils.Interface(SaucerSwapService.SWAP_ROUTER_ABI);

        // Create path with WHBAR for HBAR swaps (per docs)
        const inputToken = ContractId.fromString(config.whbarTokenId);
        const outputToken = ContractId.fromString(params.outputTokenId);

        const pathData: string[] = [];
        pathData.push(inputToken.toEvmAddress());
        pathData.push(SaucerSwapService.DEFAULT_FEE);
        pathData.push(outputToken.toEvmAddress());
        const routeDataWithFee = '0x' + pathData.join('');

        // Convert amounts
        const inputTinybar = Math.floor(params.amountIn * Math.pow(10, SaucerSwapService.HBAR_DECIMALS));
        const outputDecimals = await this.wallet.getTokenDecimals(params.outputTokenId);
        const outputAmountMin = Math.floor(params.amountOutMinimum * Math.pow(10, outputDecimals));

        // ExactInputParams (per docs)
        const exactInputParams = {
            path: routeDataWithFee,
            recipient: recipientAddress,
            deadline: deadline,
            amountIn: inputTinybar,
            amountOutMinimum: outputAmountMin,
        };

        // Encode each function individually (per docs)
        const swapEncoded = abiInterfaces.encodeFunctionData('exactInput', [exactInputParams]);
        const refundHBAREncoded = abiInterfaces.encodeFunctionData('refundETH');

        // Multi-call parameter: bytes[] (per docs)
        const multiCallParam = [swapEncoded, refundHBAREncoded];

        // Get encoded data for the multicall involving both functions (per docs)
        const encodedData = abiInterfaces.encodeFunctionData('multicall', [multiCallParam]);

        // Get encoded data as Uint8Array (per docs)
        const encodedDataAsUint8Array = this.hexToUint8Array(encodedData);

        // Execute transaction (per docs)
        const swapRouterContractId = ContractId.fromString(config.swapRouterContractId);
        const transaction = new ContractExecuteTransaction()
            .setPayableAmount(Hbar.from(inputTinybar, HbarUnit.Tinybar))
            .setContractId(swapRouterContractId)
            .setGas(SaucerSwapService.GAS_LIMIT)
            .setFunctionParameters(encodedDataAsUint8Array);

        return await this.wallet.sendTransaction(transaction);
    }

    // Placeholder methods for other swap types
    private async swapTokensForHBAR(params: SaucerSwapExactInputParameters, config: NetworkConfig, deadline: number, recipientAddress: string): Promise<string> {
        throw new Error('Token -> HBAR swap not implemented yet');
    }

    private async swapTokensForTokens(params: SaucerSwapExactInputParameters, config: NetworkConfig, deadline: number, recipientAddress: string): Promise<string> {
        throw new Error('Token -> Token swap not implemented yet');
    }

    private async swapHBARForTokensExactOutput(params: SaucerSwapExactOutputParameters, config: NetworkConfig, deadline: number, recipientAddress: string): Promise<string> {
        throw new Error('HBAR -> Token exact output swap not implemented yet');
    }

    private async swapTokensForHBARExactOutput(params: SaucerSwapExactOutputParameters, config: NetworkConfig, deadline: number, recipientAddress: string): Promise<string> {
        throw new Error('Token -> HBAR exact output swap not implemented yet');
    }

    private async swapTokensForTokensExactOutput(params: SaucerSwapExactOutputParameters, config: NetworkConfig, deadline: number, recipientAddress: string): Promise<string> {
        throw new Error('Token -> Token exact output swap not implemented yet');
    }

    /**
     * Associate token with account (required per official docs)
     */
    private async associateToken(tokenId: string): Promise<void> {
        try {
            edwinLogger.info(`Associating token ${tokenId} with account ${this.wallet.getAddress()}`);

            // Check if already associated (per docs)
            const balance = await this.wallet.getTokenBalance?.(tokenId);
            if (balance !== undefined && balance >= 0) {
                edwinLogger.info(`Token ${tokenId} already associated with account`);
                return;
            }
        } catch (error) {
            const errorStr = error instanceof Error ? error.message : String(error);
            edwinLogger.info(`Token association needed: ${errorStr}`);
        }

        // Associate the token (per docs)
        const tokenAssociation = new TokenAssociateTransaction()
            .setAccountId(this.wallet.getAddress())
            .setTokenIds([TokenId.fromString(tokenId)]);

        await this.wallet.sendTransaction(tokenAssociation);
        edwinLogger.info(`Token ${tokenId} successfully associated`);
    }

    /**
     * Approve token allowance (required per official docs)
     */
    private async approveTokenAllowance(tokenId: string, amount: number, spenderId: string): Promise<void> {
        try {
            edwinLogger.info(`Approving ${amount} of token ${tokenId} for spender ${spenderId}`);

            const tokenDecimals = await this.wallet.getTokenDecimals(tokenId);
            const amountInSmallestUnit = Math.floor(amount * Math.pow(10, tokenDecimals));

            // Approve allowance (per docs)
            const allowanceApproval = new AccountAllowanceApproveTransaction()
                .approveTokenAllowance(TokenId.fromString(tokenId), this.wallet.getAddress(), spenderId, amountInSmallestUnit);

            await this.wallet.sendTransaction(allowanceApproval);
            edwinLogger.info(`Token allowance approved successfully`);
        } catch (error) {
            edwinLogger.error(`Token allowance approval failed: ${error}`);
            throw new Error(`Token approval failed: ${error}`);
        }
    }
}
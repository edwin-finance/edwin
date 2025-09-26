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
     * Get a quote for swapping tokens using official SaucerSwap V2 quoter (following docs exactly)
     */
    async getQuote(params: SaucerSwapQuoteParameters): Promise<number> {
        edwinLogger.info(
            `Getting SaucerSwap quote for ${params.amount} ${params.inputTokenId} -> ${params.outputTokenId} on ${params.network}`
        );

        try {
            const config = SaucerSwapService.NETWORK_CONFIG.mainnet;

            // Set up ethers provider (Ethers v5 syntax, docs show v6)
            const provider = new ethers.providers.JsonRpcProvider(config.hederaJsonRpcUrl);

            // Load ABI data containing QuoterV2 functions (per docs)
            const abiInterfaces = new ethers.utils.Interface(SaucerSwapService.QUOTER_ABI);

            // QuoterV2.sol contract (per docs) - use toSolidityAddress() in docs but toEvmAddress() works in SDK
            const quoterEvmAddress = `0x${ContractId.fromString(config.quoterContractId).toEvmAddress()}`;

            // Handle HBAR -> WHBAR conversion for path encoding (per docs)
            const inputTokenForPath = params.inputTokenId === 'HBAR' ? config.whbarTokenId : params.inputTokenId;

            // Convert token IDs to solidity addresses (per docs)
            const inputToken = ContractId.fromString(inputTokenForPath);
            const outputToken = ContractId.fromString(params.outputTokenId);

            // Create swap path as per docs - path format: [token, fee, token, fee, token, ...]
            // Each token is 20 bytes, each fee is 3 bytes
            const pathData: string[] = [];
            pathData.push(inputToken.toEvmAddress()); // 20 bytes
            pathData.push(SaucerSwapService.DEFAULT_FEE); // 3 bytes
            pathData.push(outputToken.toEvmAddress()); // 20 bytes

            // Use hexToUint8Array as per docs for bytes parameter
            const encodedPathData = this.hexToUint8Array(pathData.join(''));

            // Get proper decimals for calculations
            const inputDecimals =
                params.inputTokenId === 'HBAR'
                    ? SaucerSwapService.HBAR_DECIMALS
                    : await this.wallet.getTokenDecimals(params.inputTokenId);

            const inputAmountInSmallestUnit = Math.floor(params.amount * Math.pow(10, inputDecimals));

            // Encode function call (per docs) - path should be bytes, amount should be uint256
            const data = abiInterfaces.encodeFunctionData('quoteExactInput', [
                encodedPathData,
                inputAmountInSmallestUnit.toString(), // Convert to string as per docs
            ]);

            edwinLogger.info(`Calling quoter at ${quoterEvmAddress} with encoded data`);

            // Send a call to the JSON-RPC provider directly (per docs)
            const result = await provider.call({
                to: quoterEvmAddress,
                data: data,
            });

            // Decode result (per docs)
            const decoded = abiInterfaces.decodeFunctionResult('quoteExactInput', result);
            const finalOutputAmount = decoded.amountOut; // in token's smallest unit

            // Convert back to human readable
            const outputDecimals = await this.wallet.getTokenDecimals(params.outputTokenId);
            const quotedAmount = Number(finalOutputAmount) / Math.pow(10, outputDecimals);

            edwinLogger.info(`Quote result: ${quotedAmount} ${params.outputTokenId}`);
            return quotedAmount;
        } catch (error) {
            edwinLogger.error('Failed to get quote:', error);

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

            // Check balance (temporarily disabled due to network issues)
            // let balance: number;
            // if (params.inputTokenId === config.hbarTokenId) {
            //     balance = await this.wallet.getBalance();
            // } else {
            //     if (!this.wallet.getTokenBalance) {
            //         throw new Error('Token balance not supported by this wallet client');
            //     }
            //     balance = await this.wallet.getTokenBalance(params.inputTokenId);
            // }

            // if (balance < params.amountIn) {
            //     throw new Error(`Insufficient balance: ${balance} < ${params.amountIn}`);
            // }

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

    /**
     * Token -> Token swap using direct exactInput (per official docs)
     */
    private async swapTokensForTokens(
        params: SaucerSwapExactInputParameters,
        config: NetworkConfig,
        deadline: number,
        recipientAddress: string
    ): Promise<string> {
        // Critical: Ensure token association for output token (required per docs)
        await this.associateToken(params.outputTokenId);

        // Critical: Approve router to spend input tokens (required per docs)
        const swapRouterContractId = ContractId.fromString(config.swapRouterContractId);
        const inputDecimals = await this.wallet.getTokenDecimals(params.inputTokenId);
        const inputAmount = Math.floor(params.amountIn * Math.pow(10, inputDecimals));

        const swapRouterAccountId = AccountId.fromString(config.swapRouterContractId);
        await this.approveTokenAllowance(params.inputTokenId, swapRouterAccountId.toString(), inputAmount);

        // Load ABI data containing SwapRouter functions (per docs)
        const abiInterfaces = new ethers.utils.Interface(SaucerSwapService.SWAP_ROUTER_ABI);

        // Create path
        const inputToken = ContractId.fromString(params.inputTokenId);
        const outputToken = ContractId.fromString(params.outputTokenId);

        const pathData: string[] = [];
        pathData.push(inputToken.toEvmAddress());
        pathData.push(SaucerSwapService.DEFAULT_FEE);
        pathData.push(outputToken.toEvmAddress());
        const routeDataWithFee = '0x' + pathData.join('');

        // Convert amounts
        const outputDecimals = await this.wallet.getTokenDecimals(params.outputTokenId);
        const outputAmountMin = Math.floor(params.amountOutMinimum * Math.pow(10, outputDecimals));

        // ExactInputParams (per docs)
        const exactInputParams = {
            path: routeDataWithFee,
            recipient: recipientAddress,
            deadline: deadline,
            amountIn: inputAmount,
            amountOutMinimum: outputAmountMin,
        };

        // Get encoded hexadecimal string data (per docs)
        const encodedData = abiInterfaces.encodeFunctionData('exactInput', [exactInputParams]);

        // Debug logging
        edwinLogger.info(`Token swap params:`, {
            path: routeDataWithFee,
            inputAmount,
            outputAmountMin,
            recipient: recipientAddress,
            deadline,
            swapRouter: config.swapRouterContractId,
            inputToken: params.inputTokenId,
            outputToken: params.outputTokenId
        });

        // Get encoded data as Uint8Array (per docs)
        const encodedDataAsUint8Array = this.hexToUint8Array(encodedData);

        // Execute transaction (per docs)
        const transaction = new ContractExecuteTransaction()
            .setContractId(swapRouterContractId)
            .setGas(SaucerSwapService.GAS_LIMIT)
            .setFunctionParameters(encodedDataAsUint8Array);

        return await this.wallet.sendTransaction(transaction);
    }

    /**
     * Token -> HBAR swap using multicall with unwrapWHBAR (per official docs)
     */
    private async swapTokensForHBAR(
        params: SaucerSwapExactInputParameters,
        config: NetworkConfig,
        deadline: number,
        recipientAddress: string
    ): Promise<string> {
        // Critical: Approve router to spend input tokens (required per docs)
        const swapRouterContractId = ContractId.fromString(config.swapRouterContractId);
        const inputDecimals = await this.wallet.getTokenDecimals(params.inputTokenId);
        const inputAmount = Math.floor(params.amountIn * Math.pow(10, inputDecimals));

        const swapRouterAccountId = AccountId.fromString(config.swapRouterContractId);
        await this.approveTokenAllowance(params.inputTokenId, swapRouterAccountId.toString(), inputAmount);

        // Load ABI data containing SwapRouter, PeripheryPayments and Multicall functions (per docs)
        const abiInterfaces = new ethers.utils.Interface(SaucerSwapService.SWAP_ROUTER_ABI);

        // Create path with WHBAR for HBAR output (per docs)
        const inputToken = ContractId.fromString(params.inputTokenId);
        const outputToken = ContractId.fromString(config.whbarTokenId); // Use WHBAR for HBAR

        const pathData: string[] = [];
        pathData.push(inputToken.toEvmAddress());
        pathData.push(SaucerSwapService.DEFAULT_FEE);
        pathData.push(outputToken.toEvmAddress());
        const routeDataWithFee = '0x' + pathData.join('');

        // Convert amounts
        const outputTinybarMin = Math.floor(params.amountOutMinimum * Math.pow(10, SaucerSwapService.HBAR_DECIMALS));

        // Use SwapRouter contract address as recipient for unwrapWHBAR to work (per docs)
        const swapRouterAddress = `0x${ContractId.fromString(config.swapRouterContractId).toEvmAddress()}`;

        // ExactInputParams (per docs)
        const exactInputParams = {
            path: routeDataWithFee,
            recipient: swapRouterAddress, // Use SwapRouter address for unwrapWHBAR
            deadline: deadline,
            amountIn: inputAmount,
            amountOutMinimum: outputTinybarMin,
        };

        // Encode each function individually (per docs)
        const swapEncoded = abiInterfaces.encodeFunctionData('exactInput', [exactInputParams]);
        // Provide the user's address to receive the unwrapped HBAR (per docs)
        const unwrapEncoded = abiInterfaces.encodeFunctionData('unwrapWHBAR', [0, recipientAddress]);

        // Multi-call parameter: bytes[] (per docs)
        const multiCallParam = [swapEncoded, unwrapEncoded];

        // Get encoded data for the multicall involving both functions (per docs)
        const encodedData = abiInterfaces.encodeFunctionData('multicall', [multiCallParam]);

        // Get encoded data as Uint8Array (per docs)
        const encodedDataAsUint8Array = this.hexToUint8Array(encodedData);

        // Execute transaction (per docs)
        const transaction = new ContractExecuteTransaction()
            .setContractId(swapRouterContractId)
            .setGas(SaucerSwapService.GAS_LIMIT)
            .setFunctionParameters(encodedDataAsUint8Array);

        return await this.wallet.sendTransaction(transaction);
    }

    /**
     * Swap input tokens for exact output tokens (following official docs exactly)
     */
    async swapExactOutput(params: SaucerSwapExactOutputParameters): Promise<string> {
        edwinLogger.info(
            `Swapping for exact ${params.amountOut} ${params.outputTokenId} from ${params.inputTokenId} on ${params.network}`
        );

        try {
            const config = SaucerSwapService.NETWORK_CONFIG.mainnet;

            // Similar implementation to exactInput but with reversed path and exactOutput function
            // Following same patterns as exactInput but with appropriate reversals per docs

            // Check balance (temporarily disabled due to network issues)
            // let balance: number;
            // if (params.inputTokenId === config.hbarTokenId) {
            //     balance = await this.wallet.getBalance();
            // } else {
            //     if (!this.wallet.getTokenBalance) {
            //         throw new Error('Token balance not supported by this wallet client');
            //     }
            //     balance = await this.wallet.getTokenBalance(params.inputTokenId);
            // }

            // if (balance < params.amountInMaximum) {
            //     throw new Error(`Insufficient balance: ${balance} < ${params.amountInMaximum}`);
            // }

            const deadline = params.deadline || Math.floor(Date.now() / 1000) + 1200;
            const recipientAddress = '0x' + AccountId.fromString(this.wallet.getAddress()).toEvmAddress();

            // For exactOutput, paths need to be reversed per docs
            if (params.inputTokenId === config.hbarTokenId) {
                return await this.swapExactOutputHBARForTokens(params, config, deadline, recipientAddress);
            } else if (params.outputTokenId === config.hbarTokenId) {
                return await this.swapExactOutputTokensForHBAR(params, config, deadline, recipientAddress);
            } else {
                return await this.swapExactOutputTokensForTokens(params, config, deadline, recipientAddress);
            }
        } catch (error) {
            edwinLogger.error('Failed to swap exact output:', error);
            throw error;
        }
    }

    /**
     * ExactOutput: HBAR -> Token with reversed path (per docs)
     */
    private async swapExactOutputHBARForTokens(
        params: SaucerSwapExactOutputParameters,
        config: NetworkConfig,
        deadline: number,
        recipientAddress: string
    ): Promise<string> {
        const abiInterfaces = new ethers.utils.Interface(SaucerSwapService.SWAP_ROUTER_ABI);

        // Reversed path for exactOutput (per docs)
        const inputToken = ContractId.fromString(config.whbarTokenId);
        const outputToken = ContractId.fromString(params.outputTokenId);

        const pathData: string[] = [];
        pathData.push(outputToken.toEvmAddress()); // Output first for reversed path
        pathData.push(SaucerSwapService.DEFAULT_FEE);
        pathData.push(inputToken.toEvmAddress());
        const routeDataWithFee = '0x' + pathData.join('');

        // Convert amounts
        const inputTinybarMax = Math.floor(params.amountInMaximum * Math.pow(10, SaucerSwapService.HBAR_DECIMALS));
        const outputDecimals = await this.wallet.getTokenDecimals(params.outputTokenId);
        const outputAmount = Math.floor(params.amountOut * Math.pow(10, outputDecimals));

        const exactOutputParams = {
            path: routeDataWithFee,
            recipient: recipientAddress,
            deadline: deadline,
            amountOut: outputAmount,
            amountInMaximum: inputTinybarMax,
        };

        const swapEncoded = abiInterfaces.encodeFunctionData('exactOutput', [exactOutputParams]);
        const refundHBAREncoded = abiInterfaces.encodeFunctionData('refundETH');

        const multiCallParam = [swapEncoded, refundHBAREncoded];
        const encodedData = abiInterfaces.encodeFunctionData('multicall', [multiCallParam]);
        const encodedDataAsUint8Array = this.hexToUint8Array(encodedData);

        const swapRouterContractId = ContractId.fromString(config.swapRouterContractId);
        const transaction = new ContractExecuteTransaction()
            .setPayableAmount(Hbar.from(inputTinybarMax, HbarUnit.Tinybar))
            .setContractId(swapRouterContractId)
            .setGas(SaucerSwapService.GAS_LIMIT)
            .setFunctionParameters(encodedDataAsUint8Array);

        return await this.wallet.sendTransaction(transaction);
    }

    /**
     * ExactOutput: Token -> Token with reversed path (per docs)
     */
    private async swapExactOutputTokensForTokens(
        params: SaucerSwapExactOutputParameters,
        config: NetworkConfig,
        deadline: number,
        recipientAddress: string
    ): Promise<string> {
        const abiInterfaces = new ethers.utils.Interface(SaucerSwapService.SWAP_ROUTER_ABI);

        // Reversed path for exactOutput (per docs)
        const inputToken = ContractId.fromString(params.inputTokenId);
        const outputToken = ContractId.fromString(params.outputTokenId);

        const pathData: string[] = [];
        pathData.push(outputToken.toEvmAddress()); // Output first for reversed path
        pathData.push(SaucerSwapService.DEFAULT_FEE);
        pathData.push(inputToken.toEvmAddress());
        const routeDataWithFee = '0x' + pathData.join('');

        const inputDecimals = await this.wallet.getTokenDecimals(params.inputTokenId);
        const outputDecimals = await this.wallet.getTokenDecimals(params.outputTokenId);
        const inputAmountMax = Math.floor(params.amountInMaximum * Math.pow(10, inputDecimals));
        const outputAmount = Math.floor(params.amountOut * Math.pow(10, outputDecimals));

        const exactOutputParams = {
            path: routeDataWithFee,
            recipient: recipientAddress,
            deadline: deadline,
            amountOut: outputAmount,
            amountInMaximum: inputAmountMax,
        };

        const encodedData = abiInterfaces.encodeFunctionData('exactOutput', [exactOutputParams]);
        const encodedDataAsUint8Array = this.hexToUint8Array(encodedData);

        const swapRouterContractId = ContractId.fromString(config.swapRouterContractId);
        const transaction = new ContractExecuteTransaction()
            .setContractId(swapRouterContractId)
            .setGas(SaucerSwapService.GAS_LIMIT)
            .setFunctionParameters(encodedDataAsUint8Array);

        return await this.wallet.sendTransaction(transaction);
    }

    /**
     * ExactOutput: Token -> HBAR with reversed path and unwrapWHBAR (per docs)
     */
    private async swapExactOutputTokensForHBAR(
        params: SaucerSwapExactOutputParameters,
        config: NetworkConfig,
        deadline: number,
        recipientAddress: string
    ): Promise<string> {
        const abiInterfaces = new ethers.utils.Interface(SaucerSwapService.SWAP_ROUTER_ABI);

        // Reversed path for exactOutput with WHBAR (per docs)
        const inputToken = ContractId.fromString(params.inputTokenId);
        const outputToken = ContractId.fromString(config.whbarTokenId);

        const pathData: string[] = [];
        pathData.push(outputToken.toEvmAddress()); // WHBAR first for reversed path
        pathData.push(SaucerSwapService.DEFAULT_FEE);
        pathData.push(inputToken.toEvmAddress());
        const routeDataWithFee = '0x' + pathData.join('');

        const inputDecimals = await this.wallet.getTokenDecimals(params.inputTokenId);
        const inputAmountMax = Math.floor(params.amountInMaximum * Math.pow(10, inputDecimals));
        const outputTinybar = Math.floor(params.amountOut * Math.pow(10, SaucerSwapService.HBAR_DECIMALS));

        const swapRouterAddress = `0x${ContractId.fromString(config.swapRouterContractId).toEvmAddress()}`;

        const exactOutputParams = {
            path: routeDataWithFee,
            recipient: swapRouterAddress, // Use SwapRouter address for unwrapWHBAR
            deadline: deadline,
            amountOut: outputTinybar,
            amountInMaximum: inputAmountMax,
        };

        const swapEncoded = abiInterfaces.encodeFunctionData('exactOutput', [exactOutputParams]);
        const unwrapEncoded = abiInterfaces.encodeFunctionData('unwrapWHBAR', [0, recipientAddress]);

        const multiCallParam = [swapEncoded, unwrapEncoded];
        const encodedData = abiInterfaces.encodeFunctionData('multicall', [multiCallParam]);
        const encodedDataAsUint8Array = this.hexToUint8Array(encodedData);

        const swapRouterContractId = ContractId.fromString(config.swapRouterContractId);
        const transaction = new ContractExecuteTransaction()
            .setContractId(swapRouterContractId)
            .setGas(SaucerSwapService.GAS_LIMIT)
            .setFunctionParameters(encodedDataAsUint8Array);

        return await this.wallet.sendTransaction(transaction);
    }

    /**
     * Convert hex string to Uint8Array for contract function parameters (per docs)
     */
    private hexToUint8Array(hex: string): Uint8Array {
        const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
        const paddedHex = cleanHex.length % 2 === 0 ? cleanHex : '0' + cleanHex;

        const uint8Array = new Uint8Array(paddedHex.length / 2);
        for (let i = 0; i < paddedHex.length; i += 2) {
            uint8Array[i / 2] = parseInt(paddedHex.substring(i, i + 2), 16);
        }
        return uint8Array;
    }


    /**
     * Associate a token with the current account (required per SaucerSwap docs)
     */
    private async associateToken(tokenId: string): Promise<void> {
        try {
            const transaction = new TokenAssociateTransaction()
                .setAccountId(this.wallet.accountId)
                .setTokenIds([TokenId.fromString(tokenId)]);

            await this.wallet.sendTransaction(transaction);
            edwinLogger.info(`Associated token ${tokenId} with account ${this.wallet.getAddress()}`);
        } catch (error) {
            const errorStr = error instanceof Error ? error.message : String(error);
            if (errorStr.includes('TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT')) {
                edwinLogger.info(`Token ${tokenId} already associated with account`);
            } else {
                edwinLogger.warn(`Token association failed: ${errorStr}`);
                // Don't throw - token may already be associated
            }
        }
    }

    /**
     * Approve token allowance for the swap router (required per SaucerSwap docs)
     */
    private async approveTokenAllowance(tokenId: string, spenderId: string, amount: number): Promise<void> {
        try {
            const transaction = new AccountAllowanceApproveTransaction()
                .approveTokenAllowance(TokenId.fromString(tokenId), this.wallet.accountId, AccountId.fromString(spenderId), amount);

            await this.wallet.sendTransaction(transaction);
            edwinLogger.info(`Approved ${amount} of token ${tokenId} for spender ${spenderId}`);
        } catch (error) {
            edwinLogger.error(`Token allowance approval failed: ${error}`);
            throw new Error(`Token approval failed: ${error}`);
        }
    }
}

import { EdwinService } from '../../core/classes/edwinToolProvider';
import { HederaWalletClient, KeypairClient } from '../../core/wallets/hedera_wallet';
import edwinLogger from '../../utils/logger';
import { ContractExecuteTransaction, ContractId, AccountId, Hbar, ContractFunctionParameters, ContractCallQuery } from '@hashgraph/sdk';
import {
    SaucerSwapQuoteParameters,
    SaucerSwapExactInputParameters,
    SaucerSwapExactOutputParameters,
} from './parameters';

export class SaucerSwapService extends EdwinService {
    private static readonly NETWORK_CONFIG = {
        mainnet: {
            swapRouterContractId: '0.0.3949434', // SaucerSwapV2SwapRouter
            quoterContractId: '0.0.3949424', // SaucerSwapV2QuoterV2
            hbarTokenId: 'HBAR', // Native HBAR
        },
        testnet: {
            swapRouterContractId: '0.0.1414040', // SaucerSwapV2SwapRouter testnet
            quoterContractId: '0.0.1390002', // SaucerSwapV2QuoterV2 testnet
            hbarTokenId: 'HBAR', // Native HBAR
        },
    };

    private static readonly DEFAULT_FEE = '0x0001F4'; // 0.05% fee
    private static readonly GAS_LIMIT = 3000000;

    constructor(private wallet: HederaWalletClient) {
        super();
    }

    /**
     * Get a quote for swapping tokens using the real SaucerSwap V2 quoter contract
     */
    async getQuote(params: SaucerSwapQuoteParameters): Promise<number> {
        edwinLogger.info(
            `Getting real quote for ${params.amount} ${params.inputTokenId} -> ${params.outputTokenId} on ${params.network}`
        );

        try {
            // Validate network
            const config = SaucerSwapService.NETWORK_CONFIG[params.network];
            if (!config) {
                throw new Error(`Unsupported network: ${params.network}`);
            }

            // Convert token IDs to addresses for SaucerSwap V2
            const inputTokenAddress = params.inputTokenId === 'HBAR'
                ? '0x0000000000000000000000000000000000000000' // Native HBAR address
                : this.tokenIdToAddress(params.inputTokenId);
            const outputTokenAddress = this.tokenIdToAddress(params.outputTokenId);

            // Encode the path for the quoter
            const path = this.encodeSwapPath(inputTokenAddress, outputTokenAddress, SaucerSwapService.DEFAULT_FEE);

            // Convert amount to smallest units (assuming 8 decimals for most tokens)
            const amountIn = Math.floor(params.amount * Math.pow(10, 8));

            edwinLogger.info(`Calling quoter contract ${config.quoterContractId} with path length ${path.length}`);

            // Create contract call query for quoter
            const quoterContractId = ContractId.fromString(config.quoterContractId);
            const functionParameters = new ContractFunctionParameters()
                .addBytes(path)
                .addUint256(amountIn);

            // Create contract call query for quoter with proper client setup
            const contractCallQuery = new ContractCallQuery()
                .setContractId(quoterContractId)
                .setFunction('quoteExactInput', functionParameters)
                .setGas(1000000);

            // Execute the query with the wallet's client
            const client = this.wallet.getClient();

            // For quoter calls, we need a client with operator configured
            if (!client.operatorAccountId && this.wallet instanceof KeypairClient) {
                client.setOperator(this.wallet.accountId, this.wallet.getPrivateKey());
            }

            if (!client.operatorAccountId) {
                throw new Error(
                    'Quoter calls require a wallet with signing capabilities (KeypairClient). ' +
                    'PublicKeyClient cannot perform contract queries that require payment.'
                );
            }

            const contractCallResult = await contractCallQuery.execute(client);

            // Parse the result - the quoter returns the expected output amount
            const amountOut = contractCallResult.getUint256(0);
            const quotedAmount = Number(amountOut) / Math.pow(10, 8);

            edwinLogger.info(`Real quote result: ${quotedAmount} ${params.outputTokenId}`);
            return quotedAmount;

        } catch (error) {
            edwinLogger.error('Failed to get real quote:', error);

            // Provide specific error messages but no fallbacks - fail properly
            if (error instanceof Error) {
                if (error.message.includes('CONTRACT_REVERT_EXECUTED')) {
                    throw new Error(
                        `Quote failed: No liquidity pool exists for ${params.inputTokenId}->${params.outputTokenId} on ${params.network}`
                    );
                } else if (error.message.includes('INVALID_CONTRACT_ID')) {
                    throw new Error(
                        `Quote failed: Quoter contract ${SaucerSwapService.NETWORK_CONFIG[params.network]?.quoterContractId} not found on ${params.network}`
                    );
                } else if (error.message.includes('client` must have an `operator')) {
                    throw new Error(
                        'Quote failed: Hedera client operator must be configured for contract queries. ' +
                        'Real quotes require a wallet with signing capabilities.'
                    );
                }
            }

            throw error;
        }
    }

    /**
     * Swap exact input tokens for output tokens
     */
    async swapExactInput(params: SaucerSwapExactInputParameters): Promise<string> {
        edwinLogger.info(
            `Swapping ${params.amountIn} ${params.inputTokenId} for ${params.outputTokenId} on ${params.network}`
        );

        try {
            const config = SaucerSwapService.NETWORK_CONFIG[params.network || 'testnet'];

            // Check input token balance
            let balance: number;
            if (params.inputTokenId === config.hbarTokenId) {
                balance = await this.wallet.getBalance();
            } else {
                balance = await this.wallet.getTokenBalance!(params.inputTokenId);
            }

            if (balance < params.amountIn) {
                throw new Error(`Insufficient balance: ${balance} < ${params.amountIn}`);
            }

            // Calculate deadline (default to 20 minutes from now)
            const deadline = params.deadline || Math.floor(Date.now() / 1000) + 1200;

            // Create path for swap (simplified - in production would need proper encoding)
            this.createSwapPath(params.inputTokenId, params.outputTokenId);

            // Create contract execute transaction
            const swapRouterContractId = ContractId.fromString(config.swapRouterContractId);
            const recipient = AccountId.fromString(this.wallet.getAddress());

            // Convert token IDs to addresses for SaucerSwap V2
            const inputTokenAddress = params.inputTokenId === 'HBAR'
                ? '0x0000000000000000000000000000000000000000' // Native HBAR address
                : this.tokenIdToAddress(params.inputTokenId);
            const outputTokenAddress = this.tokenIdToAddress(params.outputTokenId);

            // Create function parameters for exactInputSingle
            const functionParameters = new ContractFunctionParameters()
                .addAddress(inputTokenAddress)           // tokenIn
                .addAddress(outputTokenAddress)          // tokenOut
                .addUint24(parseInt(SaucerSwapService.DEFAULT_FEE, 16)) // fee as uint24
                .addAddress(recipient.toSolidityAddress()) // recipient
                .addUint256(deadline)                    // deadline
                .addUint256(Math.floor(params.amountIn * Math.pow(10, 8))) // amountIn
                .addUint256(Math.floor(params.amountOutMinimum * Math.pow(10, 8))) // amountOutMinimum
                .addUint160(0); // sqrtPriceLimitX96 as uint160

            const transaction = new ContractExecuteTransaction()
                .setContractId(swapRouterContractId)
                .setFunction('exactInputSingle', functionParameters)
                .setGas(SaucerSwapService.GAS_LIMIT);

            // If input is HBAR, set payable amount
            if (params.inputTokenId === config.hbarTokenId) {
                transaction.setPayableAmount(Hbar.fromTinybars(Math.floor(params.amountIn * 100000000)));
            }

            // Use the wallet's sendTransaction method instead of manual freezing
            const transactionId = await this.wallet.sendTransaction(transaction);

            edwinLogger.info(
                `Successfully swapped ${params.amountIn} ${params.inputTokenId}. Transaction ID: ${transactionId}`
            );
            return transactionId;
        } catch (error) {
            edwinLogger.error('Failed to swap exact input:', error);
            throw error;
        }
    }

    /**
     * Swap input tokens for exact output tokens
     */
    async swapExactOutput(params: SaucerSwapExactOutputParameters): Promise<string> {
        edwinLogger.info(
            `Swapping for exact ${params.amountOut} ${params.outputTokenId} from ${params.inputTokenId} on ${params.network}`
        );

        try {
            const config = SaucerSwapService.NETWORK_CONFIG[params.network || 'testnet'];

            // Check input token balance
            let balance: number;
            if (params.inputTokenId === config.hbarTokenId) {
                balance = await this.wallet.getBalance();
            } else {
                balance = await this.wallet.getTokenBalance!(params.inputTokenId);
            }

            if (balance < params.amountInMaximum) {
                throw new Error(`Insufficient balance: ${balance} < ${params.amountInMaximum}`);
            }

            // Calculate deadline (default to 20 minutes from now)
            const deadline = params.deadline || Math.floor(Date.now() / 1000) + 1200;

            // Create contract execute transaction
            const swapRouterContractId = ContractId.fromString(config.swapRouterContractId);
            const recipient = AccountId.fromString(this.wallet.getAddress());

            // Convert token IDs to addresses for SaucerSwap V2
            const inputTokenAddress = params.inputTokenId === 'HBAR'
                ? '0x0000000000000000000000000000000000000000' // Native HBAR address
                : this.tokenIdToAddress(params.inputTokenId);
            const outputTokenAddress = this.tokenIdToAddress(params.outputTokenId);

            // Create function parameters for exactOutputSingle
            const functionParameters = new ContractFunctionParameters()
                .addAddress(inputTokenAddress)           // tokenIn
                .addAddress(outputTokenAddress)          // tokenOut
                .addUint24(parseInt(SaucerSwapService.DEFAULT_FEE, 16)) // fee as uint24
                .addAddress(recipient.toSolidityAddress()) // recipient
                .addUint256(deadline)                    // deadline
                .addUint256(Math.floor(params.amountOut * Math.pow(10, 8))) // amountOut
                .addUint256(Math.floor(params.amountInMaximum * Math.pow(10, 8))) // amountInMaximum
                .addUint160(0); // sqrtPriceLimitX96 as uint160

            const transaction = new ContractExecuteTransaction()
                .setContractId(swapRouterContractId)
                .setFunction('exactOutputSingle', functionParameters)
                .setGas(SaucerSwapService.GAS_LIMIT);

            // If input is HBAR, set payable amount
            if (params.inputTokenId === config.hbarTokenId) {
                transaction.setPayableAmount(Hbar.fromTinybars(Math.floor(params.amountInMaximum * 100000000)));
            }

            // Use the wallet's sendTransaction method instead of manual freezing
            const transactionId = await this.wallet.sendTransaction(transaction);

            edwinLogger.info(
                `Successfully swapped for exact ${params.amountOut} ${params.outputTokenId}. Transaction ID: ${transactionId}`
            );
            return transactionId;
        } catch (error) {
            edwinLogger.error('Failed to swap exact output:', error);
            throw error;
        }
    }

    /**
     * Convert Hedera token ID to Ethereum-style address for SaucerSwap V2
     */
    private tokenIdToAddress(tokenId: string): string {
        // Convert Hedera token ID (0.0.X) to Ethereum address format
        // This is a simplified conversion - in production you'd use proper conversion
        const parts = tokenId.split('.');
        if (parts.length === 3) {
            const tokenNum = parseInt(parts[2]);
            // Convert to 20-byte hex address (simplified)
            return `0x${'0'.repeat(32)}${tokenNum.toString(16).padStart(8, '0')}`;
        }
        return tokenId; // Return as-is if not in expected format
    }

    /**
     * Diagnose why a swap might fail by checking various conditions
     */
    async diagnoseSwapFailure(params: {
        inputTokenId: string;
        outputTokenId: string;
        network: 'testnet' | 'mainnet';
        amount: number;
    }): Promise<{
        canProceed: boolean;
        issues: string[];
        recommendations: string[];
        diagnosticInfo: {
            inputTokenAddress: string;
            outputTokenAddress: string;
            swapRouterContract: string;
            feeAnalysis: {
                feeHex: string;
                feeDecimal: number;
                feePercentage: number;
            };
        };
    }> {
        const issues: string[] = [];
        const recommendations: string[] = [];

        // Check 1: Network configuration
        const config = SaucerSwapService.NETWORK_CONFIG[params.network];
        if (!config) {
            issues.push(`Network "${params.network}" not supported`);
            recommendations.push('Use "testnet" or "mainnet"');
            return {
                canProceed: false,
                issues,
                recommendations,
                diagnosticInfo: {
                    inputTokenAddress: 'N/A',
                    outputTokenAddress: 'N/A',
                    swapRouterContract: 'N/A',
                    feeAnalysis: { feeHex: 'N/A', feeDecimal: 0, feePercentage: 0 }
                }
            };
        }

        // Check 2: Token address conversion
        const inputAddr = params.inputTokenId === 'HBAR'
            ? '0x0000000000000000000000000000000000000000'
            : this.tokenIdToAddress(params.inputTokenId);
        const outputAddr = this.tokenIdToAddress(params.outputTokenId);

        // Check 3: Fee analysis
        const feeHex = SaucerSwapService.DEFAULT_FEE;
        const feeDecimal = parseInt(feeHex, 16);
        const feePercentage = feeDecimal / 10000;

        const diagnosticInfo = {
            inputTokenAddress: inputAddr,
            outputTokenAddress: outputAddr,
            swapRouterContract: config.swapRouterContractId,
            feeAnalysis: {
                feeHex,
                feeDecimal,
                feePercentage
            }
        };

        edwinLogger.info(`🔍 SaucerSwap Diagnostic Analysis:`);
        edwinLogger.info(`   Network: ${params.network}`);
        edwinLogger.info(`   Input: ${params.inputTokenId} → ${inputAddr}`);
        edwinLogger.info(`   Output: ${params.outputTokenId} → ${outputAddr}`);
        edwinLogger.info(`   SwapRouter: ${config.swapRouterContractId}`);
        edwinLogger.info(`   Amount: ${params.amount} ${params.inputTokenId}`);
        edwinLogger.info(`   Fee: ${feeHex} (${feeDecimal} = ${feePercentage}%)`);

        // Check 4: Common failure scenarios
        if (params.inputTokenId === 'HBAR' && params.outputTokenId.includes('15058')) {
            issues.push('HBAR→WHBAR: Direct wrapping via SaucerSwap V2 may not be supported');
            recommendations.push('For HBAR wrapping, use dedicated WHBAR contract (0.0.5286055)');
            recommendations.push('SaucerSwap is for token-to-token trading, not HBAR wrapping');
        }

        if (params.inputTokenId === params.outputTokenId) {
            issues.push('Input and output tokens are identical');
            recommendations.push('Choose different input and output tokens for swapping');
        }

        // Check 5: Network-specific issues
        if (params.network === 'testnet') {
            issues.push('Testnet has limited liquidity pools and may lack pairs for many tokens');
            recommendations.push('Common testnet tokens: HBAR, WHBAR (0.0.15058), SAUCE (0.0.731861)');
            recommendations.push('Verify token pair has liquidity on testnet before swapping');
        }

        // Check 6: Token ID format validation
        const hederaTokenPattern = /^0\.0\.\d+$/;
        if (params.inputTokenId !== 'HBAR' && !hederaTokenPattern.test(params.inputTokenId)) {
            issues.push(`Invalid input token ID format: ${params.inputTokenId}`);
            recommendations.push('Use Hedera token ID format (0.0.XXXXXX) or "HBAR"');
        }

        if (params.outputTokenId !== 'HBAR' && !hederaTokenPattern.test(params.outputTokenId)) {
            issues.push(`Invalid output token ID format: ${params.outputTokenId}`);
            recommendations.push('Use Hedera token ID format (0.0.XXXXXX) or "HBAR"');
        }

        // Check 7: Fee tier recommendations
        if (feeDecimal === 500) { // 0.05%
            recommendations.push('Current fee tier: 0.05% (for stable pairs)');
            recommendations.push('Consider 0.3% (3000) for standard pairs or 1% (10000) for exotic pairs');
        }

        // Check 8: Amount validation
        if (params.amount <= 0) {
            issues.push('Swap amount must be greater than zero');
            recommendations.push('Specify a positive amount to swap');
        }

        if (params.amount < 0.001) {
            issues.push('Swap amount may be too small for contract execution');
            recommendations.push('Try amounts >= 0.001 HBAR for reliable execution');
        }

        return {
            canProceed: issues.length === 0,
            issues,
            recommendations,
            diagnosticInfo
        };
    }

    /**
     * Create swap path for token pair (simplified version)
     * In production, this would need proper path encoding with fees
     */
    private createSwapPath(inputTokenId: string, outputTokenId: string): string {
        // This is a simplified path creation
        // In production, you'd need to properly encode the path with fees
        return `${inputTokenId}-${SaucerSwapService.DEFAULT_FEE}-${outputTokenId}`;
    }

    /**
     * Encode swap path for SaucerSwap V2 quoter contract
     * Path format: tokenA + fee + tokenB (for single hop)
     */
    private encodeSwapPath(inputTokenAddress: string, outputTokenAddress: string, feeHex: string): Uint8Array {
        // Convert addresses from hex strings to bytes
        const inputTokenBytes = this.hexToBytes(inputTokenAddress);
        const outputTokenBytes = this.hexToBytes(outputTokenAddress);

        // Convert fee from hex to 3-byte array (uint24)
        const feeDecimal = parseInt(feeHex, 16);
        const feeBytes = new Uint8Array(3);
        feeBytes[0] = (feeDecimal >> 16) & 0xFF;
        feeBytes[1] = (feeDecimal >> 8) & 0xFF;
        feeBytes[2] = feeDecimal & 0xFF;

        // Combine: inputToken (20 bytes) + fee (3 bytes) + outputToken (20 bytes) = 43 bytes total
        const pathLength = inputTokenBytes.length + feeBytes.length + outputTokenBytes.length;
        const path = new Uint8Array(pathLength);

        let offset = 0;
        path.set(inputTokenBytes, offset);
        offset += inputTokenBytes.length;
        path.set(feeBytes, offset);
        offset += feeBytes.length;
        path.set(outputTokenBytes, offset);

        return path;
    }


    /**
     * Convert hex string to bytes array
     */
    private hexToBytes(hex: string): Uint8Array {
        // Remove '0x' prefix if present
        const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;

        // Ensure even length (pad with leading zero if needed)
        const paddedHex = cleanHex.length % 2 === 0 ? cleanHex : '0' + cleanHex;

        const bytes = new Uint8Array(paddedHex.length / 2);
        for (let i = 0; i < paddedHex.length; i += 2) {
            bytes[i / 2] = parseInt(paddedHex.substring(i, i + 2), 16);
        }
        return bytes;
    }
}

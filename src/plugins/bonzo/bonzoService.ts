import { EdwinService } from '../../core/classes/edwinToolProvider';
import { HederaWalletClient } from '../../core/wallets/hedera_wallet';
import edwinLogger from '../../utils/logger';
import { ContractExecuteTransaction, ContractId, ContractFunctionParameters, Hbar } from '@hashgraph/sdk';
import {
    BonzoSupplyParameters,
    BonzoWithdrawParameters,
    BonzoBorrowParameters,
    BonzoGetSuppliedBalanceParameters,
} from './parameters';

// Token decimals mapping based on official Bonzo code
const TOKEN_DECIMALS = {
    USDC: 6,
    HBARX: 8,
    SAUCE: 6,
    XSAUCE: 6,
    KARATE: 8,
    WHBAR: 8,
    GRELF: 8,
    KBL: 8,
    BONZO: 8,
    DOVU: 8,
    HST: 8,
    PACK: 6,
    STEAM: 2,
} as Record<string, number>;

interface TokenConfig {
    tokenId: string; // Hedera token ID for balance checks
    decimals: number;
    // Contract IDs as Hedera format
    tokenContractId: string;
    aTokenContractId: string;
    stableDebtContractId?: string;
    variableDebtContractId?: string;
}

export class BonzoService extends EdwinService {
    // Real addresses from official Bonzo bonzo_contracts.json
    private static readonly NETWORK_CONFIG = {
        mainnet: {
            lendingPoolContractId: '0.0.2345019', // Real LendingPool contract ID
            whbarContractId: '0.0.1456985', // WHBAR contract ID
            tokens: {
                // Real contract IDs from bonzo_contracts.json mainnet
                WHBAR: {
                    tokenId: '0.0.1456986', // Hedera ID for balance checks
                    decimals: 8,
                    tokenContractId: '0.0.1456986', // Real WHBAR token
                    aTokenContractId: '0.0.7243362', // Real aWHBAR
                    stableDebtContractId: '0.0.2042993',
                    variableDebtContractId: '0.0.13498531',
                },
                USDC: {
                    tokenId: '0.0.456858',
                    decimals: 6,
                    tokenContractId: '0.0.456858', // Real USDC token
                    aTokenContractId: '0.0.12068102', // Real aUSDC
                    stableDebtContractId: '0.0.10293965',
                    variableDebtContractId: '0.0.9217324',
                },
                HBARX: {
                    tokenId: '0.0.834116',
                    decimals: 8,
                    tokenContractId: '0.0.834116', // Real HBARX token
                    aTokenContractId: '0.0.4231666', // Real aHBARX
                    stableDebtContractId: '0.0.7093490',
                    variableDebtContractId: '0.0.15952373',
                },
                SAUCE: {
                    tokenId: '0.0.731861',
                    decimals: 6,
                    tokenContractId: '0.0.731861', // Real SAUCE token
                    aTokenContractId: '0.0.2943645', // Real aSAUCE
                    stableDebtContractId: '0.0.12019560',
                    variableDebtContractId: '0.0.7662851',
                },
            } as Record<string, TokenConfig>,
        },
        testnet: {
            lendingPoolContractId: '0.0.2345019', // Testnet LendingPool
            whbarContractId: '0.0.424242', // Testnet WHBAR contract
            tokens: {
                WHBAR: {
                    tokenId: '0.0.424242',
                    decimals: 8,
                    tokenContractId: '0.0.424242',
                    aTokenContractId: '0.0.7243362',
                    stableDebtContractId: '0.0.2042993',
                    variableDebtContractId: '0.0.13498531',
                },
                USDC: {
                    tokenId: '0.0.429274',
                    decimals: 6,
                    tokenContractId: '0.0.429274',
                    aTokenContractId: '0.0.12068102',
                    stableDebtContractId: '0.0.10293965',
                    variableDebtContractId: '0.0.9217324',
                },
                SAUCE: {
                    tokenId: '0.0.1364381',
                    decimals: 6,
                    tokenContractId: '0.0.1364381',
                    aTokenContractId: '0.0.2943645',
                    stableDebtContractId: '0.0.12019560',
                    variableDebtContractId: '0.0.7662851',
                },
            } as Record<string, TokenConfig>,
        },
    };

    private static readonly GAS_LIMIT = 3000000; // Higher gas limit for complex DeFi operations

    constructor(private wallet: HederaWalletClient) {
        super();
    }

    /**
     * Supply tokens to Bonzo Finance lending pool
     */
    async supply(params: BonzoSupplyParameters): Promise<string> {
        const network = params.network || 'mainnet';
        edwinLogger.info(`Supplying ${params.amount} ${params.tokenSymbol} to Bonzo Finance on ${network}`);

        try {
            // Validate amount early
            if (params.amount <= 0) {
                throw new Error('Amount must be greater than 0');
            }

            const config = BonzoService.NETWORK_CONFIG[network];
            const tokenConfig = config.tokens[params.tokenSymbol];

            if (!tokenConfig) {
                throw new Error(`Token ${params.tokenSymbol} not supported by Bonzo Finance`);
            }

            // Get decimals and normalize amount
            const decimals = TOKEN_DECIMALS[params.tokenSymbol] || 8;
            const normalizedAmount = Math.floor(params.amount * Math.pow(10, decimals));
            const isWHBAR = params.tokenSymbol === 'WHBAR';

            edwinLogger.info(`📊 Normalized amount: ${normalizedAmount} | Token ID: ${tokenConfig.tokenContractId}`);

            // For WHBAR, we need to send HBAR value and the contract will wrap it
            const lendingPoolId = ContractId.fromString(config.lendingPoolContractId);
            const tokenContractId = ContractId.fromString(tokenConfig.tokenContractId);

            // Check balance first
            if (isWHBAR) {
                const balance = await this.wallet.getBalance();
                if (balance < params.amount + 0.1) {
                    // Add buffer for fees
                    throw new Error(`Insufficient HBAR balance: ${balance} < ${params.amount + 0.1}`);
                }
            } else {
                if (!this.wallet.getTokenBalance) {
                    throw new Error('Token balance not supported by this wallet client');
                }
                const balance = await this.wallet.getTokenBalance(tokenConfig.tokenId);
                if (balance < params.amount) {
                    throw new Error(`Insufficient ${params.tokenSymbol} balance: ${balance} < ${params.amount}`);
                }
            }

            // Step 1: If WHBAR, wrap HBAR first
            if (isWHBAR) {
                edwinLogger.info('🌊 Wrapping HBAR to WHBAR...');
                const wrapTx = new ContractExecuteTransaction()
                    .setContractId(ContractId.fromString(config.whbarContractId))
                    .setFunction('deposit')
                    .setGas(500000)
                    .setPayableAmount(new Hbar(params.amount));

                const wrapTxId = await this.wallet.sendTransaction(wrapTx);
                edwinLogger.info(`✅ Wrapped HBAR: ${wrapTxId}`);
            }

            // Step 2: Approve token for lending pool
            edwinLogger.info('🔐 Approving token for lending pool...');
            const approveFunctionParams = new ContractFunctionParameters()
                .addAddress(lendingPoolId.toSolidityAddress())
                .addUint256(normalizedAmount);

            const approveTx = new ContractExecuteTransaction()
                .setContractId(tokenContractId)
                .setFunction('approve', approveFunctionParams)
                .setGas(200000);

            const approveTxId = await this.wallet.sendTransaction(approveTx);
            edwinLogger.info(`✅ Approved: ${approveTxId}`);

            // Step 3: Deposit to lending pool
            edwinLogger.info('💸 Depositing to lending pool...');
            const depositFunctionParams = new ContractFunctionParameters()
                .addAddress(tokenContractId.toSolidityAddress()) // asset
                .addUint256(normalizedAmount) // amount
                .addAddress(this.wallet.getAddress()) // onBehalfOf
                .addUint16(0); // referralCode

            const depositTx = new ContractExecuteTransaction()
                .setContractId(lendingPoolId)
                .setFunction('deposit', depositFunctionParams)
                .setGas(BonzoService.GAS_LIMIT);

            const depositTxId = await this.wallet.sendTransaction(depositTx);

            edwinLogger.info(`✅ Deposited: ${depositTxId}`);
            return depositTxId;
        } catch (error) {
            edwinLogger.error('Failed to supply tokens:', error);
            throw error;
        }
    }

    /**
     * Withdraw tokens from Bonzo Finance lending pool
     */
    async withdraw(params: BonzoWithdrawParameters): Promise<string> {
        const network = params.network || 'mainnet';
        edwinLogger.info(`Withdrawing ${params.amount} ${params.tokenSymbol} from Bonzo Finance on ${network}`);

        try {
            const config = BonzoService.NETWORK_CONFIG[network];
            const tokenConfig = config.tokens[params.tokenSymbol];

            if (!tokenConfig) {
                throw new Error(`Token ${params.tokenSymbol} not supported by Bonzo Finance`);
            }

            // Get decimals and normalize amount
            const decimals = TOKEN_DECIMALS[params.tokenSymbol] || 8;
            const normalizedAmount = Math.floor(params.amount * Math.pow(10, decimals));

            // Check aToken balance
            if (!this.wallet.getTokenBalance) {
                throw new Error('Token balance not supported by this wallet client');
            }
            const aTokenBalance = await this.wallet.getTokenBalance(tokenConfig.aTokenContractId.replace('0.0.', ''));
            if (aTokenBalance < params.amount) {
                throw new Error(`Insufficient aToken balance: ${aTokenBalance} < ${params.amount}`);
            }

            const lendingPoolId = ContractId.fromString(config.lendingPoolContractId);
            const tokenContractId = ContractId.fromString(tokenConfig.tokenContractId);

            edwinLogger.info('💵 WITHDRAW OPERATION');

            const withdrawFunctionParams = new ContractFunctionParameters()
                .addAddress(tokenContractId.toSolidityAddress()) // asset
                .addUint256(normalizedAmount) // amount
                .addAddress(this.wallet.getAddress()); // to

            const withdrawTx = new ContractExecuteTransaction()
                .setContractId(lendingPoolId)
                .setFunction('withdraw', withdrawFunctionParams)
                .setGas(BonzoService.GAS_LIMIT);

            const withdrawTxId = await this.wallet.sendTransaction(withdrawTx);

            edwinLogger.info(`✅ Withdrawn: ${withdrawTxId}`);
            return withdrawTxId;
        } catch (error) {
            edwinLogger.error('Failed to withdraw tokens:', error);
            throw error;
        }
    }

    /**
     * Borrow tokens from Bonzo Finance lending pool
     */
    async borrow(params: BonzoBorrowParameters): Promise<string> {
        const network = params.network || 'mainnet';
        edwinLogger.info(`Borrowing ${params.amount} ${params.tokenSymbol} from Bonzo Finance on ${network}`);

        try {
            const config = BonzoService.NETWORK_CONFIG[network];
            const tokenConfig = config.tokens[params.tokenSymbol];

            if (!tokenConfig) {
                throw new Error(`Token ${params.tokenSymbol} not supported by Bonzo Finance`);
            }

            // Check collateral first
            const collateralBalance = await this.getSuppliedBalance({
                tokenSymbol: params.tokenSymbol,
                network: network,
            });

            if (collateralBalance === 0) {
                throw new Error('No collateral available - deposit some assets first to use as collateral');
            }

            // Get decimals and normalize amount
            const decimals = TOKEN_DECIMALS[params.tokenSymbol] || 8;
            const normalizedAmount = Math.floor(params.amount * Math.pow(10, decimals));

            const lendingPoolId = ContractId.fromString(config.lendingPoolContractId);
            const tokenContractId = ContractId.fromString(tokenConfig.tokenContractId);

            edwinLogger.info('💳 BORROW OPERATION');

            const borrowFunctionParams = new ContractFunctionParameters()
                .addAddress(tokenContractId.toSolidityAddress()) // asset
                .addUint256(normalizedAmount) // amount
                .addUint256(2) // interestRateMode (2 = variable)
                .addUint16(0) // referralCode
                .addAddress(this.wallet.getAddress()); // onBehalfOf

            const borrowTx = new ContractExecuteTransaction()
                .setContractId(lendingPoolId)
                .setFunction('borrow', borrowFunctionParams)
                .setGas(BonzoService.GAS_LIMIT);

            const borrowTxId = await this.wallet.sendTransaction(borrowTx);

            edwinLogger.info(`✅ Borrowed: ${borrowTxId}`);
            return borrowTxId;
        } catch (error) {
            edwinLogger.error('Failed to borrow tokens:', error);
            throw error;
        }
    }

    /**
     * Get supplied balance (aToken balance) for a specific token
     */
    async getSuppliedBalance(params: BonzoGetSuppliedBalanceParameters): Promise<number> {
        const network = params.network || 'mainnet';
        edwinLogger.info(`Getting supplied balance for ${params.tokenSymbol} on ${network}`);

        try {
            const config = BonzoService.NETWORK_CONFIG[network];
            const tokenConfig = config.tokens[params.tokenSymbol];

            if (!tokenConfig || !tokenConfig.aTokenContractId) {
                throw new Error(`Token ${params.tokenSymbol} not supported or aToken not configured`);
            }

            // Get aToken balance using Hedera token balance query
            if (!this.wallet.getTokenBalance) {
                throw new Error('Token balance not supported by this wallet client');
            }

            const rawBalance = await this.wallet.getTokenBalance(tokenConfig.aTokenContractId.replace('0.0.', ''));

            // Balance is already in human-readable format from getTokenBalance
            edwinLogger.info(`📊 Final aToken balance: ${rawBalance} ${params.tokenSymbol}`);
            return rawBalance;
        } catch (error) {
            edwinLogger.error('Failed to get supplied balance:', error);
            // If there's an error (like account not found), return 0 instead of throwing
            edwinLogger.warn('Returning 0 balance due to error - might not be associated with aToken yet');
            return 0;
        }
    }

    /**
     * Get current supplied balance for the connected wallet
     */
    async getCurrentSuppliedBalance(tokenSymbol: string): Promise<number> {
        return this.getSuppliedBalance({
            tokenSymbol,
            network: 'mainnet',
        });
    }
}

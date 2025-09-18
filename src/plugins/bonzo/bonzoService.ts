import { EdwinService } from '../../core/classes/edwinToolProvider';
import { HederaWalletClient } from '../../core/wallets/hedera_wallet';
import edwinLogger from '../../utils/logger';
import {
    ContractExecuteTransaction,
    ContractId,
    TokenId,
    AccountId,
    Hbar,
    ContractFunctionParameters,
} from '@hashgraph/sdk';
import {
    BonzoSupplyParameters,
    BonzoWithdrawParameters,
    BonzoBorrowParameters,
    BonzoGetSuppliedBalanceParameters,
} from './parameters';

interface TokenConfig {
    tokenId: string;
    decimals: number;
    aTokenId?: string;
}

export class BonzoService extends EdwinService {
    // These would be loaded from bonzo_contracts.json in production
    private static readonly NETWORK_CONFIG = {
        mainnet: {
            lendingPoolId: '0.0.2297715', // Real Bonzo mainnet LendingPool
            tokens: {
                WHBAR: { tokenId: '0.0.1456986', decimals: 8, aTokenId: '0.0.2297681' },
                USDC: { tokenId: '0.0.456858', decimals: 6, aTokenId: '0.0.2297692' },
                SAUCE: { tokenId: '0.0.731861', decimals: 6, aTokenId: '0.0.2297703' },
                HBARX: { tokenId: '0.0.834116', decimals: 8, aTokenId: '0.0.2297714' },
                XSAUCE: { tokenId: '0.0.1419752', decimals: 6, aTokenId: '0.0.2297725' },
                KARATE: { tokenId: '0.0.2257374', decimals: 8, aTokenId: '0.0.2297736' },
            } as Record<string, TokenConfig>,
        },
        testnet: {
            lendingPoolId: '0.0.5417107', // Real Bonzo testnet LendingPool
            tokens: {
                WHBAR: { tokenId: '0.0.15058', decimals: 8, aTokenId: '0.0.5417073' },
                USDC: { tokenId: '0.0.5417', decimals: 6, aTokenId: '0.0.5417084' },
                SAUCE: { tokenId: '0.0.1183558', decimals: 6, aTokenId: '0.0.5417095' },
                HBARX: { tokenId: '0.0.2232557', decimals: 8, aTokenId: '0.0.5417106' },
                XSAUCE: { tokenId: '0.0.1399195', decimals: 6, aTokenId: '0.0.5417117' },
                KARATE: { tokenId: '0.0.3707373', decimals: 8, aTokenId: '0.0.5417128' },
            } as Record<string, TokenConfig>,
        },
    };

    private static readonly GAS_LIMIT = 3000000;

    constructor(private wallet: HederaWalletClient) {
        super();
    }

    /**
     * Supply tokens to Bonzo Finance lending pool
     */
    async supply(params: BonzoSupplyParameters): Promise<string> {
        edwinLogger.info(`Supplying ${params.amount} ${params.tokenSymbol} to Bonzo Finance on ${params.network}`);

        try {
            const config = BonzoService.NETWORK_CONFIG[params.network || 'testnet'];
            const tokenConfig = config.tokens[params.tokenSymbol];

            if (!tokenConfig) {
                throw new Error(`Token ${params.tokenSymbol} not supported by Bonzo Finance`);
            }

            // Check token balance
            let balance: number;
            if (params.tokenSymbol === 'WHBAR') {
                // WHBAR is wrapped HBAR - get HBAR balance instead
                balance = await this.wallet.getBalance();
            } else {
                balance = await this.wallet.getTokenBalance!(tokenConfig.tokenId);
            }

            if (balance < params.amount) {
                throw new Error(`Insufficient ${params.tokenSymbol} balance: ${balance} < ${params.amount}`);
            }

            // Convert amount to smallest units
            const amountInSmallestUnits = Math.floor(params.amount * Math.pow(10, tokenConfig.decimals));

            // Create contract execute transaction for deposit
            const lendingPoolContractId = ContractId.fromString(config.lendingPoolId);
            const asset = TokenId.fromString(tokenConfig.tokenId);
            const onBehalfOf = AccountId.fromString(this.wallet.getAddress());

            // Create function parameters
            const functionParameters = new ContractFunctionParameters()
                .addAddress(asset.toSolidityAddress())
                .addUint256(amountInSmallestUnits)
                .addAddress(onBehalfOf.toSolidityAddress())
                .addUint16(0); // referralCode

            const transaction = new ContractExecuteTransaction()
                .setContractId(lendingPoolContractId)
                .setFunction('deposit', functionParameters)
                .setGas(BonzoService.GAS_LIMIT);

            // WHBAR is an HTS token, not native HBAR, so no payable amount needed

            // Use the wallet's sendTransaction method instead of manual freezing
            const transactionId = await this.wallet.sendTransaction(transaction);

            edwinLogger.info(
                `Successfully supplied ${params.amount} ${params.tokenSymbol}. Transaction ID: ${transactionId}`
            );
            return transactionId;
        } catch (error) {
            edwinLogger.error('Failed to supply tokens:', error);
            throw error;
        }
    }

    /**
     * Withdraw tokens from Bonzo Finance lending pool
     */
    async withdraw(params: BonzoWithdrawParameters): Promise<string> {
        edwinLogger.info(`Withdrawing ${params.amount} ${params.tokenSymbol} from Bonzo Finance on ${params.network}`);

        try {
            const config = BonzoService.NETWORK_CONFIG[params.network || 'testnet'];
            const tokenConfig = config.tokens[params.tokenSymbol];

            if (!tokenConfig) {
                throw new Error(`Token ${params.tokenSymbol} not supported by Bonzo Finance`);
            }


            // Check aToken balance (supplied balance)
            const aTokenBalance = await this.getSuppliedBalance({
                tokenSymbol: params.tokenSymbol,
                network: params.network || 'testnet',
            });

            if (aTokenBalance < params.amount) {
                throw new Error(`Insufficient supplied balance: ${aTokenBalance} < ${params.amount}`);
            }

            // Convert amount to smallest units
            const amountInSmallestUnits = Math.floor(params.amount * Math.pow(10, tokenConfig.decimals));

            // Create contract execute transaction for withdrawal
            const lendingPoolContractId = ContractId.fromString(config.lendingPoolId);
            const asset = TokenId.fromString(tokenConfig.tokenId);
            const to = AccountId.fromString(this.wallet.getAddress());

            // Create function parameters
            const functionParameters = new ContractFunctionParameters()
                .addAddress(asset.toSolidityAddress())
                .addUint256(amountInSmallestUnits)
                .addAddress(to.toSolidityAddress());

            const transaction = new ContractExecuteTransaction()
                .setContractId(lendingPoolContractId)
                .setFunction('withdraw', functionParameters)
                .setGas(BonzoService.GAS_LIMIT);

            // Use the wallet's sendTransaction method
            const transactionId = await this.wallet.sendTransaction(transaction);

            edwinLogger.info(
                `Successfully withdrew ${params.amount} ${params.tokenSymbol}. Transaction ID: ${transactionId}`
            );
            return transactionId;
        } catch (error) {
            edwinLogger.error('Failed to withdraw tokens:', error);
            throw error;
        }
    }

    /**
     * Borrow tokens from Bonzo Finance lending pool (optional feature)
     */
    async borrow(params: BonzoBorrowParameters): Promise<string> {
        edwinLogger.info(`Borrowing ${params.amount} ${params.tokenSymbol} from Bonzo Finance on ${params.network}`);

        try {
            const config = BonzoService.NETWORK_CONFIG[params.network || 'testnet'];
            const tokenConfig = config.tokens[params.tokenSymbol];

            if (!tokenConfig) {
                throw new Error(`Token ${params.tokenSymbol} not supported by Bonzo Finance`);
            }


            // Convert amount to smallest units
            const amountInSmallestUnits = Math.floor(params.amount * Math.pow(10, tokenConfig.decimals));

            // Create contract execute transaction for borrowing
            const lendingPoolContractId = ContractId.fromString(config.lendingPoolId);
            const asset = TokenId.fromString(tokenConfig.tokenId);

            const onBehalfOf = AccountId.fromString(this.wallet.getAddress());

            // Create function parameters
            const functionParameters = new ContractFunctionParameters()
                .addAddress(asset.toSolidityAddress())
                .addUint256(amountInSmallestUnits)
                .addUint256(2) // interestRateMode (variable rate)
                .addUint16(0) // referralCode
                .addAddress(onBehalfOf.toSolidityAddress());

            const transaction = new ContractExecuteTransaction()
                .setContractId(lendingPoolContractId)
                .setFunction('borrow', functionParameters)
                .setGas(BonzoService.GAS_LIMIT);

            // Use the wallet's sendTransaction method
            const transactionId = await this.wallet.sendTransaction(transaction);

            edwinLogger.info(
                `Successfully borrowed ${params.amount} ${params.tokenSymbol}. Transaction ID: ${transactionId}`
            );
            return transactionId;
        } catch (error) {
            edwinLogger.error('Failed to borrow tokens:', error);
            throw error;
        }
    }

    /**
     * Get supplied balance (aToken balance) for a specific token
     */
    async getSuppliedBalance(params: BonzoGetSuppliedBalanceParameters): Promise<number> {
        edwinLogger.info(`Getting supplied balance for ${params.tokenSymbol} on ${params.network}`);

        try {
            const config = BonzoService.NETWORK_CONFIG[params.network || 'testnet'];
            const tokenConfig = config.tokens[params.tokenSymbol];

            if (!tokenConfig || !tokenConfig.aTokenId) {
                throw new Error(`Token ${params.tokenSymbol} not supported or aToken not configured`);
            }

            // Get aToken balance (represents supplied amount)
            return await this.wallet.getTokenBalance!(tokenConfig.aTokenId);
        } catch (error) {
            edwinLogger.error('Failed to get supplied balance:', error);
            throw error;
        }
    }

    /**
     * Get current supplied balance for the connected wallet
     */
    async getCurrentSuppliedBalance(tokenSymbol: string): Promise<number> {
        return this.getSuppliedBalance({
            tokenSymbol,
            network: 'testnet', // Default to testnet
        });
    }
}

import { EdwinService } from '../../core/classes/edwinToolProvider';
import { HederaWalletClient } from '../../core/wallets/hedera_wallet';
import edwinLogger from '../../utils/logger';
import {
    ContractExecuteTransaction,
    ContractId,
    Hbar,
    ContractFunctionParameters,
    TokenAssociateTransaction,
    TokenId,
    AccountAllowanceApproveTransaction,
} from '@hashgraph/sdk';
import {
    StaderStakeParameters,
    StaderUnstakeParameters,
    StaderWithdrawParameters,
    StaderGetBalanceParameters,
} from './parameters';

export class StaderService extends EdwinService {
    private static readonly NETWORK_CONFIG = {
        mainnet: {
            tokenId: '0.0.834116', // HBARX token
            stakingContractId: '0.0.1412503', // CORRECT staking contract (verified from successful transaction)
            undelegationContractId: '0.0.1027587',
        },
    };

    private static readonly GAS_LIMIT = 2000000;
    private static readonly HBARX_DECIMALS = 8;

    constructor(private wallet: HederaWalletClient) {
        super();
    }

    /**
     * Stake HBAR to receive HBARX
     */
    async stake(params: StaderStakeParameters): Promise<string> {
        const network = params.network || 'mainnet';
        edwinLogger.info(`Staking ${params.amount} HBAR for HBARX on ${network}`);

        // Stader is only deployed on mainnet
        if (network === 'testnet') {
            throw new Error('Stader HBARX is only available on mainnet. Please use network: "mainnet"');
        }

        try {
            const config = StaderService.NETWORK_CONFIG.mainnet;

            // Check HBAR balance (add buffer for fees)
            const balance = await this.wallet.getBalance();
            const requiredBalance = params.amount + 1; // 1 HBAR buffer for fees
            if (balance < requiredBalance) {
                throw new Error(`Insufficient HBAR balance: ${balance} < ${requiredBalance} (amount + fee buffer)`);
            }

            edwinLogger.info(`Balance check passed: ${balance} HBAR available`);

            const stakingContractId = ContractId.fromString(config.stakingContractId);
            const hbarxTokenId = TokenId.fromString(config.tokenId);

            // Step 1: Associate with HBARX token if not already associated
            try {
                edwinLogger.info(`Step 1/3: Associating with HBARX token ${config.tokenId}...`);
                const associateTx = new TokenAssociateTransaction()
                    .setAccountId(this.wallet.getAddress())
                    .setTokenIds([hbarxTokenId]);

                const associateTxId = await this.wallet.sendTransaction(associateTx);
                edwinLogger.info(`✅ Token association successful: ${associateTxId}`);
            } catch (error) {
                const errorMsg = (error as Error).message;
                // TOKEN_ALREADY_ASSOCIATED is expected and fine
                if (errorMsg.includes('TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT')) {
                    edwinLogger.info(`✅ Token already associated`);
                } else {
                    edwinLogger.warn(`Token association warning: ${errorMsg}`);
                }
            }

            // Step 2: Approve HBAR allowance for staking contract
            edwinLogger.info(`Step 2/3: Approving HBAR allowance for staking contract...`);
            const approveAllowanceTx = new AccountAllowanceApproveTransaction().approveHbarAllowance(
                this.wallet.getAddress(),
                stakingContractId.toString(),
                new Hbar(params.amount)
            );

            const allowanceTxId = await this.wallet.sendTransaction(approveAllowanceTx);
            edwinLogger.info(`✅ Allowance approved: ${allowanceTxId}`);

            // Step 3: Call stake function on contract
            edwinLogger.info(`Step 3/3: Staking ${params.amount} HBAR to contract ${stakingContractId}...`);
            const stakeTx = new ContractExecuteTransaction()
                .setContractId(stakingContractId)
                .setGas(StaderService.GAS_LIMIT)
                .setPayableAmount(new Hbar(params.amount))
                .setFunction('stake');

            const transactionId = await this.wallet.sendTransaction(stakeTx);

            edwinLogger.info(`✅ Successfully staked ${params.amount} HBAR. Transaction ID: ${transactionId}`);
            return transactionId;
        } catch (error) {
            edwinLogger.error('Failed to stake HBAR:', error);
            throw error;
        }
    }

    /**
     * Unstake HBARX to initiate withdrawal process
     */
    async unstake(params: StaderUnstakeParameters): Promise<string> {
        const network = params.network || 'mainnet';
        edwinLogger.info(`Unstaking ${params.amount} HBARX on ${network}`);

        // Stader is only deployed on mainnet
        if (network === 'testnet') {
            throw new Error('Stader HBARX is only available on mainnet. Please use network: "mainnet"');
        }

        try {
            const config = StaderService.NETWORK_CONFIG.mainnet;

            // Check HBARX balance
            if (!this.wallet.getTokenBalance) {
                throw new Error('Token balance not supported by this wallet client');
            }
            const hbarxBalance = await this.wallet.getTokenBalance(config.tokenId);
            if (hbarxBalance < params.amount) {
                throw new Error(`Insufficient HBARX balance: ${hbarxBalance} < ${params.amount}`);
            }

            // Create contract execute transaction for unstaking (following official CLI pattern)
            // NOTE: Official CLI uses stakingContractId for unStake, not undelegationContractId
            const stakingContractId = ContractId.fromString(config.stakingContractId);
            const unstakeAmount = Math.floor(params.amount * Math.pow(10, StaderService.HBARX_DECIMALS)); // Convert to smallest units

            // Create function parameters
            const functionParameters = new ContractFunctionParameters().addUint256(unstakeAmount);

            const transaction = new ContractExecuteTransaction()
                .setContractId(stakingContractId)
                .setFunction('unStake', functionParameters)
                .setGas(StaderService.GAS_LIMIT);

            // Use the wallet's sendTransaction method instead of manual freezing
            const transactionId = await this.wallet.sendTransaction(transaction);

            edwinLogger.info(`Successfully unstaked ${params.amount} HBARX. Transaction ID: ${transactionId}`);
            return transactionId;
        } catch (error) {
            edwinLogger.error('Failed to unstake HBARX:', error);
            throw error;
        }
    }

    /**
     * Withdraw HBAR after unstaking period (24 hours)
     */
    async withdraw(params: StaderWithdrawParameters): Promise<string> {
        edwinLogger.info(`Withdrawing unstake index ${params.unstakeIndex} on mainnet`);

        try {
            const config = StaderService.NETWORK_CONFIG.mainnet;

            // Create contract execute transaction for withdrawal
            const undelegationContractId = ContractId.fromString(config.undelegationContractId);

            // Create function parameters
            const functionParameters = new ContractFunctionParameters().addUint256(params.unstakeIndex);

            const transaction = new ContractExecuteTransaction()
                .setContractId(undelegationContractId)
                .setFunction('withdraw', functionParameters)
                .setGas(StaderService.GAS_LIMIT);

            // Use the wallet's sendTransaction method instead of manual freezing
            const transactionId = await this.wallet.sendTransaction(transaction);

            edwinLogger.info(
                `Successfully withdrew unstake index ${params.unstakeIndex}. Transaction ID: ${transactionId}`
            );
            return transactionId;
        } catch (error) {
            edwinLogger.error('Failed to withdraw:', error);
            throw error;
        }
    }

    /**
     * Get current HBARX balance for the connected wallet
     */
    async getStakedBalance(): Promise<number> {
        edwinLogger.info('Getting current HBARX balance');

        try {
            // Use mainnet configuration
            const config = StaderService.NETWORK_CONFIG.mainnet;
            if (!this.wallet.getTokenBalance) {
                throw new Error('Token balance not supported by this wallet client');
            }
            return await this.wallet.getTokenBalance(config.tokenId);
        } catch (error) {
            edwinLogger.error('Failed to get HBARX balance:', error);
            throw error;
        }
    }

    /**
     * Get HBARX balance for a specific network
     */
    async getStakedBalanceByNetwork(_params: StaderGetBalanceParameters): Promise<number> {
        edwinLogger.info(`Getting HBARX balance on mainnet`);

        try {
            const config = StaderService.NETWORK_CONFIG.mainnet;
            if (!this.wallet.getTokenBalance) {
                throw new Error('Token balance not supported by this wallet client');
            }
            return await this.wallet.getTokenBalance(config.tokenId);
        } catch (error) {
            edwinLogger.error('Failed to get HBARX balance:', error);
            throw error;
        }
    }
}

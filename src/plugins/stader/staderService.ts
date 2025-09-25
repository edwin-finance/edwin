import { EdwinService } from '../../core/classes/edwinToolProvider';
import { HederaWalletClient } from '../../core/wallets/hedera_wallet';
import edwinLogger from '../../utils/logger';
import { ContractExecuteTransaction, ContractId, Hbar, ContractFunctionParameters } from '@hashgraph/sdk';
import {
    StaderStakeParameters,
    StaderUnstakeParameters,
    StaderWithdrawParameters,
    StaderGetBalanceParameters,
} from './parameters';

export class StaderService extends EdwinService {
    private static readonly NETWORK_CONFIG = {
        mainnet: {
            tokenId: '0.0.834116',
            stakingContractId: '0.0.1027588',
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
        edwinLogger.info(`Staking ${params.amount} HBAR for HBARX on mainnet`);

        try {
            const config = StaderService.NETWORK_CONFIG.mainnet;

            // Check HBAR balance
            const balance = await this.wallet.getBalance();
            if (balance < params.amount) {
                throw new Error(`Insufficient HBAR balance: ${balance} < ${params.amount}`);
            }

            // Create contract execute transaction for staking (following official CLI pattern)
            const stakingContractId = ContractId.fromString(config.stakingContractId);

            const transaction = new ContractExecuteTransaction()
                .setContractId(stakingContractId)
                .setFunction('stake')
                .setGas(StaderService.GAS_LIMIT)
                .setPayableAmount(new Hbar(params.amount));

            // Use the wallet's sendTransaction method instead of manual freezing
            const transactionId = await this.wallet.sendTransaction(transaction);

            edwinLogger.info(`Successfully staked ${params.amount} HBAR. Transaction ID: ${transactionId}`);
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
        edwinLogger.info(`Unstaking ${params.amount} HBARX on mainnet`);

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

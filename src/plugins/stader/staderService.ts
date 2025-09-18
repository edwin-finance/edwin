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
        testnet: {
            tokenId: '0.0.48247328',
            stakingContractId: '0.0.48247334',
            undelegationContractId: '0.0.48247333',
        },
    };

    constructor(private wallet: HederaWalletClient) {
        super();
    }

    /**
     * Stake HBAR to receive HBARX
     */
    async stake(params: StaderStakeParameters): Promise<string> {
        edwinLogger.info(`Staking ${params.amount} HBAR for HBARX on ${params.network}`);

        try {
            const config = StaderService.NETWORK_CONFIG[params.network || 'testnet'];

            // Check HBAR balance
            const balance = await this.wallet.getBalance();
            if (balance < params.amount) {
                throw new Error(`Insufficient HBAR balance: ${balance} < ${params.amount}`);
            }

            // Create contract execute transaction for staking
            const stakingContractId = ContractId.fromString(config.stakingContractId);
            const stakeAmount = Hbar.fromTinybars(Math.floor(params.amount * 100000000));

            const transaction = new ContractExecuteTransaction()
                .setContractId(stakingContractId)
                .setFunction('stake')
                .setGas(2000000)
                .setPayableAmount(stakeAmount);

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
        edwinLogger.info(`Unstaking ${params.amount} HBARX on ${params.network}`);

        try {
            const config = StaderService.NETWORK_CONFIG[params.network || 'testnet'];

            // Check HBARX balance
            const hbarxBalance = await this.wallet.getTokenBalance!(config.tokenId);
            if (hbarxBalance < params.amount) {
                throw new Error(`Insufficient HBARX balance: ${hbarxBalance} < ${params.amount}`);
            }

            // Create contract execute transaction for unstaking
            const undelegationContractId = ContractId.fromString(config.undelegationContractId);
            const unstakeAmount = Math.floor(params.amount * 100000000); // Convert to smallest units

            // Create function parameters
            const functionParameters = new ContractFunctionParameters().addUint256(unstakeAmount);

            const transaction = new ContractExecuteTransaction()
                .setContractId(undelegationContractId)
                .setFunction('unStake', functionParameters)
                .setGas(2000000);

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
        edwinLogger.info(`Withdrawing unstake index ${params.unstakeIndex} on ${params.network}`);

        try {
            const config = StaderService.NETWORK_CONFIG[params.network || 'testnet'];

            // Create contract execute transaction for withdrawal
            const undelegationContractId = ContractId.fromString(config.undelegationContractId);

            // Create function parameters
            const functionParameters = new ContractFunctionParameters().addUint256(params.unstakeIndex);

            const transaction = new ContractExecuteTransaction()
                .setContractId(undelegationContractId)
                .setFunction('withdraw', functionParameters)
                .setGas(2000000);

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
            // Use testnet by default, but this could be made configurable
            const config = StaderService.NETWORK_CONFIG.testnet;
            return await this.wallet.getTokenBalance!(config.tokenId);
        } catch (error) {
            edwinLogger.error('Failed to get HBARX balance:', error);
            throw error;
        }
    }

    /**
     * Get HBARX balance for a specific network
     */
    async getStakedBalanceByNetwork(params: StaderGetBalanceParameters): Promise<number> {
        edwinLogger.info(`Getting HBARX balance on ${params.network}`);

        try {
            const config = StaderService.NETWORK_CONFIG[params.network || 'testnet'];
            return await this.wallet.getTokenBalance!(config.tokenId);
        } catch (error) {
            edwinLogger.error('Failed to get HBARX balance:', error);
            throw error;
        }
    }
}

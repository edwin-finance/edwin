import { EdwinService } from '../../core/classes/edwinToolProvider';
import { HederaWalletClient } from '../../core/wallets/hedera_wallet';
import edwinLogger from '../../utils/logger';
import { TransferTransaction, AccountId, Hbar, TokenId } from '@hashgraph/sdk';
import {
    HederaWalletBalanceParameters,
    HederaWalletTokenBalanceParameters,
    HederaWalletAccountInfoParameters,
    HederaWalletTransferHbarParameters,
    HederaWalletTransferTokenParameters,
} from './parameters';

export class HederaWalletService extends EdwinService {
    constructor(private wallet: HederaWalletClient) {
        super();
    }

    /**
     * Get HBAR balance of any Hedera account
     */
    async getHederaWalletBalance(params: HederaWalletBalanceParameters): Promise<number> {
        edwinLogger.info(`Getting HBAR balance for Hedera account: ${params.accountId}`);

        try {
            return await this.wallet.getBalanceOfAccount(params.accountId);
        } catch (error) {
            edwinLogger.error('Failed to get Hedera wallet balance:', error);
            throw error;
        }
    }

    /**
     * Get HBAR balance of the current Hedera account
     */
    async getCurrentHederaWalletBalance(): Promise<number> {
        edwinLogger.info('Getting HBAR balance for current Hedera account');

        try {
            return await this.wallet.getBalance();
        } catch (error) {
            edwinLogger.error('Failed to get current Hedera wallet balance:', error);
            throw error;
        }
    }

    /**
     * Get token balance for any Hedera account
     */
    async getHederaWalletTokenBalance(params: HederaWalletTokenBalanceParameters): Promise<number> {
        edwinLogger.info(`Getting token balance for account: ${params.accountId}, token: ${params.tokenId}`);

        try {
            // Use the base client's token balance method
            if (!this.wallet.getTokenBalanceOfAccount) {
                throw new Error('Token balance for accounts not supported by this wallet client');
            }
            return await this.wallet.getTokenBalanceOfAccount(params.accountId, params.tokenId);
        } catch (error) {
            edwinLogger.error('Failed to get Hedera wallet token balance:', error);
            throw error;
        }
    }

    /**
     * Get token balance for the current Hedera account
     */
    async getCurrentHederaWalletTokenBalance(tokenId: string): Promise<number> {
        edwinLogger.info(`Getting token balance for current account, token: ${tokenId}`);

        try {
            if (!this.wallet.getTokenBalance) {
                throw new Error('Token balance not supported by this wallet client');
            }
            return await this.wallet.getTokenBalance(tokenId);
        } catch (error) {
            edwinLogger.error('Failed to get current Hedera wallet token balance:', error);
            throw error;
        }
    }

    /**
     * Get account information for any Hedera account
     */
    async getHederaWalletAccountInfo(params: HederaWalletAccountInfoParameters): Promise<unknown> {
        edwinLogger.info(`Getting account info for Hedera account: ${params.accountId}`);

        try {
            // Use the base client's account info method
            if (!this.wallet.getAccountInfoForAccount) {
                throw new Error('Account info for accounts not supported by this wallet client');
            }
            return await this.wallet.getAccountInfoForAccount(params.accountId);
        } catch (error) {
            edwinLogger.error('Failed to get Hedera account info:', error);
            throw error;
        }
    }

    /**
     * Get account information for the current Hedera account
     */
    async getCurrentHederaWalletAccountInfo(): Promise<unknown> {
        edwinLogger.info('Getting account info for current Hedera account');

        try {
            return await this.wallet.getAccountInfo();
        } catch (error) {
            edwinLogger.error('Failed to get current Hedera account info:', error);
            throw error;
        }
    }

    /**
     * Transfer HBAR to another account
     */
    async transferHbar(params: HederaWalletTransferHbarParameters): Promise<string> {
        edwinLogger.info(`Transferring ${params.amount} HBAR to account: ${params.toAccountId}`);

        try {
            // Construct the transfer transaction
            const fromAccount = AccountId.fromString(this.wallet.getAddress());
            const toAccount = AccountId.fromString(params.toAccountId);
            const transferAmount = Hbar.fromTinybars(Math.floor(params.amount * 100000000)); // Convert HBAR to tinybars

            const transaction = new TransferTransaction()
                .addHbarTransfer(fromAccount, transferAmount.negated())
                .addHbarTransfer(toAccount, transferAmount);

            // Use the wallet's generic sendTransaction method
            return await this.wallet.sendTransaction(transaction);
        } catch (error) {
            edwinLogger.error('Failed to transfer HBAR:', error);
            throw error;
        }
    }

    /**
     * Transfer tokens to another account
     */
    async transferToken(params: HederaWalletTransferTokenParameters): Promise<string> {
        edwinLogger.info(`Transferring ${params.amount} of token ${params.tokenId} to account: ${params.toAccountId}`);

        try {
            // Construct the token transfer transaction
            const fromAccount = AccountId.fromString(this.wallet.getAddress());
            const toAccount = AccountId.fromString(params.toAccountId);
            const token = TokenId.fromString(params.tokenId);

            const transaction = new TransferTransaction()
                .addTokenTransfer(token, fromAccount, -params.amount)
                .addTokenTransfer(token, toAccount, params.amount);

            // Use the wallet's generic sendTransaction method
            return await this.wallet.sendTransaction(transaction);
        } catch (error) {
            edwinLogger.error('Failed to transfer token:', error);
            throw error;
        }
    }
}

import {
    PrivateKey,
    AccountId,
    Transaction,
    TransferTransaction,
    TokenTransferTransaction,
    Hbar,
    TokenId,
    TransactionId,
} from '@hashgraph/sdk';
import edwinLogger from '../../../../../utils/logger';
import { BaseHederaWalletClient } from '../../base_client';

/**
 * Hedera wallet client that uses a private key for signing
 */
export class KeypairClient extends BaseHederaWalletClient {
    private privateKey: PrivateKey;

    constructor(privateKey: string | PrivateKey, accountId?: string | AccountId) {
        // If accountId is not provided, derive it from the private key
        const key = typeof privateKey === 'string' ? PrivateKey.fromString(privateKey) : privateKey;
        const account = accountId
            ? typeof accountId === 'string'
                ? AccountId.fromString(accountId)
                : accountId
            : key.publicKey.toAccountId(0, 0);

        super(account);
        this.privateKey = key;
    }

    /**
     * Get the underlying private key
     */
    getPrivateKey(): PrivateKey {
        return this.privateKey;
    }

    /**
     * Sign a transaction with the wallet's private key
     */
    async signTransaction(transaction: Transaction): Promise<Transaction> {
        try {
            return transaction.sign(this.privateKey);
        } catch (error) {
            edwinLogger.error('Failed to sign transaction:', error);
            throw new Error(`Failed to sign transaction: ${error}`);
        }
    }

    /**
     * Send a transaction
     */
    async sendTransaction(transaction: Transaction): Promise<string> {
        try {
            const client = this.getClient();

            // Sign the transaction
            const signedTransaction = await this.signTransaction(transaction);

            // Execute the transaction
            const response = await signedTransaction.execute(client);

            // Get the transaction receipt to ensure it was successful
            const receipt = await response.getReceipt(client);

            if (receipt.status.toString() !== 'SUCCESS') {
                throw new Error(`Transaction failed with status: ${receipt.status.toString()}`);
            }

            return response.transactionId.toString();
        } catch (error) {
            edwinLogger.error('Failed to send transaction:', error);
            throw new Error(`Failed to send transaction: ${error}`);
        }
    }

    /**
     * Transfer HBAR to another account
     */
    async transferHbar(toAccountId: string, amount: number): Promise<string> {
        try {
            const client = this.getClient();
            const toAccount = AccountId.fromString(toAccountId);
            const transferAmount = Hbar.fromTinybars(Math.floor(amount * 100000000)); // Convert HBAR to tinybars

            edwinLogger.info(`Transferring ${amount} HBAR from ${this.getAddress()} to ${toAccountId}`);

            const transaction = new TransferTransaction()
                .addHbarTransfer(this.accountId, transferAmount.negated())
                .addHbarTransfer(toAccount, transferAmount)
                .setTransactionId(TransactionId.generate(this.accountId))
                .freezeWith(client);

            return await this.sendTransaction(transaction);
        } catch (error) {
            edwinLogger.error(`Failed to transfer HBAR to ${toAccountId}:`, error);
            throw new Error(`Failed to transfer HBAR to ${toAccountId}: ${error}`);
        }
    }

    /**
     * Transfer tokens to another account
     */
    async transferToken(toAccountId: string, tokenId: string, amount: number): Promise<string> {
        try {
            const client = this.getClient();
            const toAccount = AccountId.fromString(toAccountId);
            const token = TokenId.fromString(tokenId);

            edwinLogger.info(`Transferring ${amount} of token ${tokenId} from ${this.getAddress()} to ${toAccountId}`);

            const transaction = new TokenTransferTransaction()
                .addTokenTransfer(token, this.accountId, -amount)
                .addTokenTransfer(token, toAccount, amount)
                .setTransactionId(TransactionId.generate(this.accountId))
                .freezeWith(client);

            return await this.sendTransaction(transaction);
        } catch (error) {
            edwinLogger.error(`Failed to transfer token ${tokenId} to ${toAccountId}:`, error);
            throw new Error(`Failed to transfer token ${tokenId} to ${toAccountId}: ${error}`);
        }
    }
}

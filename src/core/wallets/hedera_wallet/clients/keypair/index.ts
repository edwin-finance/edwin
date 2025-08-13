import { PrivateKey, AccountId, Transaction } from '@hashgraph/sdk';
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
            // Sign the transaction with the private key
            return await transaction.sign(this.privateKey);
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

            // Set the operator for the client
            client.setOperator(this.accountId, this.privateKey);

            // Execute the transaction (it will be automatically signed)
            const response = await transaction.execute(client);

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
}

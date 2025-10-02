import { PrivateKey, AccountId, Transaction, TransactionRecord } from '@hashgraph/sdk';
import edwinLogger from '../../../../../utils/logger';
import { BaseHederaWalletClient } from '../../base_client';

/**
 * Hedera wallet client that uses a private key for signing
 */
export class KeypairClient extends BaseHederaWalletClient {
    private privateKey: PrivateKey;

    constructor(privateKey: string | PrivateKey, accountId?: string | AccountId) {
        // If accountId is not provided, derive it from the private key
        let key: PrivateKey;
        if (typeof privateKey === 'string') {
            // Remove 0x prefix if present
            const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;

            // Try to parse the private key - it could be DER, ED25519, or ECDSA format
            try {
                // Check if it's DER format (starts with 302)
                if (cleanKey.startsWith('302')) {
                    key = PrivateKey.fromStringDer(cleanKey);
                } else if (cleanKey.length === 64) {
                    // Could be either ED25519 or ECDSA (both 64 hex chars)
                    // Try ECDSA first since the key has 0x prefix (Ethereum-style)
                    try {
                        key = PrivateKey.fromStringECDSA(cleanKey);
                    } catch {
                        // If ECDSA fails, try ED25519
                        key = PrivateKey.fromStringED25519(cleanKey);
                    }
                } else if (cleanKey.length === 96) {
                    // DER-encoded format (96 hex chars)
                    key = PrivateKey.fromStringDer(cleanKey);
                } else {
                    // Try the generic fromString as fallback
                    edwinLogger.warn('Using generic PrivateKey.fromString method');
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    key = (PrivateKey as any).fromString(cleanKey);
                }
            } catch (e) {
                // If all parsing fails, log the error and try the original string
                edwinLogger.error('Failed to parse private key:', e);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                key = (PrivateKey as any).fromString(privateKey);
            }
        } else {
            key = privateKey;
        }
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

            // Set the operator for the client (this handles signing and fee payment)
            client.setOperator(this.accountId, this.privateKey);

            // Execute the transaction directly - the SDK will handle freezing and signing
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

    /**
     * Send a transaction and return full response with record
     */
    async sendTransactionWithResponse(
        transaction: Transaction
    ): Promise<{ transactionId: string; record: TransactionRecord }> {
        try {
            const client = this.getClient();

            // Set the operator for the client (this handles signing and fee payment)
            client.setOperator(this.accountId, this.privateKey);

            // Execute the transaction directly - the SDK will handle freezing and signing
            const response = await transaction.execute(client);

            // Get the transaction record for detailed results
            const record = await response.getRecord(client);

            if (record.receipt.status.toString() !== 'SUCCESS') {
                throw new Error(`Transaction failed with status: ${record.receipt.status.toString()}`);
            }

            return {
                transactionId: response.transactionId.toString(),
                record: record,
            };
        } catch (error) {
            edwinLogger.error('Failed to send transaction with response:', error);
            throw new Error(`Failed to send transaction: ${error}`);
        }
    }
}

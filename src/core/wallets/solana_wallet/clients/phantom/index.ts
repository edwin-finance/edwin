import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { BaseSolanaWalletClient } from '../../base_client';
import edwinLogger from '../../../../../utils/logger';

/**
 * Phantom provider interface
 */
export interface PhantomProvider {
    solana: {
        publicKey: PublicKey;
        signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>;
        signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]>;
        signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>;
        sendTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<string>;
        connect(): Promise<{ publicKey: PublicKey }>;
        disconnect(): Promise<void>;
    };
    isConnected: boolean;
    show(): void;
}

/**
 * Client for interacting with Solana through Phantom wallet
 */
export class PhantomClient extends BaseSolanaWalletClient {
    private provider: PhantomProvider;

    constructor(provider: PhantomProvider) {
        if (!provider.solana || !provider.solana.publicKey) {
            throw new Error('Phantom wallet is not connected');
        }

        super(provider.solana.publicKey);
        this.provider = provider;
    }

    /**
     * Sign a transaction using Phantom wallet
     */
    async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
        if (!this.provider.solana) {
            throw new Error('Phantom wallet is not connected');
        }

        return this.provider.solana.signTransaction(transaction);
    }

    /**
     * Sign multiple transactions using Phantom wallet
     */
    async signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> {
        if (!this.provider.solana) {
            throw new Error('Phantom wallet is not connected');
        }

        return this.provider.solana.signAllTransactions(transactions);
    }

    /**
     * Sign a message using Phantom wallet
     */
    async signMessage(message: Uint8Array): Promise<Uint8Array> {
        if (!this.provider.solana) {
            throw new Error('Phantom wallet is not connected');
        }

        const { signature } = await this.provider.solana.signMessage(message);
        return signature;
    }

    /**
     * Send a transaction using Phantom wallet
     * Note: In Phantom's case, we don't need Connection or additional signers
     * as Phantom handles the sending internally
     */
    async sendTransaction(_connection: Connection, transaction: Transaction, _signers?: Keypair[]): Promise<string> {
        if (!this.provider.solana) {
            throw new Error('Phantom wallet is not connected');
        }

        // Phantom's sendTransaction expects the transaction to be already signed
        // by any required signers other than the wallet's keypair
        return this.provider.solana.sendTransaction(transaction);
    }

    /**
     * Wait for transaction confirmation
     */
    async waitForConfirmationGracefully(
        connection: Connection,
        signature: string,
        timeout: number = 120000
    ): Promise<{ err: unknown; confirmationStatus?: 'confirmed' | 'finalized' | 'processed' }> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            // Fetch the status of the transaction
            const { value } = await connection.getSignatureStatus(signature, {
                searchTransactionHistory: true,
            });

            if (value) {
                // Check for transaction error
                if (value.err) {
                    edwinLogger.error(`Transaction failed: ${JSON.stringify(value.err)}`);
                    return { err: value.err };
                }

                if (value.confirmationStatus === 'confirmed' || value.confirmationStatus === 'finalized') {
                    return value; // Transaction is confirmed or finalized
                }
            }

            // Wait for a short interval before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const timeoutError = new Error('Transaction confirmation timed out');
        edwinLogger.error('Transaction confirmation timed out');
        return { err: timeoutError };
    }
}

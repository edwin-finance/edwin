import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { BaseSolanaWalletClient } from '../../base_client';

/**
 * Read-only Solana wallet client that can only perform operations that don't require signing
 */
export class PublicKeyClient extends BaseSolanaWalletClient {
    constructor(publicKey: string | PublicKey) {
        super(publicKey);
    }

    /**
     * Not supported in public key client - throws error
     */
    async signTransaction<T extends Transaction | VersionedTransaction>(_transaction: T): Promise<T> {
        throw new Error('Cannot sign transactions with a read-only PublicKeyClient');
    }

    /**
     * Not supported in public key client - throws error
     */
    async signAllTransactions<T extends Transaction | VersionedTransaction>(_transactions: T[]): Promise<T[]> {
        throw new Error('Cannot sign transactions with a read-only PublicKeyClient');
    }

    /**
     * Not supported in public key client - throws error
     */
    async signMessage(_message: Uint8Array): Promise<Uint8Array> {
        throw new Error('Cannot sign messages with a read-only PublicKeyClient');
    }

    /**
     * Not supported in public key client - throws error
     */
    async sendTransaction(_connection: Connection, _transaction: Transaction, _signers?: Keypair[]): Promise<string> {
        throw new Error('Cannot send transactions with a read-only PublicKeyClient');
    }

    /**
     * Not supported in public key client - throws error
     */
    async waitForConfirmationGracefully(
        _connection: Connection,
        _signature: string,
        _timeout?: number
    ): Promise<{ err: unknown; confirmationStatus?: 'confirmed' | 'finalized' | 'processed' }> {
        throw new Error('Cannot wait for confirmation with a read-only PublicKeyClient');
    }
}

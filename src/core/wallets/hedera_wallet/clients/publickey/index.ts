import { AccountId, Transaction } from '@hashgraph/sdk';
import { BaseHederaWalletClient } from '../../base_client';

/**
 * Read-only Hedera wallet client that can only perform operations that don't require signing
 */
export class PublicKeyClient extends BaseHederaWalletClient {
    constructor(accountId: string | AccountId) {
        super(accountId);
    }

    /**
     * Not supported in public key client - throws error
     */
    async signTransaction(_transaction: Transaction): Promise<Transaction> {
        throw new Error('Cannot sign transactions with a read-only PublicKeyClient');
    }

    /**
     * Not supported in public key client - throws error
     */
    async sendTransaction(_transaction: Transaction): Promise<string> {
        throw new Error('Cannot send transactions with a read-only PublicKeyClient');
    }
}

import { AccountId, PrivateKey } from '@hashgraph/sdk';
import { KeypairClient } from './clients/keypair';
import { PublicKeyClient } from './clients/publickey';
import { HederaWalletClient } from './client';

/**
 * Factory functions for creating Hedera wallet clients
 */
export const HederaWalletFactory = {
    /**
     * Create a KeypairClient from a private key
     * @param privateKey Private key string or PrivateKey object
     * @param accountId Optional account ID (will be derived if not provided)
     * @returns Keypair wallet client instance
     */
    fromPrivateKey(privateKey: string | PrivateKey, accountId?: string | AccountId): KeypairClient {
        return new KeypairClient(privateKey, accountId);
    },

    /**
     * Create a PublicKeyClient from an account ID
     * @param accountId Account ID string or AccountId object
     * @returns PublicKey wallet client for read-only operations
     */
    fromAccountId(accountId: string | AccountId): PublicKeyClient {
        return new PublicKeyClient(accountId);
    },
};

// Type guard to check if a wallet client supports signing
export function canSign(client: HederaWalletClient): boolean {
    // Simply check if the client is a PublicKeyClient
    return !(client instanceof PublicKeyClient);
}

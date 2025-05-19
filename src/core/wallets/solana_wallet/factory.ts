import { PublicKey } from '@solana/web3.js';
import { KeypairClient } from './clients/keypair';
import { PhantomClient, type PhantomProvider } from './clients/phantom';
import { PublicKeyClient } from './clients/publickey';
import { SolanaWalletClient } from './client';

/**
 * Factory functions for creating Solana wallet clients
 */
export const SolanaWalletFactory = {
    /**
     * Create a KeypairClient from a private key
     * @param privateKey Base58-encoded private key string
     * @returns Keypair wallet client instance
     */
    fromPrivateKey(privateKey: string): KeypairClient {
        return new KeypairClient(privateKey);
    },

    /**
     * Create a PublicKeyClient from a public key
     * @param publicKey PublicKey object or base58-encoded string
     * @returns PublicKey wallet client for read-only operations
     */
    fromPublicKey(publicKey: string | PublicKey): PublicKeyClient {
        return new PublicKeyClient(publicKey);
    },

    /**
     * Create a PhantomClient from a Phantom provider
     * @param provider Phantom wallet provider instance
     * @returns Phantom wallet client instance
     */
    fromPhantom(provider: PhantomProvider): PhantomClient {
        return new PhantomClient(provider);
    },
};

// Type guard to check if a wallet client supports signing
export function canSign(client: SolanaWalletClient): boolean {
    // Simply check if the client is a PublicKeyClient
    return !(client instanceof PublicKeyClient);
}

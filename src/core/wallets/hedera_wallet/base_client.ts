import { Client, AccountId, Transaction } from '@hashgraph/sdk';
import { HederaWalletClient } from './client';

/**
 * Base class for Hedera wallet clients with common functionality
 */
export abstract class BaseHederaWalletClient implements HederaWalletClient {
    /**
     * The wallet's account ID
     */
    public readonly accountId: AccountId;

    constructor(accountId: string | AccountId) {
        this.accountId = typeof accountId === 'string' ? AccountId.fromString(accountId) : accountId;
    }

    /**
     * Get account ID as string
     */
    getAddress(): string {
        return this.accountId.toString();
    }

    /**
     * Get Hedera client
     */
    getClient(_network: string = 'testnet'): Client {
        // TODO: Implement client creation based on network
        throw new Error('Method not implemented');
    }

    /**
     * Get account balance in HBAR
     */
    async getBalance(): Promise<number> {
        // TODO: Implement balance retrieval
        throw new Error('Method not implemented');
    }

    /**
     * Get balance of any account
     */
    async getBalanceOfAccount(_accountId: string): Promise<number> {
        // TODO: Implement balance retrieval for any account
        throw new Error('Method not implemented');
    }

    /**
     * Get token balance for a specific token
     */
    async getTokenBalance(_tokenId: string): Promise<number> {
        // TODO: Implement token balance retrieval
        throw new Error('Method not implemented');
    }

    /**
     * Get account information
     */
    async getAccountInfo(): Promise<unknown> {
        // TODO: Implement account info retrieval
        throw new Error('Method not implemented');
    }

    // Abstract methods that must be implemented by derived classes
    abstract signTransaction(transaction: Transaction): Promise<Transaction>;
    abstract sendTransaction(transaction: Transaction): Promise<string>;
    abstract transferHbar(toAccountId: string, amount: number): Promise<string>;
    abstract transferToken(toAccountId: string, tokenId: string, amount: number): Promise<string>;
}

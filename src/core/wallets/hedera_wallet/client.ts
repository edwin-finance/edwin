import { Client, Transaction, AccountId } from '@hashgraph/sdk';

/**
 * Interface for a Hedera wallet client in Edwin
 */
export interface HederaWalletClient {
    /**
     * The wallet's account ID
     */
    readonly accountId: AccountId;

    /**
     * Get a Hedera client instance
     * @param network Optional network (testnet, mainnet, previewnet)
     * @returns Client instance
     */
    getClient(network?: string): Client;

    /**
     * Get the account ID as a string
     * @returns Account ID as string
     */
    getAddress(): string;

    /**
     * Get account balance in HBAR
     * @returns The HBAR balance as a number
     */
    getBalance(): Promise<number>;

    /**
     * Get balance of any account address
     * @param accountId Account ID to check
     * @returns The HBAR balance as a number
     */
    getBalanceOfAccount(accountId: string): Promise<number>;

    /**
     * Get token balance for a specific token
     * @param tokenId Token ID to check balance for
     * @returns The token balance as a number
     */
    getTokenBalance?(tokenId: string): Promise<number>;

    /**
     * Get account information
     * @returns Account information object
     */
    getAccountInfo(): Promise<unknown>;

    /**
     * Sign a transaction
     * @param transaction Transaction to sign
     * @returns Signed transaction
     */
    signTransaction(transaction: Transaction): Promise<Transaction>;

    /**
     * Send a transaction
     * @param transaction Transaction to send
     * @returns Transaction ID
     */
    sendTransaction(transaction: Transaction): Promise<string>;

    /**
     * Transfer HBAR to another account
     * @param toAccountId Recipient account ID
     * @param amount Amount in HBAR
     * @returns Transaction ID
     */
    transferHbar(toAccountId: string, amount: number): Promise<string>;

    /**
     * Transfer tokens to another account
     * @param toAccountId Recipient account ID
     * @param tokenId Token ID to transfer
     * @param amount Amount to transfer
     * @returns Transaction ID
     */
    transferToken(toAccountId: string, tokenId: string, amount: number): Promise<string>;
}

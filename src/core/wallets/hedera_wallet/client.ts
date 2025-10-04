import { Client, Transaction, AccountId, TransactionRecord } from '@hashgraph/sdk';

/**
 * Interface for a Hedera wallet client in Edwin
 */
export interface HederaWalletClient {
    /**
     * Get the Hedera JSON-RPC URL for the specified network
     * @param network Optional network (testnet, mainnet, previewnet)
     * @returns RPC URL string
     */
    getHederaRpcUrl?(network?: string): string;

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
     * Get token balance for any account
     * @param accountId Account ID to check
     * @param tokenId Token ID to check balance for
     * @returns The token balance as a number
     */
    getTokenBalanceOfAccount?(accountId: string, tokenId: string): Promise<number>;

    /**
     * Get token decimals for a specific token
     * @param tokenId Token ID to get decimals for
     * @returns The number of decimals for the token
     */
    getTokenDecimals(tokenId: string): Promise<number>;

    /**
     * Get account information for any account
     * @param accountId Account ID to get information for
     * @returns Account information object
     */
    getAccountInfoForAccount?(accountId: string): Promise<unknown>;

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
     * Send a transaction and return full response with record
     * @param transaction Transaction to send
     * @returns Transaction ID and record
     */
    sendTransactionWithResponse?(
        transaction: Transaction
    ): Promise<{ transactionId: string; record: TransactionRecord }>;
}

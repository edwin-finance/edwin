import { Connection, Commitment, Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

/**
 * Interface for a signing capable Solana wallet client in Edwin
 */
export interface SolanaWalletClient {
    /**
     * The wallet's public key
     */
    readonly publicKey: PublicKey;

    /**
     * Get a Solana connection instance
     * @param customRpcUrl Optional custom RPC URL
     * @param commitment Optional commitment level
     * @returns Connection instance
     */
    getConnection(customRpcUrl?: string, commitment?: Commitment): Connection;

    /**
     * Get the wallet address as a string
     * @returns Wallet address as base58 string
     */
    getAddress(): string;

    /**
     * Get balance of the wallet in SOL or a specific token
     * @param mintAddress Optional token mint address. If not provided, returns SOL balance.
     * @param commitment Optional commitment level
     * @returns The balance as a number
     */
    getBalance(mintAddress?: string, commitment?: Commitment): Promise<number>;

    /**
     * Get balance of any wallet address
     * @param walletAddress Address of the wallet to check
     * @param mintAddress Optional token mint address. If not provided, returns SOL balance.
     * @param commitment Optional commitment level
     * @returns The balance as a number
     */
    getBalanceOfWallet(walletAddress: string, mintAddress?: string, commitment?: Commitment): Promise<number>;

    /**
     * Get token mint address by symbol
     * @param symbol Token symbol to look up
     * @returns Token mint address or null if not found
     */
    getTokenAddress?(symbol: string): Promise<string | null>;

    /**
     * Sign a transaction
     * @param transaction Transaction to sign
     * @returns Signed transaction
     */
    signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>;

    /**
     * Sign multiple transactions
     * @param transactions Transactions to sign
     * @returns Signed transactions
     */
    signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]>;

    /**
     * Sign a message
     * @param message Message to sign as Uint8Array
     * @returns Signature as Uint8Array
     */
    signMessage(message: Uint8Array): Promise<Uint8Array>;

    /**
     * Send a transaction
     * @param connection Solana connection to use
     * @param transaction Transaction to send
     * @param signers Optional additional signers
     * @returns Transaction signature
     */
    sendTransaction(connection: Connection, transaction: Transaction, signers?: Keypair[]): Promise<string>;

    /**
     * Get balance changes for a token from a transaction
     * @param signature Transaction signature
     * @param mint Token mint address
     * @param commitment Optional commitment level
     * @returns The balance change as a number
     */
    getTransactionTokenBalanceChange(signature: string, mint: string, commitment?: Commitment): Promise<number>;
}

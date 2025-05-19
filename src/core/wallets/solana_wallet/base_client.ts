import { Connection, Commitment, PublicKey, LAMPORTS_PER_SOL, Finality } from '@solana/web3.js';
import { TokenListProvider } from '@solana/spl-token-registry';
import { withRetry } from '../../../utils';
import edwinLogger from '../../../utils/logger';
import { SolanaWalletClient } from './client';

const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112';

interface TokenBalance {
    owner?: string;
    mint?: string;
    uiTokenAmount: {
        uiAmount: number | null;
    };
}

/**
 * Base class for Solana wallet clients with common functionality
 */
export abstract class BaseSolanaWalletClient implements SolanaWalletClient {
    /**
     * The wallet's public key
     */
    public readonly publicKey: PublicKey;

    constructor(publicKey: string | PublicKey) {
        this.publicKey = typeof publicKey === 'string' ? new PublicKey(publicKey) : publicKey;
    }

    /**
     * Get wallet address as string
     */
    getAddress(): string {
        return this.publicKey.toBase58();
    }

    /**
     * Get Solana connection
     */
    getConnection(customRpcUrl?: string, commitment: Commitment = 'confirmed'): Connection {
        return new Connection(
            customRpcUrl || process.env.SOLANA_RPC_URL! || 'https://api.mainnet-beta.solana.com',
            commitment
        );
    }

    /**
     * Get token address by symbol
     */
    async getTokenAddress(symbol: string): Promise<string | null> {
        const tokens = await new TokenListProvider().resolve();
        const tokenList = tokens.filterByChainId(101).getList();

        interface TokenInfo {
            symbol: string;
            address: string;
        }

        const token = tokenList.find((t: TokenInfo) => t.symbol.toLowerCase() === symbol.toLowerCase());
        return token ? token.address : null;
    }

    /**
     * Get balance of the current wallet
     */
    async getBalance(mintAddress?: string, commitment: Commitment = 'confirmed'): Promise<number> {
        return this.getBalanceOfWallet(this.getAddress(), mintAddress, commitment);
    }

    /**
     * Get balance of any wallet
     */
    async getBalanceOfWallet(
        walletAddress: string,
        mintAddress?: string,
        commitment: Commitment = 'confirmed'
    ): Promise<number> {
        try {
            const connection = this.getConnection();
            const publicKey = new PublicKey(walletAddress);

            if (!mintAddress || mintAddress === NATIVE_SOL_MINT) {
                // Get SOL balance
                return (await connection.getBalance(publicKey, commitment)) / LAMPORTS_PER_SOL;
            }

            // Get SPL token balance
            const tokenMint = new PublicKey(mintAddress);
            const tokenAccounts = await connection.getTokenAccountsByOwner(publicKey, {
                mint: tokenMint,
            });

            if (tokenAccounts.value.length === 0) {
                return 0;
            }

            const tokenAccount = tokenAccounts.value[0];
            const tokenAccountBalance = await connection.getTokenAccountBalance(tokenAccount.pubkey, commitment);
            return tokenAccountBalance.value.uiAmount || 0;
        } catch (error) {
            edwinLogger.error(`Error getting balance for wallet ${walletAddress}:`, error);
            throw new Error(`Failed to get balance for wallet ${walletAddress}: ${error}`);
        }
    }

    /**
     * Get token balance change from a transaction
     */
    async getTransactionTokenBalanceChange(signature: string, mint: string, commitment: Finality = 'confirmed') {
        let actualOutputAmount: number;
        const connection = this.getConnection();

        // Fetch the parsed transaction details
        const txInfo = await withRetry(
            () =>
                connection.getParsedTransaction(signature, {
                    maxSupportedTransactionVersion: 0,
                    commitment: commitment,
                }),
            'Get parsed transaction'
        );

        if (!txInfo || !txInfo.meta) {
            throw new Error('Could not fetch transaction details');
        }

        // Check if the output mint is SOL
        if (mint === NATIVE_SOL_MINT) {
            const accountKeys = txInfo.transaction.message.accountKeys;
            const walletIndex = accountKeys.findIndex(key => key.pubkey.toString() === this.getAddress());

            if (walletIndex === -1) {
                throw new Error('Wallet not found in transaction account keys');
            }

            // Add fee back to get total SOL from swap
            const preLamports = txInfo.meta.preBalances[walletIndex];
            const postLamports = txInfo.meta.postBalances[walletIndex];
            const fee = txInfo.meta.fee;
            const lamportsReceived = postLamports - preLamports + fee;
            actualOutputAmount = lamportsReceived / LAMPORTS_PER_SOL;
        } else {
            // For SPL tokens, use token balance changes
            const preTokenBalances = txInfo.meta.preTokenBalances || [];
            const postTokenBalances = txInfo.meta.postTokenBalances || [];

            // Find balance entries for this wallet and token
            const findBalance = (balances: TokenBalance[]) =>
                balances.find(
                    balance =>
                        balance.owner && balance.mint && balance.owner === this.getAddress() && balance.mint === mint
                );

            const preBalanceEntry = findBalance(preTokenBalances);
            const postBalanceEntry = findBalance(postTokenBalances);
            const preBalance = preBalanceEntry?.uiTokenAmount.uiAmount ?? 0;
            const postBalance = postBalanceEntry?.uiTokenAmount.uiAmount ?? 0;
            actualOutputAmount = (postBalance || 0) - (preBalance || 0);
        }

        return actualOutputAmount;
    }

    // Abstract methods that must be implemented by derived classes
    abstract signTransaction<
        T extends import('@solana/web3.js').Transaction | import('@solana/web3.js').VersionedTransaction,
    >(transaction: T): Promise<T>;
    abstract signAllTransactions<
        T extends import('@solana/web3.js').Transaction | import('@solana/web3.js').VersionedTransaction,
    >(transactions: T[]): Promise<T[]>;
    abstract signMessage(message: Uint8Array): Promise<Uint8Array>;
    abstract sendTransaction(
        connection: Connection,
        transaction: import('@solana/web3.js').Transaction,
        signers?: import('@solana/web3.js').Keypair[]
    ): Promise<string>;
    abstract waitForConfirmationGracefully(
        connection: Connection,
        signature: string,
        timeout?: number
    ): Promise<{ err: unknown; confirmationStatus?: 'confirmed' | 'finalized' | 'processed' }>;
}

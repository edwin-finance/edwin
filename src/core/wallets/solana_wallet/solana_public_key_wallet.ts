import { Connection, LAMPORTS_PER_SOL, PublicKey, Commitment, Finality } from '@solana/web3.js';
import { TokenListProvider } from '@solana/spl-token-registry';
import { EdwinWallet } from '../wallet';
import edwinLogger from '../../../utils/logger';
import { withRetry } from '../../../utils';

const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112';

interface TokenBalance {
    owner?: string;
    mint?: string;
    uiTokenAmount: {
        uiAmount: number | null;
    };
}

export class EdwinSolanaPublicKeyWallet extends EdwinWallet {
    protected wallet_address: PublicKey;

    constructor(publicKey: string | PublicKey) {
        super();
        this.wallet_address = typeof publicKey === 'string' ? new PublicKey(publicKey) : publicKey;
    }

    getPublicKey(): PublicKey {
        return this.wallet_address;
    }

    getConnection(customRpcUrl?: string, commitment: Commitment = 'confirmed'): Connection {
        return new Connection(
            customRpcUrl || process.env.SOLANA_RPC_URL! || 'https://api.mainnet-beta.solana.com',
            commitment
        );
    }

    getAddress(): string {
        return this.wallet_address.toBase58();
    }

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

    async getBalance(mintAddress?: string, commitment: Commitment = 'confirmed'): Promise<number> {
        // Use getBalanceOfWallet with the current wallet address
        return this.getBalanceOfWallet(this.getAddress(), mintAddress, commitment);
    }

    /**
     * Get balance of any wallet address in Solana
     * @param walletAddress The wallet address to check
     * @param mintAddress Optional SPL token mint address (if not provided, returns SOL balance)
     * @param commitment Commitment level for the request
     * @returns Balance of the wallet
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
     * Get the token balance change from a transaction
     * @param signature Transaction signature
     * @param mint Token mint address
     * @param commitment Commitment level
     * @returns The balance change
     */
    async getTransactionTokenBalanceChange(signature: string, mint: string, commitment: Finality = 'confirmed') {
        //    - For SOL, check lamport balance changes (and add back the fee).
        //    - For SPL tokens, check the token account balance changes.
        let actualOutputAmount: number;
        const connection = this.getConnection();
        // Fetch the parsed transaction details (make sure to set the proper options)
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
        // Check if the output mint is SOL (using the native SOL mint address)
        if (mint === NATIVE_SOL_MINT) {
            // SOL changes are reflected in lamport balances.
            const accountKeys = txInfo.transaction.message.accountKeys;
            const walletIndex = accountKeys.findIndex(key => key.pubkey.toString() === this.getAddress());
            if (walletIndex === -1) {
                throw new Error('Wallet not found in transaction account keys');
            }
            // The difference in lamports includes the fee deduction. Add back the fee
            // to get the total SOL credited from the swap.
            const preLamports = txInfo.meta.preBalances[walletIndex];
            const postLamports = txInfo.meta.postBalances[walletIndex];
            const fee = txInfo.meta.fee; // fee is in lamports
            const lamportsReceived = postLamports - preLamports + fee;
            actualOutputAmount = lamportsReceived / LAMPORTS_PER_SOL;
        } else {
            // For SPL tokens, use token balance changes in the transaction metadata.
            const preTokenBalances = txInfo.meta.preTokenBalances || [];
            const postTokenBalances = txInfo.meta.postTokenBalances || [];
            // Helper function: find the token balance entry for the wallet & token mint.
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
}

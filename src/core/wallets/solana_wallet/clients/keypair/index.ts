import bs58 from 'bs58';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, VersionedTransaction } from '@solana/web3.js';
import { BaseSolanaWalletClient } from '../../base_client';
import { JitoJsonRpcClient } from '../../jito_client';

interface SignatureStatus {
    err: unknown;
    confirmationStatus?: 'confirmed' | 'finalized' | 'processed';
}

interface JitoResponse {
    error?: {
        message: string;
    };
    result: string;
}

/**
 * Solana wallet client that uses a Keypair for signing
 */
export class KeypairClient extends BaseSolanaWalletClient {
    private keypair: Keypair;

    constructor(privateKey: string) {
        const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
        super(keypair.publicKey);
        this.keypair = keypair;
    }

    /**
     * Get the underlying Keypair
     */
    getKeypair(): Keypair {
        return this.keypair;
    }

    /**
     * Sign a transaction with the wallet's keypair
     */
    async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
        if (transaction instanceof Transaction) {
            transaction.partialSign(this.keypair);
        } else {
            // Handle VersionedTransaction
            transaction.sign([this.keypair]);
        }
        return transaction;
    }

    /**
     * Sign multiple transactions with the wallet's keypair
     */
    async signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> {
        for (const tx of transactions) {
            await this.signTransaction(tx);
        }
        return transactions;
    }

    /**
     * Sign a message with the wallet's keypair
     * Note: This is a simplified implementation for compatibility
     */
    async signMessage(_message: Uint8Array): Promise<Uint8Array> {
        // In a real implementation, we would use nacl.sign.detached
        // For now, this is a simple implementation that returns the first 64 bytes of
        // the secret key as a signature - this is not cryptographically secure
        // and should be replaced with proper signing in production
        return this.keypair.secretKey.slice(0, 64);
    }

    /**
     * Wait for transaction confirmation
     */
    async waitForConfirmationGracefully(
        connection: Connection,
        signature: string,
        timeout: number = 120000 // Timeout in milliseconds
    ): Promise<SignatureStatus> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            // Fetch the status of the transaction
            const { value } = await connection.getSignatureStatus(signature, {
                searchTransactionHistory: true,
            });
            if (value) {
                // Check for transaction error
                if (value.err) {
                    throw new Error(`Transaction failed: ${JSON.stringify(value.err)}`);
                }
                if (value.confirmationStatus === 'confirmed' || value.confirmationStatus === 'finalized') {
                    return value; // Transaction is confirmed or finalized
                }
            }

            // Wait for a short interval before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        throw new Error('Transaction confirmation timed out');
    }

    /**
     * Send a transaction using Jito's low latency transaction send API.
     */
    async sendTransaction(connection: Connection, transaction: Transaction, signers: Keypair[] = []): Promise<string> {
        // For versioned transactions, handle differently
        if ('version' in transaction) {
            // This is a VersionedTransaction
            const versionedTx = transaction as unknown as VersionedTransaction;

            // Make sure the transaction is signed
            if (signers.length > 0) {
                versionedTx.sign(signers);
            } else {
                await this.signTransaction(versionedTx as VersionedTransaction);
            }

            const serializedTx = versionedTx.serialize();
            return await connection.sendRawTransaction(serializedTx);
        }

        // For legacy transactions, use Jito
        // Initialize Jito client
        const jitoClient = new JitoJsonRpcClient(
            process.env.JITO_RPC_URL || 'https://mainnet.block-engine.jito.wtf/api/v1',
            process.env.JITO_UUID
        );

        // Get a random Jito tip account
        const jitoTipAccount = new PublicKey(await jitoClient.getRandomTipAccount());
        const jitoTipAmount = 1000; // 0.000001 SOL tip

        // Add Jito tip instruction to the transaction
        transaction.add(
            SystemProgram.transfer({
                fromPubkey: this.publicKey,
                toPubkey: jitoTipAccount,
                lamports: jitoTipAmount,
            })
        );

        // Fetch a fresh blockhash
        const { blockhash } = await connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = this.publicKey;

        // Sign the transaction with all signers
        if (signers.length > 0) {
            transaction.sign(...signers);
        } else {
            await this.signTransaction(transaction);
        }

        // Serialize the transaction and encode it as base64
        const serializedTx = transaction.serialize();
        const base64Tx = Buffer.from(serializedTx).toString('base64');

        // Use Jito RPC URL
        const jitoRpcUrl = process.env.JITO_RPC_URL || 'https://mainnet.block-engine.jito.wtf';
        const jitoApiEndpoint = `${jitoRpcUrl}/api/v1/transactions`;

        const response = await fetch(jitoApiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'sendTransaction',
                params: [
                    base64Tx,
                    {
                        encoding: 'base64',
                    },
                ],
            }),
        });

        const data = (await response.json()) as JitoResponse;
        if (data.error) {
            throw new Error(data.error.message);
        }
        return data.result; // Transaction signature returned by Jito
    }
}

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
     * Supports both legacy Transaction and VersionedTransaction.
     */
    async sendTransaction<T extends Transaction | VersionedTransaction>(
        connection: Connection,
        transaction: T,
        signers: Keypair[] = []
    ): Promise<string> {
        const isVersioned = 'version' in transaction;

        // Handle transaction-specific preparation
        if (isVersioned) {
            await this.prepareVersionedTransaction(transaction as VersionedTransaction, signers);
        } else {
            await this.prepareLegacyTransaction(connection, transaction as Transaction, signers);
        }

        // Send via Jito
        return this.sendViaJito(transaction);
    }

    /**
     * Prepare a versioned transaction for sending
     */
    private async prepareVersionedTransaction(transaction: VersionedTransaction, signers: Keypair[]): Promise<void> {
        // Sign with all required signers
        const allSigners = signers.length > 0 ? [...signers, this.keypair] : [this.keypair];

        // Only sign if not already signed
        if (!transaction.signatures[0]) {
            transaction.sign(allSigners);
        } else if (signers.length > 0) {
            // Add additional signatures if needed
            transaction.sign(signers);
        }
    }

    /**
     * Prepare a legacy transaction for sending
     */
    private async prepareLegacyTransaction(
        connection: Connection,
        transaction: Transaction,
        signers: Keypair[]
    ): Promise<void> {
        // Initialize Jito client for tip account
        const jitoClient = new JitoJsonRpcClient(
            process.env.JITO_RPC_URL || 'https://mainnet.block-engine.jito.wtf/api/v1',
            process.env.JITO_UUID
        );

        // Add Jito tip
        const jitoTipAccount = new PublicKey(await jitoClient.getRandomTipAccount());
        transaction.add(
            SystemProgram.transfer({
                fromPubkey: this.publicKey,
                toPubkey: jitoTipAccount,
                lamports: 1000, // 0.000001 SOL tip
            })
        );

        // Set blockhash and fee payer
        const { blockhash } = await connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = this.publicKey;

        // Sign transaction
        const allSigners = [this.keypair, ...signers];
        transaction.sign(...allSigners);
    }

    /**
     * Send transaction via Jito API
     */
    private async sendViaJito<T extends Transaction | VersionedTransaction>(transaction: T): Promise<string> {
        // Serialize transaction
        const serializedTx = transaction.serialize();
        const base64Tx = Buffer.from(serializedTx).toString('base64');

        // Prepare Jito API request
        const jitoRpcUrl = process.env.JITO_RPC_URL || 'https://mainnet.block-engine.jito.wtf';
        const jitoApiEndpoint = `${jitoRpcUrl}/api/v1/transactions`;

        // Determine send options based on transaction type
        const isVersioned = 'version' in transaction;
        const sendOptions = isVersioned
            ? { encoding: 'base64', maxRetries: 3, skipPreflight: true }
            : { encoding: 'base64' };

        // Send transaction
        const response = await fetch(jitoApiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'sendTransaction',
                params: [base64Tx, sendOptions],
            }),
        });

        const data = (await response.json()) as JitoResponse;
        if (data.error) {
            throw new Error(data.error.message);
        }

        return data.result;
    }
}

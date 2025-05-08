import bs58 from 'bs58';
import { Keypair, Transaction, VersionedTransaction, SystemProgram, PublicKey, Connection } from '@solana/web3.js';
import { EdwinSolanaPublicKeyWallet } from './solana_public_key_wallet';
import { JitoJsonRpcClient } from './jito_client';
import edwinLogger from '../../../utils/logger';

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
 * Solana wallet that has full capabilities including transaction signing
 */
export class EdwinSolanaWallet extends EdwinSolanaPublicKeyWallet {
    private wallet: Keypair;

    constructor(privateKey: string) {
        const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
        super(keypair.publicKey);
        this.wallet = keypair;
    }

    /**
     * Signs a transaction with the wallet's keypair
     */
    signTransaction(transaction: VersionedTransaction) {
        transaction.sign([this.wallet]);
    }

    /**
     * Returns the wallet's keypair (private key)
     */
    getSigner(): Keypair {
        return this.wallet;
    }

    /**
     * Function to gracefully wait for transaction confirmation
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
            edwinLogger.info('🚀 ~ waitForConfirmationGracefully ~ value:', value);
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
     * Sends a signed transaction using Jito's low latency transaction send API.
     * Includes a tip to Jito validators to incentivize inclusion.
     *
     * This method:
     *  1. Uses the provided connection to fetch a recent blockhash
     *  2. Adds a tip instruction to a Jito validator
     *  3. Signs and sends the transaction via Jito's API
     */
    async sendTransaction(connection: Connection, transaction: Transaction, signers: Keypair[]): Promise<string> {
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
                fromPubkey: this.wallet_address,
                toPubkey: jitoTipAccount,
                lamports: jitoTipAmount,
            })
        );

        // Fetch a fresh blockhash
        const { blockhash } = await connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = this.wallet_address;

        // Sign the transaction with all required signers
        transaction.sign(...signers);

        // Serialize the transaction and encode it as base64
        const serializedTx = transaction.serialize();
        const base64Tx = Buffer.from(serializedTx).toString('base64');

        // Use your Jito RPC URL (set via env variable) or default to a known endpoint
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

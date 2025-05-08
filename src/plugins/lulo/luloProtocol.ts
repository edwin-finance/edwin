import { VersionedTransaction } from '@solana/web3.js';
import { SupportedChain } from '../../core/types';
import { SupplyParameters, WithdrawParameters } from './parameters';

import { EdwinSolanaPublicKeyWallet, EdwinSolanaWallet } from '../../core/wallets/solana_wallet';
import edwinLogger from '../../utils/logger';

interface LuloDepositResponse {
    data: {
        transactionMeta: Array<{
            transaction: string;
        }>;
    };
}

interface LuloWithdrawResponse {
    signature: string;
}

export class LuloProtocol {
    public supportedChains: SupportedChain[] = ['solana'];
    private wallet: EdwinSolanaPublicKeyWallet;

    constructor(wallet: EdwinSolanaPublicKeyWallet) {
        this.wallet = wallet;
    }

    async getPortfolio(): Promise<string> {
        return '';
    }

    async supply(params: SupplyParameters): Promise<string> {
        try {
            // Check if wallet has signing capability
            if (!(this.wallet instanceof EdwinSolanaWallet)) {
                throw new Error('Supply operation requires a wallet with signing capabilities');
            }

            if (!process.env.FLEXLEND_API_KEY) {
                throw new Error('FLEXLEND_API_KEY is not set (For lulo.fi)');
            }

            if (!params.amount) {
                throw new Error('Amount is required');
            }

            const response = await fetch(`https://api.flexlend.fi/generate/account/deposit?priorityFee=50000`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-wallet-pubkey': this.wallet.getPublicKey().toBase58(),
                    'x-api-key': process.env.FLEXLEND_API_KEY!,
                },
                body: JSON.stringify({
                    owner: this.wallet.getPublicKey().toBase58(),
                    mintAddress: params.asset, // This should be the mint address of the asset
                    depositAmount: params.amount.toString(),
                }),
            });
            edwinLogger.info(response);
            const responseData = (await response.json()) as LuloDepositResponse;

            const transactionMeta = responseData.data.transactionMeta;

            // Deserialize the transaction
            const luloTxn = VersionedTransaction.deserialize(Buffer.from(transactionMeta[0].transaction, 'base64'));

            // Get a recent blockhash and set it
            const connection = this.wallet.getConnection();
            const { blockhash } = await connection.getLatestBlockhash();
            luloTxn.message.recentBlockhash = blockhash;

            // Sign and send transaction
            this.wallet.signTransaction(luloTxn);

            const signature = await connection.sendTransaction(luloTxn, {
                preflightCommitment: 'confirmed',
                maxRetries: 3,
            });

            // Wait for confirmation using the latest strategy
            const latestBlockhash = await connection.getLatestBlockhash();
            await connection.confirmTransaction({
                signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            });

            return (
                'Successfully supplied ' +
                params.amount +
                ' ' +
                params.asset +
                ' to Lulo.fi, transaction signature: ' +
                signature
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new Error(`Lulo supply failed: ${errorMessage}`);
        }
    }

    async withdraw(params: WithdrawParameters): Promise<string> {
        try {
            // Check if wallet has signing capability
            if (!(this.wallet instanceof EdwinSolanaWallet)) {
                throw new Error('Withdraw operation requires a wallet with signing capabilities');
            }

            const response = await fetch(
                `https://blink.lulo.fi/actions/withdraw?amount=${params.amount}&symbol=${params.asset}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        account: this.wallet.getPublicKey().toBase58(),
                    }),
                }
            );

            const data = (await response.json()) as LuloWithdrawResponse;

            return (
                'Successfully withdrew ' +
                params.amount +
                ' ' +
                params.asset +
                ' from Lulo.fi, transaction signature: ' +
                data.signature
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new Error(`Lulo withdraw failed: ${errorMessage}`);
        }
    }
}

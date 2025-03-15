import { Pool, EthereumTransactionTypeExtended } from '@aave/contract-helpers';
import { AaveV3Base } from '@bgd-labs/aave-address-book';
import { ethers, providers } from 'ethers';
import { EdwinEVMWallet } from '../../core/wallets/evm_wallet/evm_wallet';
import { type SupportedChain, type SupportedEVMChain } from '../../core/types';
import edwinLogger from '../../utils/logger';
import { SupplyParameters, WithdrawParameters } from './parameters';
import { EdwinService } from '../../core/classes/edwinToolProvider';

interface AaveError extends Error {
    code?: string;
    error?: {
        body?: string;
    };
    reason?: string;
}

export class AaveService extends EdwinService {
    public supportedChains: SupportedChain[] = ['base'];
    private wallet: EdwinEVMWallet;

    constructor(wallet: EdwinEVMWallet) {
        super();
        this.wallet = wallet;
    }

    async getPortfolio(): Promise<string> {
        return '';
    }

    private getAaveChain(chain: SupportedChain): SupportedEVMChain {
        if (!this.supportedChains.includes(chain)) {
            throw new Error(`Chain ${chain} is not supported by Aave protocol`);
        }
        return chain as SupportedEVMChain;
    }

    private async submitTransaction(
        provider: providers.Provider,
        wallet: ethers.Wallet,
        tx: EthereumTransactionTypeExtended
    ): Promise<ethers.providers.TransactionResponse> {
        try {
            const extendedTxData = await tx.tx();
            const { from, ...txData } = extendedTxData;
            return await wallet.sendTransaction(txData);
        } catch (error) {
            // Check if error contains gas estimation error details
            const aaveError = error as AaveError;
            if (aaveError.code === 'UNPREDICTABLE_GAS_LIMIT') {
                const reason = aaveError.error?.body
                    ? JSON.parse(aaveError.error.body).error.message
                    : aaveError.reason;
                throw new Error(`Transaction failed: ${reason}`);
            }
            throw error;
        }
    }

    async supply(params: SupplyParameters): Promise<string> {
        const { chain, amount, asset } = params;
        edwinLogger.info(`Calling the inner AAVE logic to supply ${amount} ${asset}`);
        if (!asset) {
            throw new Error('Asset is required');
        }
        if (!amount) {
            throw new Error('Amount is required');
        }
        try {
            const aaveChain = this.getAaveChain(chain as SupportedChain);
            this.wallet.switchChain(aaveChain);
            const walletClient = this.wallet.getWalletClient(aaveChain);
            const provider = new providers.JsonRpcProvider(walletClient.transport.url);

            const ethers_wallet = this.wallet.getEthersWallet(walletClient, provider);
            ethers_wallet.connect(provider);

            const pool = new Pool(ethers_wallet.provider, {
                POOL: AaveV3Base.POOL,
                WETH_GATEWAY: AaveV3Base.WETH_GATEWAY,
            });
            // Get the reserve address for the input asset
            const assetKey = Object.keys(AaveV3Base.ASSETS).find(key => key.toLowerCase() === asset.toLowerCase());

            if (!assetKey) {
                throw new Error(`Unsupported asset: ${asset}`);
            }
            // check assetKey is in ASSETS
            if (!AaveV3Base.ASSETS[assetKey as keyof typeof AaveV3Base.ASSETS]) {
                throw new Error(`Unsupported asset: ${asset}`);
            }
            const reserve = AaveV3Base.ASSETS[assetKey as keyof typeof AaveV3Base.ASSETS].UNDERLYING;

            if (!reserve) {
                throw new Error(`Unsupported asset: ${asset}`);
            }
            // Prepare supply parameters
            const supplyParams = {
                user: walletClient.account?.address as string,
                reserve: reserve, // The address of the reserve
                amount: String(amount),
            };

            // Get supply transaction
            const txs = await pool.supply(supplyParams);

            // Submit the transactions
            if (txs && txs.length > 0) {
                edwinLogger.info(`Submitting supply transactions`);
                const results = [];
                for (const tx of txs) {
                    const result = await this.submitTransaction(ethers_wallet.provider, ethers_wallet, tx);
                    results.push(result);
                }
                // Return the last transaction
                const finalTx = results[results.length - 1];
                return (
                    'Successfully supplied ' +
                    params.amount +
                    ' ' +
                    params.asset +
                    ' to Aave, transaction signature: ' +
                    finalTx.hash
                );
            } else {
                throw new Error('No transaction generated from Aave Pool');
            }
        } catch (error: unknown) {
            edwinLogger.error('Aave supply error:', error);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Aave supply failed: ${message}`);
        }
    }

    async withdraw(params: WithdrawParameters): Promise<string> {
        const { chain, amount, asset } = params;
        edwinLogger.info(`Calling the inner AAVE logic to withdraw ${amount} ${asset}`);
        if (!asset) {
            throw new Error('Asset is required');
        }
        if (!amount) {
            throw new Error('Amount is required');
        }
        try {
            const aaveChain = this.getAaveChain(chain as SupportedChain);
            this.wallet.switchChain(aaveChain);
            const walletClient = this.wallet.getWalletClient(aaveChain);
            const provider = new providers.JsonRpcProvider(walletClient.transport.url);
            const ethers_wallet = this.wallet.getEthersWallet(walletClient, provider);
            ethers_wallet.connect(provider);

            const pool = new Pool(ethers_wallet.provider, {
                POOL: AaveV3Base.POOL,
                WETH_GATEWAY: AaveV3Base.WETH_GATEWAY,
            });
            const assetKey = Object.keys(AaveV3Base.ASSETS).find(key => key.toLowerCase() === asset.toLowerCase());
            if (!assetKey) {
                throw new Error(`Unsupported asset: ${asset}`);
            }
            if (!AaveV3Base.ASSETS[assetKey as keyof typeof AaveV3Base.ASSETS]) {
                throw new Error(`Unsupported asset: ${asset}`);
            }
            const reserve = AaveV3Base.ASSETS[assetKey as keyof typeof AaveV3Base.ASSETS].UNDERLYING;
            if (!reserve) {
                throw new Error(`Unsupported asset: ${asset}`);
            }

            const withdrawParams = {
                user: walletClient.account?.address as string,
                reserve: reserve,
                amount: String(amount),
            };
            const txs = await pool.withdraw(withdrawParams);

            if (txs && txs.length > 0) {
                const results = [];
                for (const tx of txs) {
                    const result = await this.submitTransaction(ethers_wallet.provider, ethers_wallet, tx);
                    results.push(result);
                }
                const finalTx = results[results.length - 1];
                return (
                    'Successfully withdrew ' +
                    params.amount +
                    ' ' +
                    params.asset +
                    ' from Aave, transaction signature: ' +
                    finalTx.hash
                );
            } else {
                throw new Error('No transaction generated from Aave Pool');
            }
        } catch (error: unknown) {
            edwinLogger.error('Aave withdraw error:', error);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Aave withdraw failed: ${message}`);
        }
    }
}

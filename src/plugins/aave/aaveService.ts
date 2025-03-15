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

interface PoolSetup {
    pool: Pool;
    wallet: ethers.Wallet;
    provider: providers.Provider;
    userAddress: string;
    reserveAddress: string;
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

    /**
     * Set up the Aave pool and necessary wallet connections
     */
    private async setupPool(chain: SupportedChain, asset: string): Promise<PoolSetup> {
        // Get the chain and switch wallet
        const aaveChain = this.getAaveChain(chain);
        this.wallet.switchChain(aaveChain);

        // Setup wallet client and provider
        const walletClient = this.wallet.getWalletClient(aaveChain);
        const provider = new providers.JsonRpcProvider(walletClient.transport.url);
        const ethers_wallet = this.wallet.getEthersWallet(walletClient, provider);
        ethers_wallet.connect(provider);

        // Create Aave Pool
        const pool = new Pool(ethers_wallet.provider, {
            POOL: AaveV3Base.POOL,
            WETH_GATEWAY: AaveV3Base.WETH_GATEWAY,
        });

        // Resolve asset address
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

        // Return all necessary objects
        return {
            pool,
            wallet: ethers_wallet,
            provider: ethers_wallet.provider,
            userAddress: walletClient.account?.address as string,
            reserveAddress: reserve,
        };
    }

    /**
     * Execute transactions and handle results
     */
    private async executeTransactions(
        txs: EthereumTransactionTypeExtended[],
        setup: PoolSetup,
        actionType: 'supply' | 'withdraw',
        amount: number,
        asset: string
    ): Promise<string> {
        if (!txs || txs.length === 0) {
            throw new Error(`No transaction generated from Aave Pool for ${actionType}`);
        }

        edwinLogger.info(`Submitting ${actionType} transactions`);
        const results = [];

        for (const tx of txs) {
            const result = await this.submitTransaction(setup.provider, setup.wallet, tx);
            results.push(result);
        }

        // Return the last transaction
        const finalTx = results[results.length - 1];
        return (
            `Successfully ${actionType === 'supply' ? 'supplied' : 'withdrew'} ` +
            amount +
            ' ' +
            asset +
            ` ${actionType === 'supply' ? 'to' : 'from'} Aave, transaction signature: ` +
            finalTx.hash
        );
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

        // Validate required parameters
        if (!asset) throw new Error('Asset is required');
        if (!amount) throw new Error('Amount is required');

        try {
            // Setup pool and connections
            const setup = await this.setupPool(chain as SupportedChain, asset);

            // Prepare supply parameters
            const supplyParams = {
                user: setup.userAddress,
                reserve: setup.reserveAddress,
                amount: String(amount),
            };

            // Get supply transaction
            const txs = await setup.pool.supply(supplyParams);

            // Execute transactions
            return await this.executeTransactions(txs, setup, 'supply', amount, asset);
        } catch (error: unknown) {
            edwinLogger.error('Aave supply error:', error);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Aave supply failed: ${message}`);
        }
    }

    async withdraw(params: WithdrawParameters): Promise<string> {
        const { chain, amount, asset } = params;

        // Validate required parameters
        if (!asset) throw new Error('Asset is required');
        if (!amount) throw new Error('Amount is required');

        try {
            // Setup pool and connections
            const setup = await this.setupPool(chain as SupportedChain, asset);

            // Prepare withdraw parameters
            const withdrawParams = {
                user: setup.userAddress,
                reserve: setup.reserveAddress,
                amount: String(amount),
            };

            // Get withdraw transaction
            const txs = await setup.pool.withdraw(withdrawParams);

            // Execute transactions
            return await this.executeTransactions(txs, setup, 'withdraw', amount, asset);
        } catch (error: unknown) {
            edwinLogger.error('Aave withdraw error:', error);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Aave withdraw failed: ${message}`);
        }
    }
}

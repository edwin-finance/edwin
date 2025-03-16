import { Pool, EthereumTransactionTypeExtended } from '@aave/contract-helpers';
import {
    AaveV3Base,
    AaveV3Ethereum,
    AaveV3Polygon,
    AaveV3Sepolia,
    AaveV3Arbitrum,
    AaveV3BNB,
} from '@bgd-labs/aave-address-book';
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

// Define an interface with only the properties we need
interface AaveAddressBook {
    POOL: string;
    WETH_GATEWAY: string;
    ASSETS: {
        [key: string]: {
            UNDERLYING: string;
        };
    };
}

export class AaveService extends EdwinService {
    public supportedChains: SupportedChain[] = ['base', 'baseSepolia'];
    private wallet: EdwinEVMWallet;

    constructor(wallet: EdwinEVMWallet) {
        super();
        this.wallet = wallet;
    }

    async getPortfolio(): Promise<string> {
        return '';
    }

    private getAaveChain(chain: string): SupportedEVMChain {
        if (!this.supportedChains.map(c => c.toLowerCase()).includes((chain as SupportedChain).toLowerCase())) {
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
        const addressBook = this.getAddressBook(aaveChain);

        const pool = new Pool(ethers_wallet.provider, {
            POOL: addressBook.POOL,
            WETH_GATEWAY: addressBook.WETH_GATEWAY,
        });

        // Resolve asset address
        const assetKey = Object.keys(addressBook.ASSETS).find(key => key.toLowerCase() === asset.toLowerCase());
        if (!assetKey) {
            throw new Error(`Unsupported asset: ${asset}`);
        }
        if (!addressBook.ASSETS[assetKey as keyof typeof addressBook.ASSETS]) {
            throw new Error(`Unsupported asset: ${asset}`);
        }
        const reserve = addressBook.ASSETS[assetKey as keyof typeof addressBook.ASSETS].UNDERLYING;
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
        const txReceipts = [];

        for (const tx of txs) {
            const receipt = await this.submitTransaction(setup.provider, setup.wallet, tx);
            txReceipts.push(receipt);
        }


        // Return the last transaction
        const finalTx = txReceipts[txReceipts.length - 1];
        return (
            `Successfully ${actionType === 'supply' ? 'supplied' : 'withdrew'} ` +
            amount +
            ' ' +
            asset +
            ` ${actionType === 'supply' ? 'to' : 'from'} Aave, transaction signature: ` +
            finalTx.transactionHash
        );
    }

    private getAddressBook(chain: SupportedEVMChain): AaveAddressBook {
        switch (chain.toLowerCase()) {
            case 'base':
                return AaveV3Base;
            case 'basesepolia':
                return AaveV3Sepolia;
            case 'ethereum':
                return AaveV3Ethereum;
            case 'sepolia':
                return AaveV3Sepolia;
            case 'polygon':
                return AaveV3Polygon;
            case 'arbitrum':
                return AaveV3Arbitrum;
            case 'bnb':
                return AaveV3BNB;
            default:
                throw new Error(`No Aave address book available for chain: ${chain}`);
        }
    }

    private async submitTransaction(
        provider: providers.Provider,
        wallet: ethers.Wallet,
        tx: EthereumTransactionTypeExtended
    ): Promise<ethers.providers.TransactionReceipt> {
        try {
            const extendedTxData = await tx.tx();
            const { from, ...txData } = extendedTxData;
            const txResponse = await wallet.sendTransaction(txData);
            const receipt = await txResponse.wait();
            return receipt;
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

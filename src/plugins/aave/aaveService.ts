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
            edwinLogger.info(`Switched to chain: ${chain}`);
            const walletClient = this.wallet.getWalletClient(aaveChain);
            edwinLogger.info(`Got wallet client for chain: ${chain}`);

            // Log the RPC URL from the transport
            edwinLogger.info(`Transport RPC URL: ${walletClient.transport.url}`);
            const provider = new providers.JsonRpcProvider(walletClient.transport.url);
            edwinLogger.info(`Created ethers provider`);

            const ethers_wallet = this.wallet.getEthersWallet(walletClient, provider);
            ethers_wallet.connect(provider);
            edwinLogger.info(`Created ethers wallet`);

            // Get the address book for the current chain
            const addressBook = this.getAddressBook(aaveChain);

            const pool = new Pool(ethers_wallet.provider, {
                POOL: addressBook.POOL,
                WETH_GATEWAY: addressBook.WETH_GATEWAY,
            });
            edwinLogger.info(`Initialized Aave Pool with contract: ${addressBook.POOL}`);

            // Get the reserve address for the input asset
            const assetKey = Object.keys(addressBook.ASSETS).find(key => key.toLowerCase() === asset.toLowerCase());

            if (!assetKey) {
                throw new Error(`Unsupported asset: ${asset}`);
            }
            // check assetKey is in ASSETS
            if (!addressBook.ASSETS[assetKey as keyof typeof addressBook.ASSETS]) {
                throw new Error(`Unsupported asset: ${asset}`);
            }
            const reserve = addressBook.ASSETS[assetKey as keyof typeof addressBook.ASSETS].UNDERLYING;

            if (!reserve) {
                throw new Error(`Unsupported asset: ${asset}`);
            }

            edwinLogger.info(`Reserve: ${reserve}`);
            // Prepare supply parameters
            const supplyParams = {
                user: walletClient.account?.address as string,
                reserve: reserve, // The address of the reserve
                amount: String(amount),
            };

            edwinLogger.info(`Prepared supply params:`, supplyParams);

            // Get supply transaction
            const txs = await pool.supply(supplyParams);

            edwinLogger.info(`Generated ${txs.length} supply transaction(s)`);

            // Send some example read transaction to assert the provider and the connection
            const balance = await provider.getBalance(walletClient.account?.address as string);
            edwinLogger.info(`Balance: ${balance}`);

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
            edwinLogger.info(`Switched to chain: ${chain}`);
            const walletClient = this.wallet.getWalletClient(aaveChain);
            edwinLogger.info(`Got wallet client for chain: ${chain}`);

            const provider = new providers.JsonRpcProvider(walletClient.transport.url);
            edwinLogger.info(`Created ethers provider`);

            const ethers_wallet = this.wallet.getEthersWallet(walletClient, provider);
            ethers_wallet.connect(provider);
            edwinLogger.info(`Created ethers wallet`);

            // Get the address book for the current chain
            const addressBook = this.getAddressBook(aaveChain);

            const pool = new Pool(ethers_wallet.provider, {
                POOL: addressBook.POOL,
                WETH_GATEWAY: addressBook.WETH_GATEWAY,
            });
            edwinLogger.info(`Initialized Aave Pool with contract: ${addressBook.POOL}`);

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
            edwinLogger.info(`Reserve: ${reserve}`);

            const withdrawParams = {
                user: walletClient.account?.address as string,
                reserve: reserve,
                amount: String(amount),
            };
            edwinLogger.info(`Prepared withdraw params:`, withdrawParams);

            const txs = await pool.withdraw(withdrawParams);
            edwinLogger.info(`Generated ${txs.length} withdraw transaction(s)`);

            if (txs && txs.length > 0) {
                edwinLogger.info(`Submitting withdraw transactions`);
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

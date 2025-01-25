import { Pool, EthereumTransactionTypeExtended } from "@aave/contract-helpers";
import { AaveV3Base } from "@bgd-labs/aave-address-book";
import { ethers, providers } from "ethers";
import { EdwinEVMWallet } from "../../edwin-core/providers/evm_wallet";
import {
    type ILendingProtocol,
    type SupplyParams,
    type WithdrawParams,
    type Transaction,
    type SupportedChain,
    type SupportedEVMChain,
} from "../../types";

export class AaveProtocol implements ILendingProtocol {
    public supportedChains: SupportedChain[] = ["base"];

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
        } catch (error: any) {
            // Check if error contains gas estimation error details
            if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
                const reason = error.error?.body ? JSON.parse(error.error.body).error.message : error.reason;
                throw new Error(`Transaction failed: ${reason}`);
            }
            throw error;
        }
    }

    async supply(params: SupplyParams, walletProvider: EdwinEVMWallet): Promise<Transaction> {
        const { chain, amount, asset, data } = params;
        console.log(
            `Calling the inner AAVE logic to supply ${amount} ${asset}`
        );

        try {
            const aaveChain = this.getAaveChain(chain);      
            walletProvider.switchChain(aaveChain);
            console.log(`Switched to chain: ${chain}`);
            const walletClient = walletProvider.getWalletClient(aaveChain);
            console.log(`Got wallet client for chain: ${chain}`);

            // Log the RPC URL from the transport
            console.log(`Transport RPC URL: ${walletClient.transport.url}`);
            const provider = new providers.JsonRpcProvider(walletClient.transport.url);
            console.log(`Created ethers provider`);

            const ethers_wallet = walletProvider.getEthersWallet(walletClient, provider);
            ethers_wallet.connect(provider);
            console.log(`Created ethers wallet`);

            const pool = new Pool(ethers_wallet.provider, {
                POOL: AaveV3Base.POOL,
                WETH_GATEWAY: AaveV3Base.WETH_GATEWAY,
            });
            // todo extend to more chains
            console.log(
                `Initialized Aave Pool with contract: ${AaveV3Base.POOL}`
            );

            // Get the reserve address for the input asset
            const assetKey = Object.keys(AaveV3Base.ASSETS).find(
                (key) => key.toLowerCase() === asset.toLowerCase()
            );

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

            console.log(`Reserve: ${reserve}`);
            // Prepare supply parameters
            const supplyParams = {
                user: walletClient.account?.address as string,
                reserve: reserve, // The address of the reserve
                amount: amount,
            };

            console.log(`Prepared supply params:`, supplyParams);

            // Get supply transaction
            const txs = await pool.supply(supplyParams);

            console.log(`Generated ${txs.length} supply transaction(s)`);

            // Send some example read transaction to assert the provider and the connection
            const balance = await provider.getBalance(
                walletClient.account?.address as string
            );
            console.log(`Balance: ${balance}`);

            // Submit the transactions
            if (txs && txs.length > 0) {
                console.log(`Submitting supply transactions`);
                const results = [];
                for (const tx of txs) {
                    const result = await this.submitTransaction(
                        ethers_wallet.provider,
                        ethers_wallet,
                        tx
                    );
                    results.push(result);
                }
                // Return the last transaction
                const finalTx = results[results.length - 1];
                return {
                    hash: finalTx.hash as `0x${string}`,
                    from: finalTx.from as `0x${string}`,
                    to: finalTx.to as `0x${string}`,
                    value: Number(amount),
                };
            }
            else {
                throw new Error("No transaction generated from Aave Pool");
            }
        } catch (error: unknown) {
            console.error("Aave supply error:", error);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Aave supply failed: ${message}`);
        }
    }

    async withdraw(params: WithdrawParams, walletProvider: EdwinEVMWallet): Promise<Transaction> {
        const { amount, asset } = params;
        console.log(
            `Calling the inner AAVE logic to withdraw ${amount} ${asset}`
        );
        try {
            throw new Error("Not implemented");
        } catch (error: unknown) {
            console.error("Aave withdraw error:", error);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Aave withdraw failed: ${message}`);
        }
    }
}
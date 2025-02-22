import { createPublicClient, createWalletClient, formatUnits, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { Address, WalletClient, PublicClient, Chain, HttpTransport, Account, PrivateKeyAccount } from 'viem';
import * as viemChains from 'viem/chains';
import type { SupportedEVMChain } from '../../types';
import { EdwinWallet } from '../wallet';
import { ethers, providers } from 'ethers';
import edwinLogger from '../../../utils/logger';

export const _SupportedEVMChainList = Object.keys(viemChains) as Array<keyof typeof viemChains>;

export class EdwinEVMWallet extends EdwinWallet {
    private currentChain: SupportedEVMChain = 'mainnet';
    public chains: Record<string, Chain> = { ...viemChains };
    private account: PrivateKeyAccount;
    private evmPrivateKey: `0x${string}`;

    constructor(privateKey: `0x${string}`) {
        super();
        this.account = privateKeyToAccount(privateKey);
        this.evmPrivateKey = privateKey;
    }

    getAddress(): Address {
        return this.account.address;
    }

    getCurrentChain(): Chain {
        return this.chains[this.currentChain];
    }

    getPublicClient(chainName: SupportedEVMChain): PublicClient<HttpTransport, Chain, Account | undefined> {
        const transport = this.createHttpTransport(chainName);

        const publicClient = createPublicClient({
            chain: this.chains[chainName],
            transport,
        });
        return publicClient;
    }

    getWalletClient(chainName: SupportedEVMChain): WalletClient {
        const transport = this.createHttpTransport(chainName);

        const walletClient = createWalletClient({
            chain: this.chains[chainName],
            transport,
            account: this.account,
        });

        return walletClient;
    }

    getEthersWallet(walletClient: WalletClient, provider: providers.JsonRpcProvider): ethers.Wallet {
        const ethers_wallet = new ethers.Wallet(this.evmPrivateKey, provider);
        return ethers_wallet;
    }
    getChainConfigs(chainName: SupportedEVMChain): Chain {
        const chain = viemChains[chainName];

        if (!chain?.id) {
            throw new Error('Invalid chain name');
        }

        return chain;
    }

    async getBalance(): Promise<number> {
        const client = this.getPublicClient(this.currentChain);
        if (!this.account.address) {
            throw new Error('Account not set');
        }
        // Get ETH balance
        const balance = await client.getBalance({ address: this.account.address });
        const balanceFormatted = formatUnits(balance, 18);
        const balanceNumber = Number(balanceFormatted);
        return balanceNumber;
    }

    async getWalletBalanceForChain(chainName: SupportedEVMChain): Promise<string | null> {
        try {
            const client = this.getPublicClient(chainName);
            if (!this.account.address) {
                throw new Error('Account not set');
            }
            const balance = await client.getBalance({
                address: this.account.address,
            });
            return formatUnits(balance, 18);
        } catch (error) {
            edwinLogger.error('Error getting wallet balance:', error);
            return null;
        }
    }

    addChain(chain: Record<string, Chain>) {
        this.setChains(chain);
    }

    switchChain(chainName: SupportedEVMChain, customRpcUrl?: string) {
        if (!this.chains[chainName]) {
            const chain = EdwinEVMWallet.genChainFromName(chainName, customRpcUrl);
            this.addChain({ [chainName]: chain });
        }
        this.setCurrentChain(chainName);
    }

    private setAccount = (privateKey: `0x${string}`) => {
        this.account = privateKeyToAccount(privateKey);
    };

    private setChains = (chains?: Record<string, Chain>) => {
        if (!chains) {
            return;
        }
        Object.keys(chains).forEach((chain: string) => {
            this.chains[chain] = chains[chain];
        });
    };

    private setCurrentChain = (chain: SupportedEVMChain) => {
        this.currentChain = chain;
    };

    private createHttpTransport = (chainName: SupportedEVMChain) => {
        const chain = this.chains[chainName];

        if (chain.rpcUrls.custom) {
            return http(chain.rpcUrls.custom.http[0]);
        }
        return http(chain.rpcUrls.default.http[0]);
    };

    static genChainFromName(chainName: string, customRpcUrl?: string | null): Chain {
        const baseChain = viemChains[chainName as keyof typeof viemChains];

        if (!baseChain?.id) {
            throw new Error('Invalid chain name');
        }

        const viemChain: Chain = customRpcUrl
            ? {
                  ...baseChain,
                  rpcUrls: {
                      ...baseChain.rpcUrls,
                      custom: {
                          http: [customRpcUrl],
                      },
                  },
              }
            : baseChain;

        return viemChain;
    }
}

import { createPublicClient, createWalletClient, formatUnits, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { Address, WalletClient, PublicClient, Chain, HttpTransport, Account, PrivateKeyAccount } from 'viem';
import * as viemChains from 'viem/chains';
import type { SupportedEVMChain } from '../../types';
import { EdwinWallet } from '../wallet';
import { ethers, providers } from 'ethers';
import edwinLogger from '../../../utils/logger';

// Minimal ERC-20 ABI for balanceOf function
const erc20Abi = [
    {
        name: 'balanceOf',
        type: 'function',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ name: 'balance', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        name: 'decimals',
        type: 'function',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }],
        stateMutability: 'view',
    },
];

// Special address for representing native ETH
const NATIVE_ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

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
        // Use getBalanceOfWallet with the current wallet address
        return this.getBalanceOfWallet(this.getAddress(), this.currentChain);
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

        if (!customRpcUrl) {
            return baseChain;
        }

        // Create custom RPC configuration
        const customRpc: { http: string[]; webSocket?: string[] } = {
            http: [customRpcUrl],
        };

        // Only add webSocket if it exists in the original chain
        if ('webSocket' in baseChain.rpcUrls.default) {
            customRpc.webSocket = [...baseChain.rpcUrls.default.webSocket];
        }

        // Create a new chain object with the custom RPC URL
        return {
            ...baseChain,
            rpcUrls: {
                ...baseChain.rpcUrls,
                custom: customRpc,
            },
        };
    }

    /**
     * Get token balance for a specific token address on a given chain
     * @param chainName The chain name (e.g., 'base', 'mainnet')
     * @param tokenAddress The token contract address or symbol
     * @returns Formatted token balance as a string
     */
    async getTokenBalance(chainName: SupportedEVMChain, tokenAddress: `0x${string}`): Promise<string> {
        try {
            // Use getBalanceOfWallet and convert the result to string
            const balance = await this.getBalanceOfWallet(this.getAddress(), chainName, tokenAddress);
            return balance.toString();
        } catch (error) {
            edwinLogger.error('Error getting token balance:', error);
            throw error;
        }
    }

    /**
     * Get balance of any wallet address on any EVM chain
     * @param walletAddress The wallet address to check
     * @param chainName The chain to query (e.g., 'mainnet', 'base', etc)
     * @param tokenAddress Optional ERC20 token address (if not provided, returns native token balance)
     * @returns Balance of the wallet
     */
    async getBalanceOfWallet(
        walletAddress: Address,
        chainName: SupportedEVMChain = this.currentChain,
        tokenAddress?: `0x${string}`
    ): Promise<number> {
        try {
            const client = this.getPublicClient(chainName);

            if (!tokenAddress || tokenAddress === NATIVE_ETH_ADDRESS) {
                // Get native token balance
                const balance = await client.getBalance({ address: walletAddress });
                return Number(formatUnits(balance, 18));
            }

            // Get ERC20 token balance
            let decimals = 18; // Default to 18 if we can't get decimals
            try {
                decimals = (await client.readContract({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'decimals',
                })) as number;
            } catch (error) {
                edwinLogger.warn(`Could not get decimals for token ${tokenAddress}, defaulting to 18. Error: ${error}`);
            }

            const balance = await client.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [walletAddress],
            });

            if (typeof balance !== 'bigint') {
                throw new Error(`Invalid balance returned from contract. Expected bigint, got ${typeof balance}`);
            }

            return Number(formatUnits(balance as bigint, decimals));
        } catch (error) {
            edwinLogger.error(`Error getting balance for wallet ${walletAddress}:`, error);
            throw new Error(`Failed to get balance for wallet ${walletAddress}: ${error}`);
        }
    }
}

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
    }
];

// Special address for representing native ETH
const NATIVE_ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// Common token addresses by network - for convenience only
const COMMON_TOKENS: Record<string, Record<string, Address>> = {
    base: {
        usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
        eth: NATIVE_ETH_ADDRESS,
    },
    // Add more networks as needed
};

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
    async getTokenBalance(chainName: SupportedEVMChain, tokenAddressOrSymbol: string): Promise<string> {
        try {
            let tokenAddress: Address;
            
            // Check if input looks like a symbol (shorter than an address)
            if (tokenAddressOrSymbol.length < 10 && COMMON_TOKENS[chainName]?.[tokenAddressOrSymbol.toLowerCase()]) {
                // It's likely a token symbol
                tokenAddress = COMMON_TOKENS[chainName][tokenAddressOrSymbol.toLowerCase()];
            } else {
                // Treat it as an address
                tokenAddress = tokenAddressOrSymbol as Address;
            }
            
            const client = this.getPublicClient(chainName);

            // If it's native ETH (or equivalent)
            if (tokenAddress === NATIVE_ETH_ADDRESS) {
                const balance = await client.getBalance({ address: this.account.address });
                return formatUnits(balance, 18); // Native coins always have 18 decimals
            }

            // For ERC-20 tokens
            // First, get the token decimals
            let decimals = 18; // Default to 18 if we can't get decimals
            try {
                decimals = await client.readContract({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'decimals',
                }) as number;
            } catch (error) {
                edwinLogger.warn(`Could not get decimals for token ${tokenAddress}, defaulting to 18`);
            }

            // Then get the balance
            const balance = await client.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [this.account.address],
            });
            if (typeof balance !== 'bigint') {
                throw new Error(`Invalid balance returned from contract. Expected bigint, got ${typeof balance}`);
            }
            return formatUnits(balance as bigint, decimals);
        } catch (error) {
            edwinLogger.error('Error getting token balance:', error);
            throw error;
        }
    }
}

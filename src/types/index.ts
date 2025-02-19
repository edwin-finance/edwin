import type { Token } from '@lifi/types';
import type { Address, Chain } from 'viem';
import { _SupportedEVMChainList } from '../edwin-core/wallets/evm_wallet/evm_wallet';
import { ZodTypeDef, ZodSchema } from 'zod';
import { Edwin } from '../edwin-client';

export type SupportedEVMChain = (typeof _SupportedEVMChainList)[number];

export type SupportedChain = SupportedEVMChain | 'solana';

// Token types
export interface TokenWithBalance {
    token: Token;
    balance: bigint;
    formattedBalance: string;
    priceUSD: string;
    valueUSD: string;
}

export interface WalletBalance {
    chain: SupportedEVMChain;
    address: Address;
    totalValueUSD: string;
    tokens: TokenWithBalance[];
}

// Chain configuration
export interface ChainMetadata {
    chainId: number;
    name: string;
    chain: Chain;
    rpcUrl: string;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    blockExplorerUrl: string;
}

export interface EdwinConfig {
    evmPrivateKey?: `0x${string}`;
    solanaPrivateKey?: string;
    actions: string[];
}

// Base interface for all protocol parameters
export interface ActionParams {
    protocol: string;
    chain: SupportedChain;
    amount?: string;
    asset?: string;
    data?: string;
}

export interface SupplyParams extends ActionParams {}

export interface WithdrawParams extends ActionParams {}

export interface StakeParams extends ActionParams {}

export interface LiquidityParams extends ActionParams {
    assetB?: string;
    amountB?: string;
    poolAddress?: string;
}

export interface DeFiProtocol {
    supportedChains: SupportedChain[];
}

export interface ILendingProtocol extends DeFiProtocol {
    supply(params: SupplyParams): Promise<string>;
    withdraw(params: WithdrawParams): Promise<string>;
    getPortfolio(): Promise<string>;
}

export interface IStakingProtocol extends DeFiProtocol {
    stake(params: StakeParams): Promise<string>;
    unstake(params: StakeParams): Promise<string>;
    claimRewards?(params: StakeParams): Promise<string>;
    getPortfolio(): Promise<string>;
}

export interface IDEXProtocol extends DeFiProtocol {
    swap?(params: any): Promise<number>;
    addLiquidity(params: any): Promise<{ liquidityAdded: [number, number] }>;
    removeLiquidity(params: any): Promise<{ liquidityRemoved: [number, number]; feesClaimed: [number, number] }>;
    getPools?(params: any): Promise<any>;
    getPositions?(params: any): Promise<any>;
    getPositionsFromPool?(params: any): Promise<any>;
    getActiveBin?(params: any): Promise<any>;
    getPortfolio(): Promise<string>;
}

export interface ICookieProtocol extends DeFiProtocol {
    getAgentByTwitter(twitterUsername: string, interval: string): Promise<string>;
    getAgentByContract(contractAddress: string, interval: string): Promise<string>;
    getAgentsPaged(interval: string, page: number, pageSize: number): Promise<string>;
    searchTweets(searchQuery: string, from: string, to: string): Promise<string>;
}

export interface ISwapProtocol extends DeFiProtocol {
    swap(params: any): Promise<number>;
}

export interface EdwinAction {
    name: string;
    description: string;
    template: string;
    schema: ZodSchema<any, ZodTypeDef, any>;
    edwin: Edwin;
    execute: (params: any) => Promise<any>;
    // Future feature: pass input schema to params to enforce correct input
}

export interface IEOracleProtocol extends DeFiProtocol {
    getPrice(symbol: string): Promise<string>;
}

import type { SupportedChain } from '../../core/types';
import { EdwinService } from '../../core/classes/edwinToolProvider';
import { SearchParameters, PairParameters, TokenPairsParameters, TokensParameters } from './parameters';
import axios from 'axios';

const BASE_URL = 'https://api.dexscreener.com';

// Token interfaces
interface TokenInfo {
    address: string;
    name: string;
    symbol: string;
}

interface Website {
    url: string;
}

interface Social {
    platform: string;
    handle: string;
}

interface TokenInfoDetails {
    imageUrl?: string;
    websites?: Website[];
    socials?: Social[];
}

interface Transactions {
    buys: number;
    sells: number;
}

interface Liquidity {
    usd: number;
    base: number;
    quote: number;
}

interface TokenLink {
    type: string;
    label: string;
    url: string;
}

// Pair interface
interface Pair {
    chainId: string;
    dexId: string;
    url: string;
    pairAddress: string;
    labels?: string[];
    baseToken: TokenInfo;
    quoteToken: TokenInfo;
    priceNative: string;
    priceUsd?: string;
    txns: Record<string, Transactions>;
    volume: Record<string, number>;
    priceChange: Record<string, number>;
    liquidity: Liquidity;
    fdv?: number;
    marketCap?: number;
    pairCreatedAt?: number;
    info?: TokenInfoDetails;
    boosts?: {
        active: number;
    };
}

// Response interfaces
interface SearchResponse {
    schemaVersion: string;
    pairs: Pair[];
}

interface PairResponse {
    schemaVersion: string;
    pairs: Pair[];
}

interface TokenProfile {
    url: string;
    chainId: string;
    tokenAddress: string;
    icon: string;
    header: string;
    description: string;
    links: TokenLink[];
}

interface BoostedToken extends TokenProfile {
    amount: number;
    totalAmount: number;
}

interface OrderInfo {
    type: string;
    status: string;
    paymentTimestamp: number;
}

export class DexScreenerService extends EdwinService {
    supportedChains: SupportedChain[] = ['mainnet']; // DexScreener API supports multiple chains

    constructor() {
        super();
    }

    /**
     * Search for pairs matching query
     * Rate limit: 300 requests per minute
     */
    async searchPairs(params: SearchParameters): Promise<SearchResponse> {
        try {
            const { query } = params;
            const response = await axios.get(`${BASE_URL}/latest/dex/search`, {
                params: { q: query },
            });
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`DexScreener search failed: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Get one or multiple pairs by chain and pair address
     * Rate limit: 300 requests per minute
     */
    async getPair(params: PairParameters): Promise<PairResponse> {
        try {
            const { chainId, pairId } = params;
            const response = await axios.get(`${BASE_URL}/latest/dex/pairs/${chainId}/${pairId}`);
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`DexScreener getPair failed: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Get the pools of a given token address
     * Rate limit: 300 requests per minute
     */
    async getTokenPairs(params: TokenPairsParameters): Promise<Pair[]> {
        try {
            const { chainId, tokenAddress } = params;
            const response = await axios.get(`${BASE_URL}/token-pairs/v1/${chainId}/${tokenAddress}`);
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`DexScreener getTokenPairs failed: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Get one or multiple pairs by token address
     * Rate limit: 300 requests per minute
     */
    async getTokens(params: TokensParameters): Promise<Pair[]> {
        try {
            const { chainId, tokenAddresses } = params;
            const response = await axios.get(`${BASE_URL}/tokens/v1/${chainId}/${tokenAddresses}`);
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`DexScreener getTokens failed: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Get the latest token profiles
     * Rate limit: 60 requests per minute
     */
    async getLatestTokenProfiles(): Promise<TokenProfile> {
        try {
            const response = await axios.get(`${BASE_URL}/token-profiles/latest/v1`);
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`DexScreener getLatestTokenProfiles failed: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Get the latest boosted tokens
     * Rate limit: 60 requests per minute
     */
    async getLatestBoostedTokens(): Promise<BoostedToken> {
        try {
            const response = await axios.get(`${BASE_URL}/token-boosts/latest/v1`);
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`DexScreener getLatestBoostedTokens failed: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Get the tokens with most active boosts
     * Rate limit: 60 requests per minute
     */
    async getTopBoostedTokens(): Promise<BoostedToken> {
        try {
            const response = await axios.get(`${BASE_URL}/token-boosts/top/v1`);
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`DexScreener getTopBoostedTokens failed: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Check orders paid for of token
     * Rate limit: 60 requests per minute
     */
    async getTokenOrders(chainId: string, tokenAddress: string): Promise<OrderInfo[]> {
        try {
            const response = await axios.get(`${BASE_URL}/orders/v1/${chainId}/${tokenAddress}`);
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`DexScreener getTokenOrders failed: ${error.message}`);
            }
            throw error;
        }
    }
}

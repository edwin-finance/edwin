import { IEOracleProtocol, SupportedChain } from '../../types/index';
import edwinLogger from '../../utils/logger';

interface PriceResponse {
    feed_id: string;
    rate: string;
    timestamp: number;
}

interface FeedInfo {
    feed_id: string;
    description: string;
}

interface EOracleResponse<T> {
    data: T;
    success: boolean;
    error: string | null;
}

export class EOracleClient implements IEOracleProtocol {
    private apiKey: string;
    private baseUrl: string;
    private feedCache = new Map<string, string>();
    supportedChains: SupportedChain[] = ['base'];

    constructor(apiKey: string) {
        if (!process.env.EORACLE_API_URL) {
            throw new Error('EORACLE_API_URL environment variable is not set');
        }
        this.apiKey = apiKey;
        this.baseUrl = process.env.EORACLE_API_URL;
    }

    private async fetch<T>(endpoint: string): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            headers: {
                'X-API-Key': this.apiKey,
                'Content-Type': 'application/json',
            },
            method: 'GET',
        });

        if (!response.ok) {
            edwinLogger.error('EOracleAPI Error:', {
                status: response.status,
                statusText: response.statusText,
            });
            throw new Error(`EOracleAPI request failed: ${response.statusText}`);
        }

        return response.json();
    }

    private async getFeedId(symbol: string): Promise<string> {
        const cachedId = this.feedCache.get(symbol.toUpperCase());
        if (cachedId) return cachedId;

        const response = await this.fetch<EOracleResponse<FeedInfo[]>>('/feeds');
        
        if (!response.success || !response.data) {
            throw new Error('Failed to fetch feeds');
        }

        const feed = response.data.find(f => 
            f.description.toUpperCase() === symbol.toUpperCase()
        );

        if (!feed) {
            throw new Error(`No feed found for symbol: ${symbol}`);
        }

        this.feedCache.set(symbol.toUpperCase(), feed.feed_id);
        return feed.feed_id;
    }

    async getPrice(symbol: string): Promise<string> {
        try {
            const feedId = await this.getFeedId(symbol);
            const response = await this.fetch<EOracleResponse<PriceResponse>>(`/feeds/${feedId}`);
            
            if (!response.success || !response.data) {
                throw new Error(`Failed to get price for ${symbol}`);
            }

            return JSON.stringify({
                symbol,
                price: response.data.rate,
                timestamp: response.data.timestamp,
            });
        } catch (error) {
            edwinLogger.error('Error fetching price:', error);
            throw error;
        }
    }
} 
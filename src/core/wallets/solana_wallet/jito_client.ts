import axios, { AxiosInstance } from 'axios';
import edwinLogger from '../../../utils/logger';

interface JsonRpcRequest {
    jsonrpc: string;
    id: number;
    method: string;
    params: unknown[];
}

interface TipAccount {
    address: string;
    // Add other tip account properties as needed
}

interface BundleStatus {
    status: 'Failed' | 'Landed' | 'Pending';
    landed_slot?: number;
    error?: string;
}

interface BundleResponse {
    result: {
        value: BundleStatus[];
    };
}

export class JitoJsonRpcClient {
    private baseUrl: string;
    private uuid?: string;
    private client: AxiosInstance;

    constructor(baseUrl: string, uuid?: string) {
        this.baseUrl = baseUrl;
        this.uuid = uuid;
        this.client = axios.create({
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    async sendRequest<T>(endpoint: string, method: string, params: unknown[] = []): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        const data: JsonRpcRequest = {
            jsonrpc: '2.0',
            id: 1,
            method,
            params,
        };

        try {
            const response = await this.client.post<T>(url, data);
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                edwinLogger.error(`HTTP error: ${error.message}`);
                throw error;
            } else {
                edwinLogger.error(`Unexpected error: ${error}`);
                throw new Error('An unexpected error occurred');
            }
        }
    }

    async getTipAccounts(): Promise<{ result: TipAccount[] }> {
        const endpoint = this.uuid ? `/bundles?uuid=${this.uuid}` : '/bundles';
        return this.sendRequest(endpoint, 'getTipAccounts');
    }

    async getRandomTipAccount(): Promise<TipAccount> {
        const tipAccountsResponse = await this.getTipAccounts();
        if (
            tipAccountsResponse.result &&
            Array.isArray(tipAccountsResponse.result) &&
            tipAccountsResponse.result.length > 0
        ) {
            const randomIndex = Math.floor(Math.random() * tipAccountsResponse.result.length);
            return tipAccountsResponse.result[randomIndex];
        }
        throw new Error('No tip accounts available');
    }

    async sendBundle(params: unknown[]): Promise<unknown> {
        const endpoint = this.uuid ? `/bundles?uuid=${this.uuid}` : '/bundles';
        return this.sendRequest(endpoint, 'sendBundle', params);
    }

    async sendTxn(params: unknown[], bundleOnly = false): Promise<unknown> {
        let endpoint = '/transactions';
        const queryParams: string[] = [];

        if (bundleOnly) {
            queryParams.push('bundleOnly=true');
        }

        if (this.uuid) {
            queryParams.push(`uuid=${this.uuid}`);
        }

        if (queryParams.length > 0) {
            endpoint += `?${queryParams.join('&')}`;
        }

        return this.sendRequest(endpoint, 'sendTransaction', params);
    }

    async getInFlightBundleStatuses(bundleIds: (string | number)[]): Promise<BundleResponse> {
        const endpoint = this.uuid ? `/bundles?uuid=${this.uuid}` : '/bundles';
        return this.sendRequest(endpoint, 'getInflightBundleStatuses', [bundleIds]);
    }

    async getBundleStatuses(bundleIds: (string | number)[]): Promise<BundleResponse> {
        const endpoint = this.uuid ? `/bundles?uuid=${this.uuid}` : '/bundles';
        return this.sendRequest(endpoint, 'getBundleStatuses', [bundleIds]);
    }

    async confirmInflightBundle(bundleId: string | number, timeoutMs = 60000): Promise<BundleStatus> {
        const start = Date.now();

        while (Date.now() - start < timeoutMs) {
            try {
                const response = await this.getInFlightBundleStatuses([bundleId]);

                if (
                    response.result?.value &&
                    Array.isArray(response.result.value) &&
                    response.result.value.length > 0
                ) {
                    const bundleStatus = response.result.value[0];

                    edwinLogger.info(`Bundle status: ${bundleStatus.status}, Landed slot: ${bundleStatus.landed_slot}`);

                    if (bundleStatus.status === 'Failed') {
                        return bundleStatus;
                    } else if (bundleStatus.status === 'Landed') {
                        const detailedStatus = await this.getBundleStatuses([bundleId]);
                        if (
                            detailedStatus.result?.value &&
                            Array.isArray(detailedStatus.result.value) &&
                            detailedStatus.result.value.length > 0
                        ) {
                            return detailedStatus.result.value[0];
                        }
                        return bundleStatus;
                    }
                } else {
                    edwinLogger.info('No status returned for the bundle. It may be invalid or very old.');
                }
            } catch (error) {
                edwinLogger.error('Error checking bundle status:', error);
            }

            // Wait for a short time before checking again
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // If we've reached this point, the bundle hasn't reached a final state within the timeout
        edwinLogger.info(`Bundle ${bundleId} has not reached a final state within ${timeoutMs}ms`);
        return { status: 'Pending' };
    }
}

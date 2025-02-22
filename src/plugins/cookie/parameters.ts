export interface AgentParameters {
    username?: string;
    contractAddress?: string;
    interval: '_3Days' | '_7Days';
    page?: number;
    pageSize?: number;
}

export interface SearchParameters {
    query: string;
    from: string;
    to: string;
}

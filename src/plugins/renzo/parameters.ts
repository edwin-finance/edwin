import { SupportedChain } from '../../core/types';

export interface StakeParameters {
    chain: SupportedChain;
    amount: number;
}

export interface ClaimParameters {
    chain: SupportedChain;
}

import { SupportedChain } from '../../core/types';

export interface SupplyParameters {
    chain: SupportedChain;
    asset: string;
    amount: number;
}

export interface WithdrawParameters {
    asset: string;
    amount: number;
}

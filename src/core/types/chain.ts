/**
 * @param type
 * @param id - Chain ID, optional for EVM
 */
export type Chain = EvmChain | SolanaChain;

export type EvmChain = {
    type: 'evm';
    id: number;
};

export type SolanaChain = {
    type: 'solana';
};

import { _SupportedEVMChainList } from '../wallets/evm_wallet/evm_wallet';

export type SupportedEVMChain = (typeof _SupportedEVMChainList)[number];

export type SupportedChain = SupportedEVMChain | 'solana';

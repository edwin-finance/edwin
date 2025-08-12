/**
 * @param type
 * @param id - Chain ID, optional for EVM
 */
export type Chain = EvmChain | SolanaChain | HederaChain;

export type EvmChain = {
    type: 'evm';
    id: number;
};

export type SolanaChain = {
    type: 'solana';
};

export type HederaChain = {
    type: 'hedera';
};

import { _SupportedEVMChainList } from '../wallets/evm_wallet/evm_public_key_wallet';

export type SupportedEVMChain = (typeof _SupportedEVMChainList)[number];

export type SupportedChain = SupportedEVMChain | 'solana' | 'hedera';

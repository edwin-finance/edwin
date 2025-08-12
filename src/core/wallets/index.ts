export { EdwinWallet } from './wallet';
export { EdwinEVMWallet, EdwinEVMPublicKeyWallet } from './evm_wallet';

// Solana wallet clients
export { BaseSolanaWalletClient, KeypairClient, PhantomClient, type PhantomProvider } from './solana_wallet';
export type { SolanaWalletClient } from './solana_wallet';

// Hedera wallet clients
export { BaseHederaWalletClient, HederaWalletFactory, canSign } from './hedera_wallet';
export type { HederaWalletClient } from './hedera_wallet';

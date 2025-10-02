// Export wallet types
export { EdwinWallet } from './core/wallets/wallet';
export { EdwinEVMWallet } from './core/wallets/evm_wallet';
export {
    KeypairClient,
    PublicKeyClient,
    BaseSolanaWalletClient,
    SolanaWalletFactory,
} from './core/wallets/solana_wallet';
export type { SolanaWalletClient } from './core/wallets/solana_wallet';

// Export Hedera wallet types
export { BaseHederaWalletClient, HederaWalletFactory, canSign as hederaCanSign } from './core/wallets/hedera_wallet';
export type { HederaWalletClient } from './core/wallets/hedera_wallet';
export {
    KeypairClient as HederaKeypairClient,
    PublicKeyClient as HederaPublicKeyClient,
} from './core/wallets/hedera_wallet/clients';

// Export core types
export type * from './core/types';

// Export plugins
export * from './plugins/aave';
export * from './plugins/lido';
export * from './plugins/lulo';
export * from './plugins/meteora';
export * from './plugins/uniswap';
export * from './plugins/jupiter';
export * from './plugins/cookie';
export * from './plugins/eoracle';
export * from './plugins/storyprotocol';
export * from './plugins/hyperliquid';
export * from './plugins/hedera_wallet';
export * from './plugins/solana_wallet';
export * from './plugins/evm_wallet';
export * from './plugins/stader';
export * from './plugins/bonzo';
export * from './plugins/saucerswap';

// Export client
export { Edwin } from './client/edwin';
export type { EdwinConfig } from './client';

// Export adapters
export * from './adapters';

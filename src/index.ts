// Export wallet types
export { EdwinWallet } from './core/wallets/wallet';
export { EdwinEVMWallet } from './core/wallets/evm_wallet';
export { EdwinSolanaWallet } from './core/wallets/solana_wallet';

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

// Export client
export { Edwin } from './client/edwin';
export type { EdwinConfig } from './client';

// Export adapters
export * from './adapters';

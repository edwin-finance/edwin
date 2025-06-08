// Core wallet interfaces and base classes
export type { SolanaWalletClient } from './client';
export { BaseSolanaWalletClient } from './base_client';

// Client implementations
export * from './clients';

// Factory for creating wallet clients
export { SolanaWalletFactory, canSign } from './factory';

// Re-export legacy wallet types for backwards compatibility
export { KeypairClient } from './clients/keypair';
export { PublicKeyClient } from './clients/publickey';

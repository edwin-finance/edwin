// Core wallet interfaces and base classes
export type { HederaWalletClient } from './client';
export { BaseHederaWalletClient } from './base_client';

// Client implementations
export * from './clients';

// Factory for creating wallet clients
export { HederaWalletFactory, canSign } from './factory';

// Re-export specific client types for backwards compatibility
export { KeypairClient } from './clients/keypair';
export { PublicKeyClient } from './clients/publickey';

# Edwin Solana Wallet Clients

This module provides a flexible architecture for Solana wallets in Edwin, allowing different wallet implementations from keypairs to browser wallets.

## Architecture

The architecture follows a client pattern with:

1. **SolanaWalletClient Interface**: Defines the contract for all wallet implementations
2. **BaseSolanaWalletClient**: Base class with common functionality
3. **Concrete Clients**: Specific implementations for different wallet types

## Available Wallet Clients

### KeypairClient

A wallet client that uses a private key stored as a Keypair. This is ideal for server-side applications and scripts.

```typescript
import { KeypairClient, SolanaWalletFactory } from 'edwin';

// Create from a base58-encoded private key
const client = new KeypairClient(privateKeyBase58);
// OR using the factory
const client = SolanaWalletFactory.fromPrivateKey(privateKeyBase58);

// Use with Edwin
const edwin = new Edwin({ solanaClient: client });
```

### PhantomClient

A wallet client that integrates with the Phantom wallet in browser environments.

```typescript
import { PhantomClient, SolanaWalletFactory } from 'edwin';
import { createPhantom, Position } from '@phantom/wallet-sdk';

// In a React component
async function initializePhantom() {
    // Get Phantom instance
    const phantom = await createPhantom({
        position: Position.topRight,
        namespace: 'phantom-edwin',
    });

    // Connect to wallet
    await phantom.solana.connect();

    // Create client
    const client = new PhantomClient(phantom);
    // OR using the factory
    const client = SolanaWalletFactory.fromPhantom(phantom);

    // Use with Edwin
    const edwin = new Edwin({ solanaClient: client });
}
```

### PublicKeyClient

A read-only wallet client that can be used for operations that don't require signing.

```typescript
import { PublicKeyClient, SolanaWalletFactory } from 'edwin';

// Create from a base58-encoded public key
const client = new PublicKeyClient('GaRBQJKNFT1LM9UPAWHEDb8NkJWmrJHA9kJvgXs1YGbk');
// OR using the factory
const client = SolanaWalletFactory.fromPublicKey('GaRBQJKNFT1LM9UPAWHEDb8NkJWmrJHA9kJvgXs1YGbk');

// Use with Edwin for read-only operations
const edwin = new Edwin({ solanaClient: client });
```

## Helper Utility

You can check if a wallet client supports signing:

```typescript
import { canSign } from 'edwin';

if (canSign(client)) {
    // This client can sign transactions
} else {
    // This is a read-only client
}
```

## Creating Custom Wallet Clients

You can create clients for other wallets by implementing the `SolanaWalletClient` interface or extending `BaseSolanaWalletClient`.

### Example: Custom Wallet Client

```typescript
import { BaseSolanaWalletClient } from 'edwin';

class CustomWalletClient extends BaseSolanaWalletClient {
    private wallet: CustomWalletProvider;

    constructor(provider: CustomWalletProvider) {
        super(provider.publicKey);
        this.wallet = provider;
    }

    // Implement required methods
    async signTransaction(transaction) {
        return this.wallet.signTransaction(transaction);
    }

    async signAllTransactions(transactions) {
        return this.wallet.signAllTransactions(transactions);
    }

    async signMessage(message) {
        return this.wallet.signMessage(message);
    }

    async sendTransaction(connection, transaction) {
        return this.wallet.sendTransaction(transaction);
    }

    async waitForConfirmationGracefully(connection, signature, timeout) {
        // Implementation
    }
}
```

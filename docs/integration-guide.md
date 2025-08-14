# Edwin SDK: Plugin Integration Guide

This guide walks you through the process of creating a new plugin for the Edwin SDK. Edwin is a TypeScript library that serves as a bridge between AI agents and DeFi protocols, providing a unified interface for interacting with various blockchain networks and protocols.

## Table of Contents

1. [Plugin Architecture Overview](#plugin-architecture-overview)
2. [Directory and File Structure](#directory-and-file-structure)
3. [Creating a New Plugin](#creating-a-new-plugin)
    - [Step 1: Create the Plugin Directory](#step-1-create-the-plugin-directory)
    - [Step 2: Define Parameter Schemas](#step-2-define-parameter-schemas)
    - [Step 3: Implement the Protocol Service](#step-3-implement-the-protocol-service)
    - [Step 4: Create the Plugin Class](#step-4-create-the-plugin-class)
    - [Step 5: Export the Plugin](#step-5-export-the-plugin)
4. [Testing Your Plugin](#testing-your-plugin)
5. [Integrating with the Edwin Client](#integrating-with-the-edwin-client)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

## Plugin Architecture Overview

The Edwin SDK uses a plugin-based architecture to provide a modular and extensible system for protocol integrations. Each plugin:

- Extends the `EdwinPlugin` base class
- Provides tools for specific protocols
- Defines parameter schemas using Zod
- Implements protocol-specific functionality in service classes

The main components of the plugin architecture are:

1. **EdwinPlugin**: Base class for all protocol plugins
2. **EdwinTool**: Interface for tools exposed by plugins
3. **EdwinService**: Base class for services that implement protocol interactions
4. **Parameter Schemas**: Zod schemas that define the input parameters for tools

## Directory and File Structure

When creating a new plugin, you should follow this directory and file structure:

```
src/
└── plugins/
    └── yourplugin/
        ├── index.ts                 # Exports the plugin
        ├── parameters.ts            # Parameter schemas and types
        ├── yourPluginPlugin.ts      # Plugin class implementation
        ├── yourPluginService.ts     # Protocol service implementation
        └── utils.ts                 # Optional utility functions
```

## Creating a New Plugin

### Step 1: Create the Plugin Directory

First, create a new directory for your plugin in the `src/plugins` directory:

```bash
mkdir -p src/plugins/yourplugin
```

### Step 2: Define Parameter Schemas

Create a `parameters.ts` file to define the parameter schemas for your plugin's tools using Zod:

```typescript
// src/plugins/yourplugin/parameters.ts
import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

// Define parameter schemas with validation and descriptions
export const YourOperationParametersSchema = createParameterSchema(
    z.object({
        chain: z.string().min(1).describe('The blockchain network to use'),
        asset: z.string().min(1).describe('The asset to interact with'),
        amount: z.number().positive().describe('The amount to use in the operation'),
        // Add more parameters as needed
    })
);

// Export clean parameter types without the "Schema" suffix
export type YourOperationParameters = typeof YourOperationParametersSchema.type;
```

### Step 3: Implement the Protocol Service

Create a service class that extends `EdwinService` to implement the protocol-specific functionality:

```typescript
// src/plugins/yourplugin/yourPluginService.ts
import { EdwinService } from '../../core/classes/edwinToolProvider';
import { EdwinEVMWallet } from '../../core/wallets'; // Or EdwinSolanaWallet
import edwinLogger from '../../utils/logger';
import { YourOperationParameters } from './parameters';
import { withRetry } from '../../utils';

export class YourPluginService extends EdwinService {
    private wallet: EdwinEVMWallet; // Or EdwinSolanaWallet

    constructor(wallet: EdwinEVMWallet) {
        // Or EdwinSolanaWallet
        super();
        this.wallet = wallet;
    }

    async yourOperation(params: YourOperationParameters): Promise<any> {
        const { chain, asset, amount } = params;
        edwinLogger.info(`Calling YourPlugin to perform operation with ${amount} ${asset} on ${chain}`);

        try {
            // Implement your protocol-specific logic here
            // Use this.wallet to interact with the blockchain

            // Example: Using withRetry for blockchain operations
            const result = await withRetry(async () => {
                // Your operation implementation
                return { success: true, txHash: '0x...' };
            }, 'YourPlugin operation');

            return result;
        } catch (error: unknown) {
            edwinLogger.error('YourPlugin operation error:', error);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`YourPlugin operation failed: ${message}`);
        }
    }
}
```

### Step 4: Create the Plugin Class

Create a plugin class that extends `EdwinPlugin` to define the tools your plugin provides:

```typescript
// src/plugins/yourplugin/yourPluginPlugin.ts
import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { YourPluginService } from './yourPluginService';
import { EdwinEVMWallet } from '../../core/wallets'; // Or EdwinSolanaWallet
import { YourOperationParameters, YourOperationParametersSchema } from './parameters';

export class YourPlugin extends EdwinPlugin {
    constructor(wallet: EdwinEVMWallet) {
        // Or EdwinSolanaWallet
        super('yourplugin', [new YourPluginService(wallet)]);
    }

    getTools(): Record<string, EdwinTool> {
        const yourPluginService = this.toolProviders.find(
            provider => provider instanceof YourPluginService
        ) as YourPluginService;

        return {
            yourPluginOperation: {
                name: 'yourplugin_operation',
                description: 'Perform an operation using YourPlugin',
                schema: YourOperationParametersSchema.schema,
                execute: async (params: YourOperationParameters) => {
                    return await yourPluginService.yourOperation(params);
                },
            },
            // Add more tools as needed
        };
    }

    // Define which chains your plugin supports
    supportsChain = (chain: Chain) => ['ethereum', 'base', 'avalanche'].includes(chain.name); // For EVM chains
    // Or for Solana: supportsChain = (chain: Chain) => chain.name === 'solana';
}

// Factory function to create a new instance of your plugin
export const yourPlugin = (wallet: EdwinEVMWallet) => new YourPlugin(wallet); // Or EdwinSolanaWallet
```

### Step 5: Export the Plugin

Create an `index.ts` file to export your plugin:

```typescript
// src/plugins/yourplugin/index.ts
export * from './yourPluginPlugin';
export * from './yourPluginService';
```

Then, update the main plugins index file to include your plugin:

```typescript
// src/plugins/index.ts
// Add your plugin to the exports
export * from './yourplugin';
```

## Testing Your Plugin

Testing is a crucial part of plugin development. Create test files for your plugin in the `tests` directory:

```
tests/
├── yourplugin.test.ts
└── yourpluginService.test.ts
```

### Writing Tests

Here's an example of how to write tests for your plugin:

```typescript
// tests/yourplugin.test.ts
import { describe, it, expect } from 'vitest';
import { YourPluginService } from '../src/plugins/yourplugin/yourPluginService';
import { EdwinEVMWallet } from '../src/core/wallets'; // Or EdwinSolanaWallet

describe('YourPluginService', () => {
    let service: YourPluginService;
    let wallet: EdwinEVMWallet;

    beforeEach(() => {
        // Use a real wallet with a test private key
        wallet = new EdwinEVMWallet(process.env.TEST_PRIVATE_KEY as `0x${string}`);
        service = new YourPluginService(wallet);
    });

    it('should perform an operation successfully', async () => {
        // Arrange
        const params = {
            chain: 'ethereum',
            asset: 'eth',
            amount: 1.0,
        };

        // Act
        const result = await service.yourOperation(params);

        // Assert
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
    });

    // Add more tests as needed
});
```

### Running Tests

To run tests for your plugin, use the following command:

```bash
pnpm test
```

For testing specific files:

```bash
pnpm test tests/plugins/yourplugin
```

### Testing Best Practices

When implementing tests for DeFi protocol integrations:

1. **Maintain two types of tests**:
    - Mock tests that use test doubles for reliable CI/CD pipeline execution
    - Integration tests that use properly funded wallets to verify actual protocol interactions

2. **Never replace or remove actual protocol implementations** just to make tests pass. Tests should be fixed by:
    - Properly configuring test environments with required wallet keys and balances
    - Adding supplementary mocks where needed while preserving core implementation logic
    - Using test doubles only for external API calls and network interactions
    - Maintaining the integrity of protocol-specific business logic

3. **Keep mock implementations strictly in test files** and never add them to the SDK source files themselves, even when using environment-based conditionals.

## Integrating with the Edwin Client

To make your plugin accessible from the Edwin client, update the `src/client/edwin.ts` file:

1. Import your plugin:

```typescript
// src/client/edwin.ts
import { yourPlugin, YourPlugin } from '../plugins/yourplugin';
```

2. Add your plugin to the `EdwinPlugins` interface:

```typescript
// src/client/edwin.ts
interface EdwinPlugins {
    // Existing plugins
    yourplugin?: YourPlugin;
}
```

3. Initialize your plugin in the constructor:

```typescript
// src/client/edwin.ts
constructor(config: EdwinConfig) {
    // Initialize wallets
    if (config.evmPrivateKey) {
        this.wallets.evm = new EdwinEVMWallet(config.evmPrivateKey);
    }
    // ...

    // Initialize plugins
    if (this.wallets.evm) {
        // Existing plugins
        this.plugins.yourplugin = yourPlugin(this.wallets.evm);
    }
    // ...
}
```

## Best Practices

1. **Error Handling**: Always use proper error handling and logging in your plugin.
2. **Type Safety**: Use TypeScript types and Zod schemas for type safety.
3. **Retry Mechanism**: Use the `withRetry` utility for blockchain operations that might fail.
4. **Logging**: Use the `edwinLogger` for consistent logging across the SDK.
5. **Parameter Validation**: Validate all input parameters using Zod schemas.
6. **Chain Support**: Clearly define which chains your plugin supports.
7. **Documentation**: Add clear descriptions to your tools and parameters.
8. **Testing**: Write comprehensive tests for your plugin.

## Troubleshooting

### Common Issues

1. **Plugin not loading**: Ensure your plugin is properly exported and imported in the Edwin client.
2. **Parameter validation errors**: Check your Zod schemas for correct validation rules.
3. **Wallet connection issues**: Verify that the wallet is properly initialized and connected.
4. **Transaction failures**: Use the `withRetry` utility and proper error handling.

### Debugging Tips

1. Use `edwinLogger.debug()` for detailed logging during development.
2. Check the transaction simulation before sending it to the blockchain.
3. Verify wallet balances and permissions before performing operations.
4. Test your plugin with mock implementations before using real blockchain interactions.

---

By following this guide, you should be able to create a new plugin for the Edwin SDK that integrates seamlessly with the existing architecture. If you encounter any issues or have questions, please refer to the [Edwin SDK documentation](https://docs.edwin.finance), join the [Edwin Discord community](https://discord.com/invite/QNA55N3KtF) for support and discussions, or open an issue on the GitHub repository.

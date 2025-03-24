# Edwin MCP Server Adapter

This adapter enables Edwin to function as a Model Context Protocol (MCP) server, allowing AI agents like Claude to interact with DeFi protocols through Edwin's tools.

## Overview

The Model Context Protocol (MCP) is a standardized interface that allows AI agents to interact with external tools and services. This adapter implements an MCP server that exposes Edwin's DeFi tools to AI agents, enabling them to perform operations like:

- Managing liquidity positions
- Swapping tokens
- Checking balances
- Interacting with lending protocols
- And more, depending on the Edwin plugins available

## Installation

The MCP adapter is included in the Edwin SDK. To use it, you need to install the required dependencies:

```bash
pnpm add @modelcontextprotocol/sdk express zod-to-json-schema cors express-rate-limit raw-body --save-dev
```

## Usage

### Basic Setup

```typescript
import { Edwin } from 'edwin-sdk';
import { EdwinMcpServer } from 'edwin-sdk/adapters/mcp';

// Initialize Edwin with wallet configurations
const edwin = new Edwin({
  evmPrivateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
  solanaPrivateKey: process.env.SOLANA_PRIVATE_KEY,
});

// Create and start the MCP server
const mcpServer = new EdwinMcpServer(edwin, {
  name: 'edwin-mcp',
  port: 3333,
  autoApproveTools: ['WALLET_ADDRESS', 'BALANCE'],
});

// Start the server
await mcpServer.start();
```

### Configuration

Create a `.env` file with your configuration:

```env
# MCP Server Settings
MCP_PORT=3333
MCP_SERVER_NAME=edwin-mcp
MCP_SERVER_VERSION=0.1.0

# Auto-approve settings
MCP_AUTO_APPROVE_ALL=false
MCP_AUTO_APPROVE_TOOLS=WALLET_ADDRESS,BALANCE

# Edwin Wallet Configuration
EVM_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000
SOLANA_PRIVATE_KEY=your_solana_private_key_here

# Logging
LOG_LEVEL=info
```

Then load the configuration:

```typescript
import { loadConfigFromEnv } from 'edwin-sdk/adapters/mcp';

const { mcpConfig, authConfig, evmPrivateKey, solanaPrivateKey } = loadConfigFromEnv();

const edwin = new Edwin({
  evmPrivateKey,
  solanaPrivateKey,
});

const mcpServer = new EdwinMcpServer(edwin, mcpConfig);
await mcpServer.start();
```

## Integration with Claude Desktop

To add the Edwin MCP server to Claude Desktop, add the following to your Claude Desktop configuration file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "edwin-mcp": {
      "command": "node",
      "args": ["path/to/your/edwin-mcp-server.js"],
      "env": {
        "EVM_PRIVATE_KEY": "your_evm_private_key_here",
        "SOLANA_PRIVATE_KEY": "your_solana_private_key_here",
        "MCP_AUTO_APPROVE_TOOLS": "WALLET_ADDRESS,BALANCE"
      },
      "disabled": false,
      "autoApprove": ["WALLET_ADDRESS", "BALANCE"]
    }
  }
}
```

## Available Tools

The MCP server exposes all tools from the initialized Edwin instance. The available tools depend on which plugins are loaded based on the provided wallet configurations.

### EVM-based Tools (when EVM wallet is configured)

- `AAVE_SUPPLY` - Supply assets to Aave
- `AAVE_WITHDRAW` - Withdraw assets from Aave
- `LIDO_STAKE` - Stake ETH with Lido
- `LIDO_UNSTAKE` - Unstake ETH from Lido
- `UNISWAP_SWAP` - Swap tokens on Uniswap
- `UNISWAP_ADD_LIQUIDITY` - Add liquidity to Uniswap pools
- `UNISWAP_REMOVE_LIQUIDITY` - Remove liquidity from Uniswap pools

### Solana-based Tools (when Solana wallet is configured)

- `METEORA_ADD_LIQUIDITY` - Add liquidity to Meteora pools
- `METEORA_REMOVE_LIQUIDITY` - Remove liquidity from Meteora pools
- `METEORA_CLAIM_FEES` - Claim fees from Meteora pools
- `JUPITER_SWAP` - Swap tokens using Jupiter aggregator
- `LULO_SUPPLY` - Supply assets to Lulo
- `LULO_WITHDRAW` - Withdraw assets from Lulo

### General Tools

- `WALLET_ADDRESS` - Get wallet address
- `BALANCE` - Check wallet balance
- `EORACLE_GET_PRICE` - Get token price from EOracle (if API key is configured)

## Security Considerations

- Keep your private keys secure and never share them
- Use environment variables for sensitive information
- Consider using a dedicated wallet for AI agent operations
- Regularly monitor and audit AI agent activities
- Test operations on testnets before mainnet
- Use the `autoApproveTools` feature carefully, only auto-approving safe, read-only operations

## Error Handling

The MCP server includes robust error handling:

- Parameter validation using Zod schemas
- Proper error formatting for MCP responses
- Logging of all operations and errors
- Global error handlers for uncaught exceptions

## Advanced Configuration

For more advanced use cases, you can customize the authentication and approval processes:

```typescript
import { EdwinMcpServer } from 'edwin-sdk/adapters/mcp';
import { createAuthMiddleware, createApprovalMiddleware } from 'edwin-sdk/adapters/mcp/auth';

// Custom authentication function
const customAuthFunction = async (request) => {
  // Implement your authentication logic
  return true;
};

// Custom approval function
const customApprovalFunction = async (toolName, params) => {
  // Implement your approval logic
  return true;
};

// Create the MCP server with custom auth
const mcpServer = new EdwinMcpServer(edwin, {
  name: 'edwin-mcp',
  port: 3333,
  logger: (message, level) => {
    // Custom logging implementation
  },
});

// Start the server
await mcpServer.start();
```

## Examples

See the `examples` directory for complete examples:

- `basic-server.ts` - Basic MCP server setup
- `custom-auth.ts` - MCP server with custom authentication
- `claude-desktop.ts` - Example for Claude Desktop integration

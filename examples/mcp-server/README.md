# Edwin MCP Server

This is an example implementation of a Model Context Protocol (MCP) server for the Edwin SDK. It allows AI agents to interact with Edwin's tools through a standardized protocol.

## Prerequisites

- Node.js >= 18.0.0
- pnpm (recommended) or npm
- A local Claude instance or access to Claude API
- EVM and/or Solana wallet private keys (depending on your needs)

## Installation

1. Clone the repository and navigate to the mcp-server directory:

```bash
cd examples/mcp-server
```

2. Install dependencies:

```bash
pnpm install
```

3. Build the project:

```bash
pnpm build
```

## Running the Server

### Option 1: Local Development

1. Create your environment file:

```bash
cp .env.example .env
```

2. Configure your `.env` file with the following required settings:

    - `SOLANA_RPC_URL`: Your RPC endpoint
    - `EVM_PRIVATE_KEY`: Your EVM wallet private key
    - `SOLANA_PRIVATE_KEY`: Your Solana wallet private key
    - `EDWIN_MCP_MODE=true`: Enable MCP mode

3. Start the server:
    - For production: `pnpm start`
    - For development with hot reloading: `pnpm dev`

### Option 2: Using with Claude Desktop

1. After building the project, use the provided `claude_desktop_config.json` to configure your Claude Desktop:

    - Open Claude Desktop
    - Go to Settings
    - Import the configuration from `claude_desktop_config.json`

2. The server will automatically start when needed by Claude Desktop.

## Available Tools

The server exposes all tools configured in your Edwin instance. Common tools include:

- Wallet operations
- Balance checking
- Transaction signing
- Token transfers
- Contract interactions

## Security Considerations

1. Never commit your `.env` file with private keys
2. Use appropriate CORS settings in production
3. Implement rate limiting for production use
4. Keep your private keys secure and never share them

## Troubleshooting

1. **Server won't start**:

    - Check if the port is already in use
    - Verify your environment variables are set correctly
    - Check the logs for specific error messages

2. **Tools not available**:

    - Ensure your Edwin instance is properly configured
    - Check if the tools are properly registered
    - Verify your wallet keys are correct

3. **Connection issues**:
    - Check if the server is running
    - Verify the port is correct
    - Check network connectivity

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is licensed under the same terms as the main Edwin SDK.

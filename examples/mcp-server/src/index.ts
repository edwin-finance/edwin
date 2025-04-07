import { Edwin } from '../../../src/client/edwin';
import { getMcpToolsFromEdwin } from '../../../src/adapters/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import dotenv from 'dotenv';
import edwinLogger from '../../../src/utils/logger';

// Load environment variables
dotenv.config();

// Set MCP mode before importing the logger
process.env.EDWIN_MCP_MODE = 'true';

async function main() {
    try {
        // Initialize Edwin with wallet configurations
        const edwin = new Edwin({
            evmPrivateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
            solanaPrivateKey: process.env.SOLANA_PRIVATE_KEY,
        });

        // Get MCP tools from Edwin
        const mcpTools = await getMcpToolsFromEdwin({ edwin });

        // Create MCP server instance
        const server = new McpServer({
            name: process.env.MCP_SERVER_NAME || 'edwin',
            version: process.env.MCP_SERVER_VERSION || '0.1.0',
        });

        // Register tools with the server
        for (const tool of mcpTools) {
            server.tool(tool.name, tool.description, tool.parameters, tool.execute);
        }

        // Create and connect to stdio transport
        const transport = new StdioServerTransport();
        await server.connect(transport);

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            edwinLogger.info('Shutting down MCP server...');
            await server.close();
            process.exit(0);
        });

        edwinLogger.info('MCP server started successfully');
    } catch (error) {
        edwinLogger.error('Failed to start MCP server:', error);
        process.exit(1);
    }
}

// Run the server
main();

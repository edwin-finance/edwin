import { Edwin } from 'edwin-sdk';
import { EdwinMcpServer } from '../../src/adapters/mcp';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
    try {
        // Initialize Edwin with wallet configurations
        const edwin = new Edwin({
            evmPrivateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
            solanaPrivateKey: process.env.SOLANA_PRIVATE_KEY,
        });

        // Create and start the MCP server
        const mcpServer = new EdwinMcpServer(edwin, {
            name: process.env.MCP_SERVER_NAME || 'edwin-mcp',
            port: parseInt(process.env.MCP_PORT || '3333'),
            autoApproveTools: (process.env.MCP_AUTO_APPROVE_TOOLS || '').split(',').filter(Boolean),
            logger: (message: string, level: string) => {
                console.log(`[${level.toUpperCase()}] ${message}`);
            },
        });

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('Shutting down MCP server...');
            await mcpServer.stop();
            process.exit(0);
        });

        // Start the server
        await mcpServer.start();
    } catch (error) {
        console.error('Failed to start MCP server:', error);
        process.exit(1);
    }
}

// Run the server
main();
import { Edwin } from 'edwin-sdk';
import { EdwinMcpServer } from '../../src/adapters/mcp';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Set MCP mode before importing the logger
process.env.EDWIN_MCP_MODE = 'true';

// Import logger after setting MCP mode
import edwinLogger from '../../src/utils/logger';

async function main() {
    try {
        // Initialize Edwin with wallet configurations
        const edwin = new Edwin({
            evmPrivateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
            solanaPrivateKey: process.env.SOLANA_PRIVATE_KEY,
        });

        // Create and start the MCP server
        const mcpServer = new EdwinMcpServer(edwin, {
            name: process.env.MCP_SERVER_NAME || 'edwin',
            port: parseInt(process.env.MCP_PORT || '3333'),
            autoApproveTools: (process.env.MCP_AUTO_APPROVE_TOOLS || '').split(',').filter(Boolean),
            logger: (message: string, level: string) => {
                switch (level) {
                    case 'error':
                        edwinLogger.error(message);
                        break;
                    case 'warn':
                        edwinLogger.warn(message);
                        break;
                    case 'debug':
                        edwinLogger.debug(message);
                        break;
                    default:
                        edwinLogger.info(message);
                }
            },
        });

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            edwinLogger.info('Shutting down MCP server...');
            await mcpServer.stop();
            process.exit(0);
        });

        // Start the server
        await mcpServer.start();
    } catch (error) {
        edwinLogger.error('Failed to start MCP server:', error);
        process.exit(1);
    }
}

// Run the server
main();

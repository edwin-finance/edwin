/**
 * Example of a basic Edwin MCP server
 */

import { Edwin } from '../../../client/edwin';
import { EdwinMcpServer } from '../index';
import { loadConfigFromEnv } from '../config';

async function startBasicMcpServer() {
    try {
        // Load configuration from environment variables
        const { mcpConfig, evmPrivateKey, solanaPrivateKey } = loadConfigFromEnv();

        // Initialize Edwin with wallet configurations
        const edwin = new Edwin({
            evmPrivateKey,
            solanaPrivateKey,
        });

        // Create and start the MCP server
        const mcpServer = new EdwinMcpServer(edwin, mcpConfig);
        await mcpServer.start();

        console.log('Edwin MCP server is running');
    } catch (error) {
        console.error('Failed to start Edwin MCP server:', error);
        process.exit(1);
    }
}

// Start the server
startBasicMcpServer();

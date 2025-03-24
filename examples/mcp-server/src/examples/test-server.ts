/**
 * Test script for the Edwin MCP server
 */

import { Edwin } from 'edwin-sdk';
import { EdwinMcpServer } from '../index';

async function testMcpServer() {
  try {
    // Create a minimal Edwin instance for testing
    // Note: Using dummy private keys for testing only
    const edwin = new Edwin({
      evmPrivateKey: '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
      solanaPrivateKey: 'dummy_solana_private_key',
    });

    // Create the MCP server with custom logger
    const mcpServer = new EdwinMcpServer(edwin, {
      name: 'edwin-mcp-test',
      port: 3334,
      autoApproveAll: true, // Auto-approve all tools for testing
      logger: (message, level) => {
        console.log(`[${level.toUpperCase()}] ${message}`);
      },
    });

    // Start the server
    await mcpServer.start();
    
    console.log('Edwin MCP test server started successfully');
    console.log('Press Ctrl+C to stop the server');
  } catch (error) {
    console.error('Failed to start Edwin MCP test server:', error);
    process.exit(1);
  }
}

// Run the test
testMcpServer();

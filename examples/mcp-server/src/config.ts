/**
 * Configuration utilities for the Edwin MCP server
 */

import * as dotenv from 'dotenv';
import { EdwinMcpServerConfig } from './index';
import { AuthConfig } from './auth';

// Load environment variables from .env file
dotenv.config();

/**
 * Environment variable configuration for the MCP server
 */
export interface EnvConfig {
  /** MCP server port */
  MCP_PORT?: string;
  /** MCP server name */
  MCP_SERVER_NAME?: string;
  /** MCP server version */
  MCP_SERVER_VERSION?: string;
  /** Whether to auto-approve all tool executions */
  MCP_AUTO_APPROVE_ALL?: string;
  /** Comma-separated list of tools to auto-approve */
  MCP_AUTO_APPROVE_TOOLS?: string;
  /** EVM private key for Edwin */
  EVM_PRIVATE_KEY?: string;
  /** Solana private key for Edwin */
  SOLANA_PRIVATE_KEY?: string;
  /** Log level (debug, info, warn, error) */
  LOG_LEVEL?: string;
}

/**
 * Loads configuration from environment variables
 * @returns MCP server configuration
 */
export function loadConfigFromEnv(): {
  mcpConfig: EdwinMcpServerConfig;
  authConfig: AuthConfig;
  evmPrivateKey?: `0x${string}`;
  solanaPrivateKey?: string;
} {
  const env: EnvConfig = process.env as unknown as EnvConfig;

  // Parse auto-approve tools
  const autoApproveTools = env.MCP_AUTO_APPROVE_TOOLS
    ? env.MCP_AUTO_APPROVE_TOOLS.split(',').map(tool => tool.trim())
    : [];

  // Parse auto-approve all flag
  const autoApproveAll = env.MCP_AUTO_APPROVE_ALL === 'true';

  // Parse port
  const port = env.MCP_PORT ? parseInt(env.MCP_PORT, 10) : undefined;

  // Create MCP server configuration
  const mcpConfig: EdwinMcpServerConfig = {
    name: env.MCP_SERVER_NAME,
    version: env.MCP_SERVER_VERSION,
    port,
    autoApproveAll,
    autoApproveTools,
  };

  // Create authentication configuration
  const authConfig: AuthConfig = {
    requireAuth: false, // Default to no authentication for now
  };

  // Extract wallet private keys
  const evmPrivateKey = env.EVM_PRIVATE_KEY as `0x${string}` | undefined;
  const solanaPrivateKey = env.SOLANA_PRIVATE_KEY;

  return {
    mcpConfig,
    authConfig,
    evmPrivateKey,
    solanaPrivateKey,
  };
}

/**
 * Creates a Claude Desktop configuration object for the MCP server
 * @param port Server port
 * @param evmPrivateKey EVM private key
 * @param solanaPrivateKey Solana private key
 * @param autoApproveTools List of tools to auto-approve
 * @returns Claude Desktop configuration object
 */
export function createClaudeDesktopConfig(
  port: number = 3333,
  evmPrivateKey?: string,
  solanaPrivateKey?: string,
  autoApproveTools: string[] = []
): any {
  return {
    mcpServers: {
      'edwin-mcp': {
        command: 'node',
        args: ['path/to/edwin-mcp-server.js'],
        env: {
          MCP_PORT: port.toString(),
          EVM_PRIVATE_KEY: evmPrivateKey || '',
          SOLANA_PRIVATE_KEY: solanaPrivateKey || '',
          MCP_AUTO_APPROVE_TOOLS: autoApproveTools.join(','),
        },
        disabled: false,
        autoApprove: autoApproveTools,
      },
    },
  };
}

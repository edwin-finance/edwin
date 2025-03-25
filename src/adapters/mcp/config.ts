/**
 * Configuration utilities for the Edwin MCP server
 */

import * as dotenv from 'dotenv';
import { AuthConfig as AuthConfigBase } from './auth';
import { z } from 'zod';

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
    /** Whether authentication is enabled */
    AUTH_ENABLED?: string;
    /** API key for authentication */
    AUTH_API_KEY?: string;
    /** Comma-separated list of allowed origins */
    AUTH_ALLOWED_ORIGINS?: string;
}

export interface McpConfig {
    name?: string;
    version?: string;
    port?: number;
    autoApprove?: string[];
    logger?: (message: string, level: 'info' | 'error' | 'warn' | 'debug') => void;
}

export type AuthConfig = AuthConfigBase;

export interface ServerConfig {
    mcp: McpConfig;
    auth: AuthConfig;
}

const mcpConfigSchema = z.object({
    name: z.string().optional(),
    version: z.string().optional(),
    port: z.number().optional(),
    autoApprove: z.array(z.string()).optional(),
    logger: z
        .function()
        .args(z.string(), z.enum(['info', 'error', 'warn', 'debug']))
        .optional(),
});

const authConfigSchema = z.object({
    enabled: z.boolean(),
    apiKey: z.string().optional(),
    allowedOrigins: z.array(z.string()).optional(),
});

const serverConfigSchema = z.object({
    mcp: mcpConfigSchema,
    auth: authConfigSchema,
});

/**
 * Loads configuration from environment variables
 * @returns MCP server configuration
 */
export const loadConfigFromEnv = (): ServerConfig => {
    const env: EnvConfig = process.env as unknown as EnvConfig;

    const config: ServerConfig = {
        mcp: {
            name: env.MCP_SERVER_NAME,
            version: env.MCP_SERVER_VERSION,
            port: env.MCP_PORT ? parseInt(env.MCP_PORT, 10) : undefined,
            autoApprove: env.MCP_AUTO_APPROVE_TOOLS?.split(',').filter(Boolean),
            logger: (message: string, level: 'info' | 'error' | 'warn' | 'debug') => {
                console.log(`[${level.toUpperCase()}] ${message}`);
            },
        },
        auth: {
            enabled: env.AUTH_ENABLED === 'true',
            apiKey: env.AUTH_API_KEY,
            allowedOrigins: env.AUTH_ALLOWED_ORIGINS?.split(',').filter(Boolean),
        },
    };

    return serverConfigSchema.parse(config);
};

interface ClaudeDesktopConfig {
    mcpServers: {
        'edwin-mcp': {
            command: string;
            args: string[];
            env: {
                MCP_PORT: string;
                EVM_PRIVATE_KEY: string;
                SOLANA_PRIVATE_KEY: string;
                MCP_AUTO_APPROVE_TOOLS: string;
            };
            disabled: boolean;
            autoApprove: string[];
        };
    };
}

export function createClaudeDesktopConfig(
    port: number = 3333,
    evmPrivateKey?: string,
    solanaPrivateKey?: string,
    autoApproveTools: string[] = []
): ClaudeDesktopConfig {
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

import { startMcpServer } from '@modelcontextprotocol/sdk';
import { Edwin } from 'edwin-sdk';
import { EdwinTool } from 'edwin-sdk/src/core/types';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import express, { Request, Response } from 'express';
import { McpAction, McpServer, McpServerConfig } from './types';
import { createAuthMiddleware as _createAuthMiddleware } from './auth';
import { handleError } from './errorHandler';
import { getConfig } from './config';
import { Server } from 'http';

/**
 * Configuration options for the Edwin MCP server
 */
export interface EdwinMcpServerConfig {
    /** Server name displayed to AI agents */
    name?: string;
    /** Server version */
    version?: string;
    /** Port to run the server on */
    port?: number;
    /** Whether to automatically approve all tool executions (not recommended for production) */
    autoApproveAll?: boolean;
    /** List of tool names to automatically approve without user confirmation */
    autoApproveTools?: string[];
    /** Custom logging function */
    logger?: (message: string, level: 'info' | 'error' | 'warn' | 'debug') => void;
    /** Rate limiting configuration */
    rateLimit?: {
        windowMs: number;
        max: number;
    };
    /** CORS configuration */
    cors?: {
        origin: string | string[];
        methods: string[];
        allowedHeaders: string[];
    };
}

/**
 * Class that manages an MCP server for exposing Edwin tools to AI agents
 */
export class EdwinMcpServer {
    private edwin: Edwin;
    private config: Required<EdwinMcpServerConfig>;
    private isRunning: boolean = false;
    private server: Server | null = null; // Use proper type for server instance

    /**
     * Creates a new Edwin MCP server instance
     * @param edwin Initialized Edwin instance with wallets and plugins
     * @param config Server configuration options
     */
    constructor(edwin: Edwin, config: EdwinMcpServerConfig = {}) {
        this.edwin = edwin;

        // Set default configuration values
        this.config = {
            name: config.name || 'edwin-mcp',
            version: config.version || '0.1.0',
            port: config.port || 3333,
            autoApproveAll: config.autoApproveAll || false,
            autoApproveTools: config.autoApproveTools || [],
            logger: config.logger || this.defaultLogger,
            rateLimit: config.rateLimit || {
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 100, // limit each IP to 100 requests per windowMs
            },
            cors: config.cors || {
                origin: '*',
                methods: ['GET', 'POST'],
                allowedHeaders: ['Content-Type', 'Authorization'],
            },
        };
    }

    /**
     * Starts the MCP server
     * @returns A promise that resolves when the server is started
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            this.config.logger('MCP server is already running', 'warn');
            return;
        }

        try {
            // Get all tools from Edwin
            const edwinTools = await this.edwin.getTools();

            // Convert Edwin tools to MCP actions
            const mcpActions = this.convertEdwinToolsToMcpActions(edwinTools);

            // Configure auto-approve settings
            const autoApprove = this.config.autoApproveAll
                ? Object.keys(mcpActions)
                : this.config.autoApproveTools.map(tool => tool.toUpperCase());

            // Start the MCP server with rate limiting and CORS
            this.server = await startMcpServer(mcpActions, this.edwin, {
                name: this.config.name,
                version: this.config.version,
                port: this.config.port,
                autoApprove,
                middleware: [rateLimit(this.config.rateLimit), cors(this.config.cors)],
            });

            this.isRunning = true;
            this.config.logger(`Edwin MCP server started on port ${this.config.port}`, 'info');
        } catch (error) {
            this.config.logger(`Failed to start Edwin MCP server: ${error}`, 'error');
            throw error;
        }
    }

    /**
     * Converts Edwin tools to MCP actions format
     * @param edwinTools Record of Edwin tools
     * @returns Record of MCP actions
     */
    private convertEdwinToolsToMcpActions(edwinTools: Record<string, EdwinTool>): Record<string, unknown> {
        const mcpActions: Record<string, unknown> = {};

        for (const [_, tool] of Object.entries(edwinTools)) {
            // Convert tool name to uppercase for MCP convention
            const actionName = tool.name.toUpperCase();

            // Create a Zod schema for parameter validation
            const paramSchema = z.object(tool.schema);

            mcpActions[actionName] = {
                description: tool.description,
                parameters: tool.schema,
                execute: async (params: unknown) => {
                    try {
                        // Validate parameters using Zod schema
                        const validatedParams = paramSchema.parse(params);

                        this.config.logger(
                            `Executing tool ${tool.name} with params: ${JSON.stringify(validatedParams)}`,
                            'debug'
                        );
                        const result = await tool.execute(validatedParams);
                        this.config.logger(`Tool ${tool.name} executed successfully`, 'debug');
                        return result;
                    } catch (error) {
                        if (error instanceof z.ZodError) {
                            this.config.logger(
                                `Parameter validation error for tool ${tool.name}: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
                                'error'
                            );
                        } else {
                            this.config.logger(`Error executing tool ${tool.name}: ${error}`, 'error');
                        }
                        throw error;
                    }
                },
            };
        }

        return mcpActions;
    }

    /**
     * Gracefully shuts down the MCP server
     * @returns A promise that resolves when the server is shut down
     */
    async shutdown(): Promise<void> {
        if (!this.isRunning) {
            this.config.logger('MCP server is not running', 'warn');
            return;
        }

        try {
            if (this.server && typeof this.server.close === 'function') {
                await new Promise<void>(resolve => {
                    this.server.close(() => {
                        this.config.logger('MCP server shut down successfully', 'info');
                        resolve();
                    });
                });
            }
            this.isRunning = false;
        } catch (error) {
            this.config.logger(`Error shutting down MCP server: ${error}`, 'error');
            throw error;
        }
    }

    /**
     * Default logger implementation
     */
    private defaultLogger(message: string, level: 'info' | 'error' | 'warn' | 'debug'): void {
        const timestamp = new Date().toISOString();

        switch (level) {
            case 'info':
                console.info(`[${timestamp}] [INFO] ${message}`);
                break;
            case 'error':
                console.error(`[${timestamp}] [ERROR] ${message}`);
                break;
            case 'warn':
                console.warn(`[${timestamp}] [WARN] ${message}`);
                break;
            case 'debug':
                console.debug(`[${timestamp}] [DEBUG] ${message}`);
                break;
        }
    }
}

export function createMcpServer(
    actions: Record<string, McpAction>,
    context: unknown,
    config: McpServerConfig = {}
): McpServer {
    const app = express();
    const _serverConfig = getConfig(config);

    app.use(express.json());

    app.post('/execute/:action', async (req: Request, res: Response) => {
        try {
            const { action } = req.params;
            const actionHandler = actions[action];

            if (!actionHandler) {
                res.status(404).json({
                    error: {
                        message: `Action ${action} not found`,
                        code: 'ACTION_NOT_FOUND',
                    },
                });
                return;
            }

            const params = z.object(actionHandler.parameters).parse(req.body);
            const result = await actionHandler.execute(params);

            res.json({ result });
        } catch (error: unknown) {
            handleError(error, res);
        }
    });

    return {
        close: (callback: () => void) => {
            // Implementation for closing the server
            callback();
        },
        listen: (port: number, callback?: () => void) => {
            // Implementation for starting the server
            app.listen(port, callback);
        },
    };
}

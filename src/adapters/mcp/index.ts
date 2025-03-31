import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Edwin } from 'edwin-sdk';
import type { EdwinTool } from 'edwin-sdk/src/core/types';

/**
 * Error class for MCP server errors
 */
export class McpServerError extends Error {
    public readonly statusCode: number;
    public readonly details: unknown;

    constructor(message: string, statusCode: number = 500, details?: unknown) {
        super(message);
        this.name = 'McpServerError';
        this.statusCode = statusCode;
        this.details = details ?? null;
    }
}

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
}

/**
 * Interface for tool examples
 */
interface ToolExample {
    input: Record<string, unknown>;
    output: unknown;
    explanation: string;
}

/**
 * Type for MCP tool parameters
 */
type McpToolParameters = Record<string, z.ZodType>;

/**
 * Class that manages an MCP server for exposing Edwin tools to AI agents
 */
export class EdwinMcpServer {
    private edwin: Edwin;
    private config: Required<EdwinMcpServerConfig>;
    private isRunning: boolean = false;
    private server?: McpServer;

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

            // Create MCP server instance
            const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
            this.server = new McpServer({
                name: this.config.name,
                version: this.config.version,
            });

            // Convert Edwin tools to MCP tools
            await this.registerEdwinTools(edwinTools);

            // Start the server with stdio transport
            const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
            const transport = new StdioServerTransport();
            await this.server.connect(transport);

            this.isRunning = true;
            this.config.logger('Edwin MCP server started successfully', 'info');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error occurred';
            this.config.logger(`Failed to start Edwin MCP server: ${message}`, 'error');
            throw error;
        }
    }

    /**
     * Stops the MCP server
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        try {
            // Cleanup and stop the server
            this.isRunning = false;
            this.config.logger('Edwin MCP server stopped', 'info');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error occurred';
            this.config.logger(`Failed to stop Edwin MCP server: ${message}`, 'error');
            throw error;
        }
    }

    /**
     * Registers Edwin tools as MCP tools
     * @param tools Record of Edwin tools
     */
    private async registerEdwinTools(tools: Record<string, EdwinTool<z.ZodType>>): Promise<void> {
        for (const [name, tool] of Object.entries(tools)) {
            // Convert tool name to uppercase for MCP convention
            const mcpToolName = name.toUpperCase();

            // Convert Zod schema to parameters for MCP
            const parameters: McpToolParameters =
                tool.schema instanceof z.ZodObject ? tool.schema.shape : { input: tool.schema };

            // Register the tool with MCP server
            this.server!.tool(
                mcpToolName,
                tool.description,
                parameters,
                async (params: z.infer<typeof tool.schema>) => {
                    try {
                        this.config.logger(`Executing tool ${name} with params: ${JSON.stringify(params)}`, 'debug');

                        // Execute the tool with validated parameters
                        const result = await tool.execute(params);

                        this.config.logger(`Tool ${name} executed successfully`, 'debug');

                        // Format the result as MCP tool response
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(result, null, 2),
                                },
                            ],
                        };
                    } catch (error) {
                        this.config.logger(`Error executing tool ${name}: ${error}`, 'error');

                        // Format error for MCP response
                        const mcpError =
                            error instanceof McpServerError
                                ? error
                                : new McpServerError(
                                      error instanceof Error ? error.message : 'Unknown error occurred',
                                      500
                                  );

                        return {
                            isError: true,
                            content: [
                                {
                                    type: 'text',
                                    text: mcpError.message,
                                },
                            ],
                        };
                    }
                }
            );

            // Add tool examples if available
            if ('examples' in tool && Array.isArray((tool as { examples?: ToolExample[] }).examples)) {
                const examples = (tool as { examples: ToolExample[] }).examples;
                if (examples.length > 0) {
                    this.server!.prompt(
                        `${mcpToolName}-examples`,
                        {
                            showIndex: z.string().optional().describe('Example index to show (number)'),
                        },
                        (args: { showIndex?: string }) => {
                            const showIndex = args.showIndex ? parseInt(args.showIndex) : undefined;
                            const selectedExamples = typeof showIndex === 'number' ? [examples[showIndex]] : examples;

                            const exampleText = selectedExamples
                                .map(
                                    (ex: ToolExample, idx: number) => `
Example ${idx + 1}:
Input: ${JSON.stringify(ex.input, null, 2)}
Output: ${JSON.stringify(ex.output, null, 2)}
Explanation: ${ex.explanation}
                                    `
                                )
                                .join('\n');

                            return {
                                messages: [
                                    {
                                        role: 'user',
                                        content: {
                                            type: 'text',
                                            text: `Examples for ${name}:\n${exampleText}`,
                                        },
                                    },
                                ],
                            };
                        }
                    );
                }
            }
        }
    }

    /**
     * Default logger implementation
     */
    private defaultLogger(message: string, level: 'info' | 'error' | 'warn' | 'debug'): void {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    }
}

import { z } from 'zod';
import type { Edwin } from '../../index';
import edwinLogger from '../../utils/logger';

export type GetMcpToolsParams = {
    edwin: Edwin;
};

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
 * Helper function to log errors
 */
function logError(message: string, error?: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const fullMessage = error ? `${message}: ${errorMessage}` : message;

    edwinLogger.error(fullMessage);
    if (error instanceof Error && error.stack) {
        edwinLogger.error(`Stack trace: ${error.stack}`);
    }
}

/**
 * Helper function to log debug info
 */
function logDebug(message: string): void {
    edwinLogger.debug(message);
}

/**
 * Converts Edwin tools to MCP format
 */
export async function getMcpToolsFromEdwin({ edwin }: GetMcpToolsParams) {
    try {
        // Get all tools from Edwin
        const edwinTools = await edwin.getTools();
        logDebug(`Found ${Object.keys(edwinTools).length} tools from Edwin`);

        // Convert each tool to MCP format
        const mcpTools = Object.entries(edwinTools).map(([key, tool]) => {
            // Use the tool's name property in uppercase for MCP convention
            const mcpToolName = tool.name ? tool.name.toUpperCase() : key.toUpperCase();
            logDebug(`Converting tool: ${mcpToolName}`);

            // Convert Zod schema to parameters for MCP
            const parameters = tool.schema instanceof z.ZodObject ? tool.schema.shape : { input: tool.schema };

            return {
                name: mcpToolName,
                description: tool.description,
                parameters,
                execute: async (args: unknown) => {
                    try {
                        logDebug(`Executing tool ${key} with params: ${JSON.stringify(args)}`);
                        // Parse and validate the input using the tool's schema
                        const validatedArgs = tool.schema.parse(args);
                        const result = await tool.execute(validatedArgs);
                        logDebug(`Tool ${key} executed successfully`);
                        return {
                            content: [
                                {
                                    type: 'text' as const,
                                    text: JSON.stringify(result, null, 2),
                                },
                            ],
                        };
                    } catch (error) {
                        logError(`Error executing tool ${key}`, error);
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
                                    type: 'text' as const,
                                    text: mcpError.message,
                                },
                            ],
                        };
                    }
                },
            };
        });

        return mcpTools;
    } catch (error) {
        logError('Failed to convert Edwin tools to MCP format', error);
        throw error;
    }
}

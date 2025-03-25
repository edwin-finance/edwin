import { z } from 'zod';

declare module '@modelcontextprotocol/sdk' {
    /**
     * Starts an MCP server with the provided actions
     * @param actions Record of MCP actions
     * @param context Context object passed to action execute functions
     * @param options Server configuration options
     */
    export function startMcpServer(
        actions: Record<string, McpAction>,
        context: unknown,
        options?: McpServerConfig
    ): Promise<void>;
}

declare module 'zod-to-json-schema' {
    import { ZodSchema } from 'zod';

    /**
     * Converts a Zod schema to a JSON schema
     * @param schema Zod schema to convert
     * @param options Conversion options
     */
    export function zodToJsonSchema(
        schema: ZodSchema,
        options?: {
            name?: string;
            $refStrategy?: 'none' | 'string';
            [key: string]: unknown;
        }
    ): unknown;
}

export interface McpAction {
    description: string;
    parameters: Record<string, z.ZodType>;
    execute: (params: unknown) => Promise<unknown>;
}

export interface McpServerConfig {
    name?: string;
    version?: string;
    port?: number;
    autoApprove?: string[];
    middleware?: unknown[];
}

export interface McpServer {
    close: (callback: () => void) => void;
    listen: (port: number, callback?: () => void) => void;
}

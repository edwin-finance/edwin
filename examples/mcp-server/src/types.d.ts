declare module '@modelcontextprotocol/sdk' {
    /**
     * Starts an MCP server with the provided actions
     * @param actions Record of MCP actions
     * @param context Context object passed to action execute functions
     * @param options Server configuration options
     */
    export function startMcpServer(
        actions: Record<string, any>,
        context: any,
        options?: {
            name?: string;
            version?: string;
            port?: number;
            autoApprove?: string[];
        }
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
            [key: string]: any;
        }
    ): any;
}

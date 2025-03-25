/**
 * Authentication and approval handling for the Edwin MCP server
 */

import { Request as ExpressRequest, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthConfig as BaseAuthConfig } from './config';

/**
 * Configuration for authentication
 */
interface AuthRequest extends ExpressRequest {
    auth?: {
        apiKey?: string;
        origin?: string;
        [key: string]: unknown;
    };
    headers: {
        'x-api-key'?: string;
        origin?: string;
        [key: string]: string | undefined;
    };
}

const authConfigSchema = z.object({
    enabled: z.boolean(),
    apiKey: z.string().optional(),
    allowedOrigins: z.array(z.string()).optional(),
});

type AuthConfig = z.infer<typeof authConfigSchema> & BaseAuthConfig;

/**
 * Default authentication handler
 * @param request The incoming request
 * @returns Whether the request is authenticated
 */
export async function defaultAuthHandler(_request: AuthRequest): Promise<boolean> {
    // In a real implementation, this would check for valid authentication
    // For now, we'll allow all requests
    return true;
}

/**
 * Authentication middleware for MCP requests
 * @param config Authentication configuration
 * @param logger Logger function
 * @returns Authentication middleware function
 */
export function createAuthMiddleware(
    config: AuthConfig,
    _authFunction: (req: AuthRequest) => Promise<boolean>
): (req: AuthRequest, res: Response, next: NextFunction) => Promise<void> {
    const validatedConfig = authConfigSchema.parse(config);

    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        if (!validatedConfig.enabled) {
            next();
            return;
        }

        const apiKey = req.headers['x-api-key'] as string | undefined;
        const origin = req.headers.origin;

        if (validatedConfig.apiKey && apiKey !== validatedConfig.apiKey) {
            res.status(401).json({
                error: {
                    message: 'Invalid API key',
                    code: 'INVALID_API_KEY',
                },
            });
            return;
        }

        if (validatedConfig.allowedOrigins?.length && origin && !validatedConfig.allowedOrigins.includes(origin)) {
            res.status(401).json({
                error: {
                    message: 'Invalid origin',
                    code: 'INVALID_ORIGIN',
                },
            });
            return;
        }

        req.auth = {
            apiKey,
            origin,
        };

        next();
    };
}

/**
 * Default approval handler for tool execution
 * @param toolName Name of the tool being executed
 * @param params Parameters for the tool execution
 * @param autoApproveTools List of tools that are automatically approved
 * @returns Whether the tool execution is approved
 */
export async function defaultApprovalHandler(
    toolName: string,
    params: unknown,
    autoApproveTools: string[] = []
): Promise<boolean> {
    // Auto-approve tools in the list
    if (autoApproveTools.includes(toolName)) {
        return true;
    }

    // In a real implementation, this would prompt the user for approval
    // For now, we'll approve all requests
    return true;
}

/**
 * Creates an approval middleware for tool execution
 * @param config Authentication configuration
 * @param autoApproveTools List of tools that are automatically approved
 * @param logger Logger function
 * @returns Approval middleware function
 */
export function createApprovalMiddleware(
    _config: AuthConfig = { enabled: false },
    approvalFunction: (req: AuthRequest) => Promise<boolean>
): (req: AuthRequest, res: Response, next: NextFunction) => Promise<void> {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const isApproved = await approvalFunction(req);

            if (!isApproved) {
                res.status(403).json({
                    error: {
                        message: 'Tool execution not approved',
                        code: 'TOOL_NOT_APPROVED',
                    },
                });
                return;
            }

            next();
        } catch {
            res.status(500).json({
                error: {
                    message: 'Approval error',
                    code: 'APPROVAL_ERROR',
                },
            });
        }
    };
}

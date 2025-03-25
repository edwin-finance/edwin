/**
 * Error handler for the Edwin MCP server
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

/**
 * Custom error class for MCP server errors
 */
export class McpServerError extends Error {
    public readonly statusCode: number;
    public readonly details?: unknown;

    constructor(message: string, statusCode: number = 500, details?: unknown) {
        super(message);
        this.name = 'McpServerError';
        this.statusCode = statusCode;
        this.details = details;
    }
}

/**
 * Error for unauthorized access
 */
export class UnauthorizedError extends McpServerError {
    constructor(message: string = 'Unauthorized access', details?: unknown) {
        super(message, 401, details);
        this.name = 'UnauthorizedError';
    }
}

/**
 * Error for invalid parameters
 */
export class InvalidParametersError extends McpServerError {
    constructor(message: string = 'Invalid parameters', details?: unknown) {
        super(message, 400, details);
        this.name = 'InvalidParametersError';
    }
}

/**
 * Error for tool execution failures
 */
export class ToolExecutionError extends McpServerError {
    constructor(message: string = 'Tool execution failed', details?: unknown) {
        super(message, 500, details);
        this.name = 'ToolExecutionError';
    }
}

/**
 * Formats an error for MCP response
 * @param error Error to format
 * @returns Formatted error object
 */
export function formatErrorForMcp(error: unknown): {
    error: { type: string; message: string; details?: unknown };
    statusCode: number;
} {
    if (error instanceof McpServerError) {
        return {
            error: {
                type: error.name,
                message: error.message,
                details: error.details,
            },
            statusCode: error.statusCode,
        };
    }

    // Handle unknown errors
    return {
        error: {
            type: 'InternalServerError',
            message: error instanceof Error ? error.message : String(error),
        },
        statusCode: 500,
    };
}

/**
 * Global error handler for uncaught exceptions
 */
export function setupGlobalErrorHandlers(logger: (message: string, level: string) => void): void {
    process.on('uncaughtException', error => {
        logger(`Uncaught Exception: ${error.stack || error.message}`, 'error');
    });

    process.on('unhandledRejection', (reason, promise) => {
        logger(`Unhandled Rejection at: ${promise}, reason: ${reason}`, 'error');
    });
}

export class McpError extends Error {
    constructor(
        message: string,
        public statusCode: number = 500,
        public code?: string
    ) {
        super(message);
        this.name = 'McpError';
    }
}

export const handleError = (error: unknown, req: Request, res: Response, _next: NextFunction): void => {
    if (error instanceof McpError) {
        res.status(error.statusCode).json({
            error: {
                message: error.message,
                code: error.code || 'INTERNAL_ERROR',
            },
        });
        return;
    }

    if (error instanceof ZodError) {
        res.status(400).json({
            error: {
                message: 'Validation error',
                code: 'VALIDATION_ERROR',
                details: error.errors,
            },
        });
        return;
    }

    if (error instanceof Error) {
        res.status(500).json({
            error: {
                message: error.message,
                code: 'INTERNAL_ERROR',
            },
        });
        return;
    }

    res.status(500).json({
        error: {
            message: 'An unknown error occurred',
            code: 'UNKNOWN_ERROR',
        },
    });
};

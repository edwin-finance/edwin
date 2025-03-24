/**
 * Error handler for the Edwin MCP server
 */

/**
 * Custom error class for MCP server errors
 */
export class McpServerError extends Error {
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(message: string, statusCode: number = 500, details?: any) {
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
  constructor(message: string = 'Unauthorized access', details?: any) {
    super(message, 401, details);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Error for invalid parameters
 */
export class InvalidParametersError extends McpServerError {
  constructor(message: string = 'Invalid parameters', details?: any) {
    super(message, 400, details);
    this.name = 'InvalidParametersError';
  }
}

/**
 * Error for tool execution failures
 */
export class ToolExecutionError extends McpServerError {
  constructor(message: string = 'Tool execution failed', details?: any) {
    super(message, 500, details);
    this.name = 'ToolExecutionError';
  }
}

/**
 * Formats an error for MCP response
 * @param error Error to format
 * @returns Formatted error object
 */
export function formatErrorForMcp(error: any): any {
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
  process.on('uncaughtException', (error) => {
    logger(`Uncaught Exception: ${error.stack || error.message}`, 'error');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger(`Unhandled Rejection at: ${promise}, reason: ${reason}`, 'error');
  });
}

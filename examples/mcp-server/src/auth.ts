/**
 * Authentication and approval handling for the Edwin MCP server
 */

import { UnauthorizedError } from './errorHandler';

/**
 * Configuration for authentication
 */
export interface AuthConfig {
  /** Whether to require authentication for all requests */
  requireAuth?: boolean;
  /** Custom authentication function */
  authFunction?: (request: any) => Promise<boolean>;
  /** Custom approval function for tool execution */
  approvalFunction?: (toolName: string, params: any) => Promise<boolean>;
}

/**
 * Default authentication handler
 * @param request The incoming request
 * @returns Whether the request is authenticated
 */
export async function defaultAuthHandler(_request: any): Promise<boolean> {
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
  config: AuthConfig = {},
  logger: (message: string, level: string) => void
) {
  const requireAuth = config.requireAuth ?? false;
  const authFunction = config.authFunction ?? defaultAuthHandler;

  return async function authMiddleware(request: any): Promise<void> {
    if (!requireAuth) {
      return;
    }

    try {
      const isAuthenticated = await authFunction(request);
      
      if (!isAuthenticated) {
        logger('Authentication failed for request', 'warn');
        throw new UnauthorizedError('Authentication required');
      }
      
      logger('Request authenticated successfully', 'debug');
    } catch (error) {
      logger(`Authentication error: ${error}`, 'error');
      throw new UnauthorizedError('Authentication failed', { originalError: error });
    }
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
  params: any,
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
  config: AuthConfig = {},
  autoApproveTools: string[] = [],
  logger: (message: string, level: string) => void
) {
  const approvalFunction = config.approvalFunction ?? defaultApprovalHandler;

  return async function approvalMiddleware(
    toolName: string,
    params: any
  ): Promise<boolean> {
    try {
      const isApproved = await approvalFunction(toolName, params, autoApproveTools);
      
      if (!isApproved) {
        logger(`Tool execution not approved: ${toolName}`, 'warn');
        return false;
      }
      
      logger(`Tool execution approved: ${toolName}`, 'debug');
      return true;
    } catch (error) {
      logger(`Approval error for tool ${toolName}: ${error}`, 'error');
      return false;
    }
  };
}

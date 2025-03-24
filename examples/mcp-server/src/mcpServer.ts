import { startMcpServer } from '@modelcontextprotocol/sdk';
import { Edwin } from 'edwin-sdk';
import { EdwinTool } from 'edwin-sdk/src/core/types';
import { z } from 'zod';

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
 * Class that manages an MCP server for exposing Edwin tools to AI agents
 */
export class EdwinMcpServer {
  private edwin: Edwin;
  private config: Required<EdwinMcpServerConfig>;
  private isRunning: boolean = false;

  /**
   * Creates a new Edwin MCP server instance
   * @param edwin Initialized Edwin instance with wallets and plugins
   * @param config Server configuration options
   */
  constructor(
    edwin: Edwin,
    config: EdwinMcpServerConfig = {}
  ) {
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
      
      // Convert Edwin tools to MCP actions
      const mcpActions = this.convertEdwinToolsToMcpActions(edwinTools);
      
      // Configure auto-approve settings
      const autoApprove = this.config.autoApproveAll 
        ? Object.keys(mcpActions) 
        : this.config.autoApproveTools.map(tool => tool.toUpperCase());
      
      // Start the MCP server
      await startMcpServer(mcpActions, this.edwin, {
        name: this.config.name,
        version: this.config.version,
        port: this.config.port,
        autoApprove,
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
  private convertEdwinToolsToMcpActions(
    edwinTools: Record<string, EdwinTool>
  ): Record<string, any> {
    const mcpActions: Record<string, any> = {};
    
    for (const [key, tool] of Object.entries(edwinTools)) {
      // Convert tool name to uppercase for MCP convention
      const actionName = tool.name.toUpperCase();
      
      mcpActions[actionName] = {
        description: tool.description,
        parameters: tool.schema,
        execute: async (params: any) => {
          try {
            this.config.logger(`Executing tool ${tool.name} with params: ${JSON.stringify(params)}`, 'debug');
            const result = await tool.execute(params);
            this.config.logger(`Tool ${tool.name} executed successfully`, 'debug');
            return result;
          } catch (error) {
            this.config.logger(`Error executing tool ${tool.name}: ${error}`, 'error');
            throw error;
          }
        }
      };
    }
    
    return mcpActions;
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

/**
 * Tests for the Edwin MCP server adapter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EdwinMcpServer, EdwinMcpServerConfig } from '../index';
import { Edwin } from 'edwin-sdk';

// Mock the MCP SDK
vi.mock('@modelcontextprotocol/sdk', () => ({
  startMcpServer: vi.fn().mockResolvedValue(undefined),
}));

// Mock Edwin tools
const mockTools = {
  testTool: {
    name: 'test_tool',
    description: 'Test tool for MCP server',
    schema: {
      parse: vi.fn().mockImplementation((data) => data),
    },
    execute: vi.fn().mockResolvedValue({ success: true }),
  },
};

// Mock Edwin instance
const mockEdwin = {
  getTools: vi.fn().mockResolvedValue(mockTools),
} as unknown as Edwin;

describe('EdwinMcpServer', () => {
  let mcpServer: EdwinMcpServer;
  let config: EdwinMcpServerConfig;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup test configuration
    config = {
      name: 'test-mcp',
      port: 9999,
      autoApproveAll: true,
      logger: vi.fn(),
    };
    
    // Create server instance
    mcpServer = new EdwinMcpServer(mockEdwin, config);
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('should initialize with correct configuration', () => {
    expect(mcpServer).toBeDefined();
  });
  
  it('should start the MCP server successfully', async () => {
    const startMcpServer = await import('@modelcontextprotocol/sdk').then(
      (module) => module.startMcpServer
    );
    
    await mcpServer.start();
    
    // Verify Edwin.getTools was called
    expect(mockEdwin.getTools).toHaveBeenCalledTimes(1);
    
    // Verify startMcpServer was called with correct parameters
    expect(startMcpServer).toHaveBeenCalledTimes(1);
    expect(startMcpServer).toHaveBeenCalledWith(
      expect.any(Object),
      mockEdwin,
      expect.objectContaining({
        name: config.name,
        port: config.port,
        autoApprove: expect.any(Array),
      })
    );
  });
  
  it('should convert Edwin tools to MCP actions', async () => {
    const startMcpServer = await import('@modelcontextprotocol/sdk').then(
      (module) => module.startMcpServer
    );
    
    await mcpServer.start();
    
    // Get the actions passed to startMcpServer
    const mcpActions = (startMcpServer as any).mock.calls[0][0];
    
    // Verify the tool was converted to an MCP action
    expect(mcpActions).toHaveProperty('TEST_TOOL');
    expect(mcpActions.TEST_TOOL).toHaveProperty('description', mockTools.testTool.description);
    expect(mcpActions.TEST_TOOL).toHaveProperty('parameters');
    expect(mcpActions.TEST_TOOL).toHaveProperty('execute');
  });
  
  it('should handle tool execution errors', async () => {
    const error = new Error('Test execution error');
    mockTools.testTool.execute.mockRejectedValueOnce(error);
    
    const startMcpServer = await import('@modelcontextprotocol/sdk').then(
      (module) => module.startMcpServer
    );
    
    await mcpServer.start();
    
    // Get the actions passed to startMcpServer
    const mcpActions = (startMcpServer as any).mock.calls[0][0];
    
    // Execute the tool and expect it to throw
    await expect(mcpActions.TEST_TOOL.execute({})).rejects.toThrow(error);
  });
});

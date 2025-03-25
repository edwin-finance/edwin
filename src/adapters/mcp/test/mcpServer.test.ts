/**
 * Tests for the Edwin MCP server adapter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EdwinMcpServer, EdwinMcpServerConfig } from '../index';
import { Edwin } from '../../../client/edwin';
import { z } from 'zod';
import { McpAction } from '../types';
import { createMcpServer } from '../mcpServer';
import request from 'supertest';
import { Mock } from 'vitest';

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
            parse: vi.fn().mockImplementation(data => data),
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

    const _mockAction: McpAction = {
        description: 'Test action',
        parameters: {
            input: z.string(),
        },
        execute: async (params: unknown) => {
            const { input } = params as { input: string };
            return { output: input.toUpperCase() };
        },
    };

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
        const startMcpServer = await import('@modelcontextprotocol/sdk').then(module => module.startMcpServer);

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
        const startMcpServer = await import('@modelcontextprotocol/sdk').then(module => module.startMcpServer);

        await mcpServer.start();

        // Get the actions passed to startMcpServer
        const mcpActions = (startMcpServer as Mock).mock.calls[0][0];

        // Verify the tool was converted to an MCP action
        expect(mcpActions).toHaveProperty('TEST_TOOL');
        expect(mcpActions.TEST_TOOL).toHaveProperty('description', mockTools.testTool.description);
        expect(mcpActions.TEST_TOOL).toHaveProperty('parameters');
        expect(mcpActions.TEST_TOOL).toHaveProperty('execute');
    });

    it('should handle tool execution errors', async () => {
        const error = new Error('Test execution error');
        mockTools.testTool.execute.mockRejectedValueOnce(error);

        const startMcpServer = await import('@modelcontextprotocol/sdk').then(module => module.startMcpServer);

        await mcpServer.start();

        // Get the actions passed to startMcpServer
        const mcpActions = (startMcpServer as Mock).mock.calls[0][0];

        // Execute the tool and expect it to throw
        await expect(mcpActions.TEST_TOOL.execute({})).rejects.toThrow(error);
    });
});

describe('MCP Server', () => {
    const mockAction: McpAction = {
        description: 'Test action',
        parameters: {
            input: z.string(),
        },
        execute: async (params: unknown) => {
            const { input } = params as { input: string };
            return { output: input.toUpperCase() };
        },
    };

    let server: ReturnType<typeof createMcpServer>;
    let _actions: Record<string, McpAction>;

    beforeEach(() => {
        _actions = { test: mockAction };
        server = createMcpServer(_actions, {});
        server.listen(3000);
    });

    afterEach(() => {
        server.close(() => {});
    });

    it('should handle test action', async () => {
        const testInput = 'hello';
        const expectedOutput = await mockAction.execute({ input: testInput });
        expect(expectedOutput).toEqual({ output: 'HELLO' });

        const response = await request(server).post('/execute/test').send({ input: testInput });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            result: expectedOutput,
        });
    });

    it('should validate action parameters', async () => {
        const response = await request(server).post('/execute/test').send({ input: 123 });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
    });

    it('should handle unknown action', async () => {
        const response = await request(server).post('/execute/unknown').send({ input: 'hello' });

        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('error');
    });
});

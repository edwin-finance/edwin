import { tool } from '@langchain/core/tools';
import type { Edwin } from '../../client/index';
import type { EdwinTool } from '../../core/types';
import type { EdwinPlugin } from '../../core/classes';

export type GetEdwinToolsParams = {
    edwin: Edwin;
};

function createToolFromEdwinTool(edwinTool: EdwinTool) {
    return tool(
        async (args: unknown) => {
            try {
                const result = await edwinTool.execute(args);
                return JSON.stringify(result);
            } catch (error) {
                if (error instanceof Error) {
                    throw new Error(`${edwinTool.name} failed: ${error.message}`);
                }
                throw error;
            }
        },
        {
            name: edwinTool.name.toLowerCase(),
            description: edwinTool.description,
            schema: edwinTool.schema,
        }
    );
}

/**
 * Creates LangChain tools from a list of Edwin plugins
 */
export function getLangchainToolsFromPlugins(plugins: EdwinPlugin[]) {
    const tools = [];
    for (const plugin of plugins) {
        const pluginTools = plugin.getTools();
        for (const tool of Object.values(pluginTools)) {
            tools.push(createToolFromEdwinTool(tool));
        }
    }
    return tools;
}

/**
 * Converts Edwin actions to Langchain tools
 */
export async function getLangchainToolsFromEdwin({ edwin }: GetEdwinToolsParams) {
    const toolsRecord = await edwin.getTools();
    return Object.values(toolsRecord).map((tool: EdwinTool) => createToolFromEdwinTool(tool));
}

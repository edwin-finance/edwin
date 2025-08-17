import { tool } from '@langchain/core/tools';
import type { Edwin } from '../../client/index';
import type { EdwinTool } from '../../core/types';
import type { EdwinPlugin } from '../../core/classes';

export type GetEdwinToolsParams = {
    edwin: Edwin;
};

function createToolFromEdwinTool(edwinTool: EdwinTool) {
    // Using `any` here to avoid TS2589: "Type instantiation is excessively deep and possibly infinite".
    // This happens when passing Zod schemas into tool(), due to deep type inference.
    // See: https://github.com/colinhacks/zod/issues/577

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolConfig: any = {
        name: edwinTool.name.toLowerCase(),
        description: edwinTool.description,
        schema: edwinTool.schema,
    };

    return tool(async (args: unknown) => {
        try {
            const result = await edwinTool.execute(args);
            return JSON.stringify(result);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`${edwinTool.name} failed: ${error.message}`);
            }
            throw error;
        }
    }, toolConfig);
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

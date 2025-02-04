import { tool } from '@langchain/core/tools';
import type { EdwinAction } from '../types';
import type { Edwin } from './index';
import type { ActionMap } from './actions_client';

export type GetEdwinToolsParams = {
    edwin: Edwin;
};

/**
 * Creates a Langchain tool from an Edwin action
 */
function createEdwinTool(action: EdwinAction) {
    return tool(
        async (args: unknown) => {
            try {
                const result = await action.execute(args);
                return JSON.stringify(result);
            } catch (error) {
                if (error instanceof Error) {
                    throw new Error(`${action.name} failed: ${error.message}`);
                }
                throw error;
            }
        },
        {
            name: action.name.toLowerCase(),
            description: action.description,
            schema: action.schema,
        }
    );
}

/**
 * Converts Edwin actions to Langchain tools
 */
export async function getEdwinTools({ edwin }: GetEdwinToolsParams) {
    const actions = await edwin.getActions();
    return actions.map(createEdwinTool);
}

/**
 * Helper function to get a specific tool from the action map
 */
export function getEdwinTool(actions: ActionMap, actionName: string) {
    const action = actions[actionName];
    if (!action) {
        throw new Error(`Unsupported action: ${actionName}`);
    }
    return createEdwinTool(action);
}

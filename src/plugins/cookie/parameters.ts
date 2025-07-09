import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

export const AgentParametersSchema = createParameterSchema(
    z.object({
        username: z.string().nullable().optional().describe('Twitter username to search for'),
        contractAddress: z.string().nullable().optional().describe('Contract address to search for'),
        interval: z.enum(['_3Days', '_7Days']).describe('Time interval for data'),
        page: z.number().nullable().optional().describe('Page number for pagination'),
        pageSize: z.number().nullable().optional().describe('Number of items per page'),
    })
);

// Export clean parameter types
export type AgentParameters = typeof AgentParametersSchema.type;

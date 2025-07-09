import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

export const AgentParametersSchema = createParameterSchema(
    z.object({
        username: z.string().optional().nullable().describe('Twitter username to search for'),
        contractAddress: z.string().optional().nullable().describe('Contract address to search for'),
        interval: z.enum(['_3Days', '_7Days']).describe('Time interval for data'),
        page: z.number().optional().nullable().describe('Page number for pagination'),
        pageSize: z.number().optional().nullable().describe('Number of items per page'),
    })
);

// Export clean parameter types
export type AgentParameters = typeof AgentParametersSchema.type;

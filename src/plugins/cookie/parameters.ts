import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

export const AgentParametersSchema = createParameterSchema(
    z.object({
        username: z.string().optional().describe('Twitter username to search for'),
        contractAddress: z.string().optional().describe('Contract address to search for'),
        interval: z.enum(['_3Days', '_7Days']).describe('Time interval for data'),
        page: z.number().optional().describe('Page number for pagination'),
        pageSize: z.number().optional().describe('Number of items per page'),
    })
);

export const SearchParametersSchema = createParameterSchema(
    z.object({
        query: z.string().describe('Search query string'),
        from: z.string().describe('Start date for search range'),
        to: z.string().describe('End date for search range'),
    })
);

// Export clean parameter types
export type AgentParameters = typeof AgentParametersSchema.type;
export type SearchParameters = typeof SearchParametersSchema.type;

import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

export const StakeParametersSchema = createParameterSchema(
    z.object({
        asset: z.string().min(1).describe('The asset to stake'),
        amount: z.number().positive().describe('The amount to stake'),
    })
);

// Export clean parameter type
export type StakeParameters = typeof StakeParametersSchema.type;

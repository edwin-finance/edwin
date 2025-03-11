import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

export const SupplyParametersSchema = createParameterSchema(
    z.object({
        asset: z.string().min(1).describe('The asset to supply'),
        amount: z.number().positive().describe('The amount to supply'),
    })
);

export const WithdrawParametersSchema = createParameterSchema(
    z.object({
        asset: z.string().min(1).describe('The asset to withdraw'),
        amount: z.number().positive().describe('The amount to withdraw'),
    })
);

// Export clean parameter types
export type SupplyParameters = typeof SupplyParametersSchema.type;
export type WithdrawParameters = typeof WithdrawParametersSchema.type;

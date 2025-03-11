import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

export const LiquidityParametersSchema = createParameterSchema(
    z.object({
        chain: z.string().min(1).describe('The chain to interact with'),
        asset: z.string().min(1).describe('The first asset in the pair'),
        assetB: z.string().min(1).describe('The second asset in the pair'),
        amount: z.number().positive().describe('The amount of the first asset'),
        amountB: z.number().positive().describe('The amount of the second asset'),
    })
);

// Export clean parameter type
export type LiquidityParameters = typeof LiquidityParametersSchema.type;

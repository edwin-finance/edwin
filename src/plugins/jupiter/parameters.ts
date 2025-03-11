import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

export const SwapParametersSchema = createParameterSchema(
    z.object({
        inputMint: z.string().min(1).describe('The input token mint address'),
        outputMint: z.string().min(1).describe('The output token mint address'),
        amount: z.union([z.string(), z.number()]).describe('The amount to swap'),
    })
);

// Export clean parameter type
export type SwapParameters = typeof SwapParametersSchema.type;

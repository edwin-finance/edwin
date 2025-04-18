import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

export const SwapParametersSchema = createParameterSchema(
    z.object({
        inputMint: z.string().min(1).describe('The input token mint address'),
        outputMint: z.string().min(1).describe('The output token mint address'),
        amount: z.union([z.string(), z.number()]).describe('The amount to swap'),
    })
);

export const GetTokenAddressSchema = createParameterSchema(
    z.object({
        ticker: z.string().min(1).describe('The token ticker to lookup (case-sensitive, should be in UPPERCASE)'),
    })
);

// Export clean parameter types
export type SwapParameters = typeof SwapParametersSchema.type;
export type GetTokenAddressParameters = typeof GetTokenAddressSchema.type;

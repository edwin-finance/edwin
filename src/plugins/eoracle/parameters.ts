import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

export const PriceParametersSchema = createParameterSchema(
    z.object({
        symbol: z.string().min(1).describe('The symbol to get price information for'),
    })
);

// Export clean parameter type
export type PriceParameters = typeof PriceParametersSchema.type;

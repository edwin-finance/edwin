import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

export const SaucerSwapQuoteParametersSchema = createParameterSchema(
    z.object({
        inputTokenId: z.string().min(1).describe('The input token ID (use 0.0.1456986 for WHBAR)'),
        outputTokenId: z.string().min(1).describe('The output token ID'),
        amount: z.number().positive().describe('The amount of input tokens to quote'),
        network: z.enum(['mainnet', 'testnet']).optional().default('testnet').describe('The Hedera network to use'),
    })
);

export const SaucerSwapExactInputParametersSchema = createParameterSchema(
    z.object({
        inputTokenId: z.string().min(1).describe('The input token ID (use 0.0.1456986 for WHBAR)'),
        outputTokenId: z.string().min(1).describe('The output token ID'),
        amountIn: z.number().positive().describe('The exact amount of input tokens to swap'),
        amountOutMinimum: z.number().min(0).describe('The minimum amount of output tokens to receive'),
        deadline: z
            .number()
            .optional()
            .describe('Unix timestamp deadline for the swap (defaults to 20 minutes from now)'),
        network: z.enum(['mainnet', 'testnet']).optional().default('testnet').describe('The Hedera network to use'),
    })
);

export const SaucerSwapExactOutputParametersSchema = createParameterSchema(
    z.object({
        inputTokenId: z.string().min(1).describe('The input token ID (use 0.0.1456986 for WHBAR)'),
        outputTokenId: z.string().min(1).describe('The output token ID'),
        amountOut: z.number().positive().describe('The exact amount of output tokens to receive'),
        amountInMaximum: z.number().positive().describe('The maximum amount of input tokens to spend'),
        deadline: z
            .number()
            .optional()
            .describe('Unix timestamp deadline for the swap (defaults to 20 minutes from now)'),
        network: z.enum(['mainnet', 'testnet']).optional().default('testnet').describe('The Hedera network to use'),
    })
);

// Export clean parameter types
export type SaucerSwapQuoteParameters = typeof SaucerSwapQuoteParametersSchema.type;
export type SaucerSwapExactInputParameters = typeof SaucerSwapExactInputParametersSchema.type;
export type SaucerSwapExactOutputParameters = typeof SaucerSwapExactOutputParametersSchema.type;

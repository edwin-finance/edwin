import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

export const SaucerSwapQuoteParametersSchema = createParameterSchema(
    z.object({
        inputTokenId: z
            .string()
            .min(1)
            .describe(
                'The input token ID. Mainnet: use 0.0.1456986 for WHBAR, 0.0.456858 for USDC, 0.0.731861 for SAUCE. Note: Use WHBAR token ID (not "HBAR" string) for quote operations.'
            ),
        outputTokenId: z
            .string()
            .min(1)
            .describe(
                'The output token ID. Mainnet: use 0.0.1456986 for WHBAR, 0.0.456858 for USDC, 0.0.731861 for SAUCE'
            ),
        amount: z.number().positive().describe('The amount of input tokens to quote'),
        network: z.enum(['mainnet', 'testnet']).optional().default('mainnet').describe('The Hedera network to use'),
    })
);

export const SaucerSwapQuoteExactOutputParametersSchema = createParameterSchema(
    z.object({
        inputTokenId: z
            .string()
            .min(1)
            .describe(
                'The input token ID. Mainnet: use 0.0.1456986 for WHBAR, 0.0.456858 for USDC, 0.0.731861 for SAUCE. Note: Use WHBAR token ID (not "HBAR" string) for quote operations.'
            ),
        outputTokenId: z
            .string()
            .min(1)
            .describe(
                'The output token ID. Mainnet: use 0.0.1456986 for WHBAR, 0.0.456858 for USDC, 0.0.731861 for SAUCE'
            ),
        amountOut: z.number().positive().describe('The exact amount of output tokens to quote'),
        network: z.enum(['mainnet', 'testnet']).optional().default('mainnet').describe('The Hedera network to use'),
    })
);

export const SaucerSwapExactInputParametersSchema = createParameterSchema(
    z.object({
        inputTokenId: z
            .string()
            .min(1)
            .describe(
                'The input token ID. For swaps: use "HBAR" for native HBAR, or token IDs like 0.0.456858 for USDC, 0.0.731861 for SAUCE. Note: For quotes, use WHBAR token ID (0.0.1456986) instead of "HBAR".'
            ),
        outputTokenId: z
            .string()
            .min(1)
            .describe(
                'The output token ID. Mainnet: use 0.0.456858 for USDC, 0.0.731861 for SAUCE, 0.0.1456986 for WHBAR. For receiving HBAR, use "HBAR".'
            ),
        amountIn: z.number().positive().describe('The exact amount of input tokens to swap'),
        amountOutMinimum: z.number().min(0).describe('The minimum amount of output tokens to receive'),
        deadline: z
            .number()
            .optional()
            .describe('Unix timestamp deadline for the swap (defaults to 1 hour from now). Must be in the future.'),
        network: z.enum(['mainnet', 'testnet']).optional().default('mainnet').describe('The Hedera network to use'),
    })
);

export const SaucerSwapExactOutputParametersSchema = createParameterSchema(
    z.object({
        inputTokenId: z
            .string()
            .min(1)
            .describe(
                'The input token ID. For swaps: use "HBAR" for native HBAR, or token IDs like 0.0.456858 for USDC, 0.0.731861 for SAUCE'
            ),
        outputTokenId: z
            .string()
            .min(1)
            .describe(
                'The output token ID. Mainnet: use 0.0.456858 for USDC, 0.0.731861 for SAUCE, 0.0.1456986 for WHBAR. For receiving HBAR, use "HBAR".'
            ),
        amountOut: z.number().positive().describe('The exact amount of output tokens to receive'),
        amountInMaximum: z.number().positive().describe('The maximum amount of input tokens to spend'),
        deadline: z
            .number()
            .optional()
            .describe('Unix timestamp deadline for the swap (defaults to 1 hour from now). Must be in the future.'),
        network: z.enum(['mainnet', 'testnet']).optional().default('mainnet').describe('The Hedera network to use'),
    })
);

// Export clean parameter types
export type SaucerSwapQuoteParameters = typeof SaucerSwapQuoteParametersSchema.type;
export type SaucerSwapQuoteExactOutputParameters = typeof SaucerSwapQuoteExactOutputParametersSchema.type;
export type SaucerSwapExactInputParameters = typeof SaucerSwapExactInputParametersSchema.type;
export type SaucerSwapExactOutputParameters = typeof SaucerSwapExactOutputParametersSchema.type;

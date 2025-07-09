import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

// Schema for checking wallet balance on EVM chains
export const EVMBalanceParametersSchema = createParameterSchema(
    z.object({
        walletAddress: z.string().describe('The EVM wallet address to check the balance of'),
        chainName: z.string().describe('The chain name (e.g., "mainnet", "base", "optimism", "arbitrum")'),
        tokenAddress: z
            .string()
            .nullable()
            .optional()
            .describe('The optional ERC-20 token address (or empty for native token balance)'),
    })
);

// Schema for checking current wallet balance
export const CurrentEVMBalanceParametersSchema = createParameterSchema(
    z.object({
        chainName: z
            .string()
            .nullable()
            .optional()
            .describe('The chain name (defaults to current chain if not specified)'),
        tokenAddress: z
            .string()
            .nullable()
            .optional()
            .describe('The optional ERC-20 token address (or empty for native token balance)'),
    })
);

// Export clean parameter types
export type EVMBalanceParameters = typeof EVMBalanceParametersSchema.type;
export type CurrentEVMBalanceParameters = typeof CurrentEVMBalanceParametersSchema.type;

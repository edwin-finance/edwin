import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

export const SearchParametersSchema = createParameterSchema(
    z.object({
        query: z.string().min(1).describe('Search query for pairs matching the query'),
    })
);

export const PairParametersSchema = createParameterSchema(
    z.object({
        chainId: z.string().min(1).describe('Chain ID (e.g., "ethereum", "solana")'),
        pairId: z.string().min(1).describe('Pair address'),
    })
);

export const TokenPairsParametersSchema = createParameterSchema(
    z.object({
        chainId: z.string().min(1).describe('Chain ID (e.g., "ethereum", "solana")'),
        tokenAddress: z.string().min(1).describe('Token address'),
    })
);

export const TokensParametersSchema = createParameterSchema(
    z.object({
        chainId: z.string().min(1).describe('Chain ID (e.g., "ethereum", "solana")'),
        tokenAddresses: z.string().min(1).describe('Comma-separated token addresses (up to 30)'),
    })
);

// Schema for token orders
export const TokenOrdersParametersSchema = createParameterSchema(
    z.object({
        chainId: z.string().min(1).describe('Chain ID (e.g., "ethereum", "solana")'),
        tokenAddress: z.string().min(1).describe('Token address'),
    })
);

// Export clean parameter types
export type SearchParameters = typeof SearchParametersSchema.type;
export type PairParameters = typeof PairParametersSchema.type;
export type TokenPairsParameters = typeof TokenPairsParametersSchema.type;
export type TokensParameters = typeof TokensParametersSchema.type;
export type TokenOrdersParameters = typeof TokenOrdersParametersSchema.type;
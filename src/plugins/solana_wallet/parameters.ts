import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

// Schema for checking wallet balance on Solana
export const SolanaWalletTokenBalanceParametersSchema = createParameterSchema(
    z.object({
        walletAddress: z.string().describe('The Solana wallet address to check the balance of'),
        mintAddress: z
            .string()
            .nullable()
            .optional()
            .describe('The optional SPL token mint address (or empty for SOL balance)'),
    })
);

export const CurrentSolanaWalletTokenBalanceParametersSchema = createParameterSchema(
    z.object({
        mintAddress: z
            .string()
            .nullable()
            .optional()
            .describe('The optional SPL token mint address (or empty for SOL balance)'),
    })
);

// Schema for getting all token balances for a wallet
export const SolanaWalletBalancesParametersSchema = createParameterSchema(
    z.object({
        walletAddress: z.string().describe('The Solana wallet address to check all token balances for'),
    })
);

// Schema for getting all token balances for the current wallet
export const CurrentSolanaWalletBalancesParametersSchema = createParameterSchema(
    z.object({}).describe('No parameters needed')
);

// Export clean parameter types
export type SolanaWalletTokenBalanceParameters = typeof SolanaWalletTokenBalanceParametersSchema.type;
export type CurrentSolanaWalletTokenBalanceParameters = typeof CurrentSolanaWalletTokenBalanceParametersSchema.type;
export type SolanaWalletBalancesParameters = typeof SolanaWalletBalancesParametersSchema.type;
export type CurrentSolanaWalletBalancesParameters = typeof CurrentSolanaWalletBalancesParametersSchema.type;

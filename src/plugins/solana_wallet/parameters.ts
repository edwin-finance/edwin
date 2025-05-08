import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

// Schema for checking wallet balance on Solana
export const SolanaBalanceParametersSchema = createParameterSchema(
    z.object({
        walletAddress: z.string().describe('The Solana wallet address to check the balance of'),
        mintAddress: z.string().optional().describe('The optional SPL token mint address (or empty for SOL balance)'),
    })
);

// Schema for getting all token balances for a wallet
export const SolanaWalletBalancesParametersSchema = createParameterSchema(
    z.object({
        walletAddress: z.string().describe('The Solana wallet address to check all token balances for'),
    })
);

// Schema for getting all token balances for the current wallet
export const CurrentWalletBalancesParametersSchema = createParameterSchema(
    z.object({}).describe('No parameters needed')
);

// Export clean parameter types
export type SolanaBalanceParameters = typeof SolanaBalanceParametersSchema.type;
export type SolanaWalletBalancesParameters = typeof SolanaWalletBalancesParametersSchema.type;
export type CurrentWalletBalancesParameters = typeof CurrentWalletBalancesParametersSchema.type;

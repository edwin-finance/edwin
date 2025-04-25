import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

// Schema for checking wallet balance on Solana
export const SolanaBalanceParametersSchema = createParameterSchema(
    z.object({
        walletAddress: z.string().describe('The Solana wallet address to check the balance of'),
        mintAddress: z.string().optional().describe('The optional SPL token mint address (or empty for SOL balance)'),
    })
);

// Export clean parameter types
export type SolanaBalanceParameters = typeof SolanaBalanceParametersSchema.type;

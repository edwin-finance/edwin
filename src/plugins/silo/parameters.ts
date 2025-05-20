import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

/**
 * Parameters for supplying assets to Silo protocol
 */
export const SupplyParametersSchema = createParameterSchema(
    z.object({
        chain: z.string().min(1).describe('The chain to supply assets on (e.g., sonic)'),
        asset: z.string().min(1).describe('The asset to supply (e.g., USDC.e)'),
        amount: z.number().positive().describe('The amount to supply'),
        collateralOnly: z.boolean().optional().describe('True if depositing collateral only'),
    })
);

/**
 * Parameters for withdrawing assets from Silo protocol
 */
export const WithdrawParametersSchema = createParameterSchema(
    z.object({
        chain: z.string().min(1).describe('The chain to withdraw assets from (e.g., sonic)'),
        asset: z.string().min(1).describe('The asset to withdraw (e.g., USDC.e)'),
        amount: z.number().positive().describe('The amount to withdraw'),
    })
);

// Export clean parameter types
export type SupplyParameters = typeof SupplyParametersSchema.type;
export type WithdrawParameters = typeof WithdrawParametersSchema.type;

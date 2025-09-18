import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

export const BonzoSupplyParametersSchema = createParameterSchema(
    z.object({
        tokenSymbol: z.string().min(1).describe('The token symbol to supply (e.g., WHBAR, USDC, SAUCE)'),
        amount: z.number().positive().describe('The amount of tokens to supply to Bonzo Finance'),
        network: z.enum(['mainnet', 'testnet']).optional().default('testnet').describe('The Hedera network to use'),
    })
);

export const BonzoWithdrawParametersSchema = createParameterSchema(
    z.object({
        tokenSymbol: z.string().min(1).describe('The token symbol to withdraw (e.g., WHBAR, USDC, SAUCE)'),
        amount: z.number().positive().describe('The amount of tokens to withdraw from Bonzo Finance'),
        network: z.enum(['mainnet', 'testnet']).optional().default('testnet').describe('The Hedera network to use'),
    })
);

export const BonzoBorrowParametersSchema = createParameterSchema(
    z.object({
        tokenSymbol: z.string().min(1).describe('The token symbol to borrow (e.g., WHBAR, USDC, SAUCE)'),
        amount: z.number().positive().describe('The amount of tokens to borrow from Bonzo Finance'),
        network: z.enum(['mainnet', 'testnet']).optional().default('testnet').describe('The Hedera network to use'),
    })
);

export const BonzoGetSuppliedBalanceParametersSchema = createParameterSchema(
    z.object({
        tokenSymbol: z.string().min(1).describe('The token symbol to check supplied balance for'),
        network: z.enum(['mainnet', 'testnet']).optional().default('testnet').describe('The Hedera network to use'),
    })
);

export const CurrentBonzoGetSuppliedBalanceParametersSchema = createParameterSchema(
    z.object({
        tokenSymbol: z.string().min(1).describe('The token symbol to check supplied balance for'),
    })
);

// Export clean parameter types
export type BonzoSupplyParameters = typeof BonzoSupplyParametersSchema.type;
export type BonzoWithdrawParameters = typeof BonzoWithdrawParametersSchema.type;
export type BonzoBorrowParameters = typeof BonzoBorrowParametersSchema.type;
export type BonzoGetSuppliedBalanceParameters = typeof BonzoGetSuppliedBalanceParametersSchema.type;
export type CurrentBonzoGetSuppliedBalanceParameters = typeof CurrentBonzoGetSuppliedBalanceParametersSchema.type;

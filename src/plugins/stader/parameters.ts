import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

export const StaderStakeParametersSchema = createParameterSchema(
    z.object({
        amount: z.number().positive().describe('The amount of HBAR to stake for HBARX'),
        network: z.literal('mainnet').optional().default('mainnet').describe('The Hedera network to use'),
    })
);

export const StaderUnstakeParametersSchema = createParameterSchema(
    z.object({
        amount: z.number().positive().describe('The amount of HBARX to unstake'),
        network: z.literal('mainnet').optional().default('mainnet').describe('The Hedera network to use'),
    })
);

export const StaderWithdrawParametersSchema = createParameterSchema(
    z.object({
        unstakeIndex: z.number().min(0).describe('The unstake index to withdraw'),
        network: z.literal('mainnet').optional().default('mainnet').describe('The Hedera network to use'),
    })
);

export const StaderGetBalanceParametersSchema = createParameterSchema(
    z.object({
        network: z.literal('mainnet').optional().default('mainnet').describe('The Hedera network to use'),
    })
);

export const CurrentStaderGetBalanceParametersSchema = createParameterSchema(z.object({}));

// Export clean parameter types
export type StaderStakeParameters = typeof StaderStakeParametersSchema.type;
export type StaderUnstakeParameters = typeof StaderUnstakeParametersSchema.type;
export type StaderWithdrawParameters = typeof StaderWithdrawParametersSchema.type;
export type StaderGetBalanceParameters = typeof StaderGetBalanceParametersSchema.type;
export type CurrentStaderGetBalanceParameters = typeof CurrentStaderGetBalanceParametersSchema.type;

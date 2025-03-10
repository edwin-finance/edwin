import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

export const AddLiquidityParametersSchema = createParameterSchema(
    z.object({
        amount: z.number().positive().describe('The amount of token A to add as liquidity'),
        amountB: z.number().positive().describe('The amount of token B to add as liquidity'),
        poolAddress: z.string().min(1).describe('The address of the Meteora pool'),
        rangeInterval: z.number().optional().describe('The price range interval for concentrated liquidity'),
    })
);

export const RemoveLiquidityParametersSchema = createParameterSchema(
    z.object({
        poolAddress: z.string().min(1).describe('The address of the Meteora pool'),
        positionAddress: z.string().optional().describe('The address of the liquidity position to remove'),
        shouldClosePosition: z.boolean().optional().describe('Whether to completely close the position'),
    })
);

export const PoolParametersSchema = createParameterSchema(
    z.object({
        poolAddress: z.string().min(1).describe('The address of the Meteora pool'),
    })
);

export const GetPoolsParametersSchema = createParameterSchema(
    z.object({
        asset: z.string().min(1).describe('The first asset in the pool'),
        assetB: z.string().min(1).describe('The second asset in the pool'),
    })
);

// Export clean parameter types without the "Type" suffix
export type AddLiquidityParameters = typeof AddLiquidityParametersSchema.type;
export type RemoveLiquidityParameters = typeof RemoveLiquidityParametersSchema.type;
export type PoolParameters = typeof PoolParametersSchema.type;
export type GetPoolsParameters = typeof GetPoolsParametersSchema.type;

import { z } from 'zod';

/**
 * Supported order types for HyperLiquid
 */
export enum OrderType {
    MARKET = 'market',
    LIMIT = 'limit',
}

/**
 * Supported position types for HyperLiquid
 */
export enum PositionType {
    LONG = 'long',
    SHORT = 'short',
}

/**
 * Parameters for depositing funds to HyperLiquid
 */
export const DepositParameters = z.object({
    /**
     * Amount to deposit
     */
    amount: z.number().positive(),
    /**
     * Asset to deposit (e.g., 'ETH', 'USDC')
     */
    asset: z.string(),
});

/**
 * Type definition for deposit parameters
 */
export type DepositParametersType = z.infer<typeof DepositParameters>;

/**
 * Parameters for withdrawing funds from HyperLiquid
 */
export const WithdrawParameters = z.object({
    /**
     * Amount to withdraw
     */
    amount: z.number().positive(),
    /**
     * Asset to withdraw (e.g., 'ETH', 'USDC')
     */
    asset: z.string(),
});

/**
 * Type definition for withdraw parameters
 */
export type WithdrawParametersType = z.infer<typeof WithdrawParameters>;

/**
 * Parameters for opening a position on HyperLiquid
 */
export const OpenPositionParameters = z.object({
    /**
     * Asset to trade (e.g., 'BTC', 'ETH')
     */
    asset: z.string(),
    /**
     * Position type (long or short)
     */
    positionType: z.nativeEnum(PositionType),
    /**
     * Order type (market or limit)
     */
    orderType: z.nativeEnum(OrderType),
    /**
     * Size of the position in USD
     */
    size: z.number().positive(),
    /**
     * Leverage to use (e.g., 1, 2, 5, 10, 20)
     */
    leverage: z.number().positive().default(1),
    /**
     * Limit price (required for limit orders)
     */
    price: z.number().positive().optional(),
    /**
     * Whether to reduce only (close position)
     */
    reduceOnly: z.boolean().default(false),
});

/**
 * Type definition for open position parameters
 */
export type OpenPositionParametersType = z.infer<typeof OpenPositionParameters>;

/**
 * Parameters for closing a position on HyperLiquid
 */
export const ClosePositionParameters = z.object({
    /**
     * Asset to close position for (e.g., 'BTC', 'ETH')
     */
    asset: z.string(),
    /**
     * Order type (market or limit)
     */
    orderType: z.nativeEnum(OrderType),
    /**
     * Percentage of position to close (0-100)
     */
    percentage: z.number().min(0).max(100).default(100),
    /**
     * Limit price (required for limit orders)
     */
    price: z.number().positive().optional(),
});

/**
 * Type definition for close position parameters
 */
export type ClosePositionParametersType = z.infer<typeof ClosePositionParameters>;

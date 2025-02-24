export interface AddLiquidityParameters {
    poolAddress?: string;
    amount: string;
    amountB: string;
    rangeInterval?: number;
}

export interface RemoveLiquidityParameters {
    poolAddress: string;
    positionAddress?: string;
    shouldClosePosition?: boolean;
}

export interface PoolParameters {
    poolAddress: string;
}

export interface GetPoolsParameters {
    asset: string;
    assetB: string;
}

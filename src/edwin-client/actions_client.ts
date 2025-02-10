import { EdwinAction } from '../types';
import {
    SupplyAction,
    WithdrawAction,
    StakeAction,
    AddLiquidityAction,
    GetPoolsAction,
    GetPositionsAction,
    RemoveLiquidityAction,
    SwapAction,
    GetAgentByTwitterAction,
    GetAgentByContractAction,
    GetAgentsPagedAction,
    SearchTweetsAction,
    GetActiveBinAction,
} from '../edwin-core/actions';
import { Edwin } from '.';

export const ACTION_MAP: Record<string, new (edwin: any) => EdwinAction> = {
    supply: SupplyAction,
    withdraw: WithdrawAction,
    stake: StakeAction,
    addLiquidity: AddLiquidityAction,
    getPools: GetPoolsAction,
    removeLiquidity: RemoveLiquidityAction,
    getPositions: GetPositionsAction,
    getActiveBin: GetActiveBinAction,
    swap: SwapAction,
    getAgentByTwitter: GetAgentByTwitterAction,
    getAgentByContract: GetAgentByContractAction,
    getAgentsPaged: GetAgentsPagedAction,
    searchTweets: SearchTweetsAction,
};

export type SupportedActions = keyof typeof ACTION_MAP;
export type ActionMap = {
    [K in SupportedActions]: InstanceType<(typeof ACTION_MAP)[K]>;
};

export function initializeActions(edwin: Edwin, enabledActions: string[]): ActionMap {
    return enabledActions.reduce((acc, actionName) => {
        const ActionClass = ACTION_MAP[actionName as SupportedActions];
        if (!ActionClass) {
            throw new Error(`Unsupported action: ${actionName}`);
        }
        return {
            ...acc,
            [actionName]: new ActionClass(edwin),
        };
    }, {} as ActionMap);
}

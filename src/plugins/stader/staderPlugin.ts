import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { StaderService } from './staderService';
import { HederaWalletClient, canSign } from '../../core/wallets/hedera_wallet';
import {
    StaderStakeParametersSchema,
    StaderUnstakeParametersSchema,
    StaderWithdrawParametersSchema,
    StaderGetBalanceParametersSchema,
    CurrentStaderGetBalanceParametersSchema,
    StaderStakeParameters,
    StaderUnstakeParameters,
    StaderWithdrawParameters,
    StaderGetBalanceParameters,
    CurrentStaderGetBalanceParameters,
} from './parameters';

export class StaderPlugin extends EdwinPlugin {
    constructor(private wallet: HederaWalletClient) {
        super('stader', [new StaderService(wallet)]);
    }

    getTools(): Record<string, EdwinTool> {
        return {
            ...this.getPublicTools(),
            ...this.getPrivateTools(),
        };
    }

    getPublicTools(): Record<string, EdwinTool> {
        const staderService = this.toolProviders.find(provider => provider instanceof StaderService) as StaderService;

        return {
            getStaderStakedBalance: {
                name: 'get_stader_staked_balance',
                description: 'Get the current HBARX balance (staked HBAR) for a specific network',
                schema: StaderGetBalanceParametersSchema.schema,
                execute: async (params: StaderGetBalanceParameters) => {
                    return await staderService.getStakedBalanceByNetwork(params);
                },
            },
            getCurrentStaderStakedBalance: {
                name: 'get_current_stader_staked_balance',
                description: 'Get the current HBARX balance (staked HBAR) for your connected wallet',
                schema: CurrentStaderGetBalanceParametersSchema.schema,
                execute: async (_params: CurrentStaderGetBalanceParameters) => {
                    return await staderService.getStakedBalance();
                },
            },
        };
    }

    getPrivateTools(): Record<string, EdwinTool> {
        if (!canSign(this.wallet)) {
            return {};
        }

        const staderService = this.toolProviders.find(provider => provider instanceof StaderService) as StaderService;

        return {
            staderStake: {
                name: 'stader_stake_hbar',
                description: 'Stake HBAR to receive HBARX tokens through Stader protocol',
                schema: StaderStakeParametersSchema.schema,
                execute: async (params: StaderStakeParameters) => {
                    return await staderService.stake(params);
                },
            },
            staderUnstake: {
                name: 'stader_unstake_hbarx',
                description: 'Unstake HBARX tokens to initiate withdrawal process (requires 24-hour unbonding period)',
                schema: StaderUnstakeParametersSchema.schema,
                execute: async (params: StaderUnstakeParameters) => {
                    return await staderService.unstake(params);
                },
            },
            staderWithdraw: {
                name: 'stader_withdraw_hbar',
                description: 'Withdraw HBAR after unstaking period has completed (24 hours)',
                schema: StaderWithdrawParametersSchema.schema,
                execute: async (params: StaderWithdrawParameters) => {
                    return await staderService.withdraw(params);
                },
            },
        };
    }

    supportsChain = (chain: Chain) => chain.type === 'hedera';
}

export const stader = (wallet: HederaWalletClient) => new StaderPlugin(wallet);

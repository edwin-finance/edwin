import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { LidoProtocol } from './lidoProtocol';
import { EdwinEVMWallet } from '../../core/wallets';
import { StakeParametersSchema, StakeParameters } from './parameters';

export class LidoPlugin extends EdwinPlugin {
    constructor(wallet: EdwinEVMWallet) {
        super('lido', [new LidoProtocol(wallet)]);
    }

    getTools(): Record<string, EdwinTool> {
        // Combine public and private tools
        return {
            ...this.getPublicTools(),
            ...this.getPrivateTools(),
        };
    }

    getPublicTools(): Record<string, EdwinTool> {
        // Lido has no public tools
        return {};
    }

    getPrivateTools(): Record<string, EdwinTool> {
        const lidoProtocol = this.toolProviders.find(provider => provider instanceof LidoProtocol) as LidoProtocol;

        return {
            lidoStake: {
                name: 'lido_stake',
                description: 'Stake ETH in Lido',
                schema: StakeParametersSchema.schema,
                execute: async (params: StakeParameters) => {
                    return await lidoProtocol.stake(params);
                },
            },
            lidoUnstake: {
                name: 'lido_unstake',
                description: 'Unstake ETH from Lido',
                schema: StakeParametersSchema.schema,
                execute: async (params: StakeParameters) => {
                    return await lidoProtocol.unstake(params);
                },
            },
            lidoClaimRewards: {
                name: 'lido_claim_rewards',
                description: 'Claim staking rewards from Lido',
                schema: StakeParametersSchema.schema,
                execute: async (params: StakeParameters) => {
                    return await lidoProtocol.claimRewards(params);
                },
            },
        };
    }

    supportsChain = (chain: Chain) => chain.type === 'evm';
}

export const lido = (wallet: EdwinEVMWallet) => new LidoPlugin(wallet);

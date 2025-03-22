import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { z } from 'zod';
import { RenzoProtocol } from './renzoProtocol';
import { EdwinEVMWallet } from '../../core/wallets';
import { StakeParameters, ClaimParameters } from './parameters';

export class RenzoPlugin extends EdwinPlugin {
    constructor(wallet: EdwinEVMWallet) {
        super('renzo', [new RenzoProtocol(wallet)]);
    }

    getTools(): Record<string, EdwinTool> {
        const renzoProtocol = this.toolProviders.find(provider => provider instanceof RenzoProtocol) as RenzoProtocol;

        return {
            renzoStake: {
                name: 'renzo_stake',
                description: 'Stake ETH in Renzo Protocol',
                schema: z.object({
                    chain: z.string().min(1),
                    amount: z.number().positive(),
                }),
                execute: async (params: StakeParameters) => {
                    return await renzoProtocol.stake(params);
                },
            },
            renzoClaim: {
                name: 'renzo_claim',
                description: 'Request withdrawal/claim of ETH from Renzo Protocol',
                schema: z.object({
                    chain: z.string().min(1),
                }),
                execute: async (params: ClaimParameters) => {
                    return await renzoProtocol.claim(params);
                },
            },
        };
    }

    supportsChain = (chain: Chain) => chain.type === 'evm';
}

export const renzo = (wallet: EdwinEVMWallet) => new RenzoPlugin(wallet);

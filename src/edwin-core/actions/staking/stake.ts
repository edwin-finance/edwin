import type { EdwinAction, StakeParams } from '../../../types';
import { Edwin } from '../../../edwin-client';
import { z } from 'zod';
import edwinLogger from '../../../utils/logger';

export const stakeTemplate = `You are an AI assistant specialized in processing DeFi staking requests. Your task is to extract specific information from user messages and format it into a structured JSON response.

....

`;

export class StakeAction implements EdwinAction {
    public name = 'STAKE';
    public description = 'Stake assets to a staking protocol';
    public template = stakeTemplate;
    public edwin: Edwin;
    public schema = z.object({
        protocol: z.string(),
        chain: z.string(),
        asset: z.string(),
        amount: z.string(),
    });

    constructor(edwin: Edwin) {
        this.edwin = edwin;
    }

    async execute(params: StakeParams): Promise<string> {
        edwinLogger.info(`Staking: ${params.amount} ${params.asset} on ${params.chain})`);

        throw new Error('Not implemented');
    }
}

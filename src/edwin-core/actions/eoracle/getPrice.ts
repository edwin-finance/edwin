import { z } from 'zod';
import { Edwin } from '../../../edwin-client';
import { EdwinAction, IEOracleProtocol } from '../../../types';

const getPriceTemplate = `You are an AI assistant specialized in getting price data from EOracleSystem. Your task is to extract the trading pair symbol from user messages and format it into a structured JSON response.

First, review the recent messages from the conversation:

<recent_messages>
{{recentMessages}}
</recent_messages>

Your goal is to extract:
1. Trading pair symbol (e.g. "BTC/USD", "ETH/USD")

This must be your only output and it should be in JSON format:

\`\`\`json
{
    "symbol": string
}
\`\`\`
`;

export class GetPriceAction implements EdwinAction {
    name = 'GET_PRICE';
    description = 'Retrieves the latest price data and signature for a specific trading pair from EOracleSystem';
    template = getPriceTemplate;
    edwin: Edwin;
    schema = z.object({
        symbol: z.string().describe('Trading pair symbol (e.g. "BTC/USD", "ETH/USD")'),
    });

    constructor(edwin: Edwin) {
        this.edwin = edwin;
    }

    async execute(params: any): Promise<string> {
        const protocol = this.edwin.protocols['eoracle'] as IEOracleProtocol;
        if (!protocol) {
            throw new Error('EOracleSystem protocol not found');
        }
        return await protocol.getPrice(params.symbol);
    }
} 
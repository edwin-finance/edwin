import { config } from 'dotenv';
config(); // Load test environment variables from .env file

import { describe, it } from 'vitest';
import { Edwin, EdwinConfig } from '../src';

// Meteora test
describe('Meteora test', () => {
    it('should initialize Edwin with solana config', async () => {
        const edwinConfig: EdwinConfig = {
            solanaPrivateKey: process.env.SOLANA_PRIVATE_KEY,
            actions: ['addLiquidity', 'getPools']
        };
        const edwin = new Edwin(edwinConfig);
        const results = await edwin.actions.getPools.execute({
            asset: 'sol',
            assetB: 'usdc',
            protocol: 'meteora'
        });
        console.log("🚀 ~ it ~ result:", results)
        const topPoolAddress = results[0].address;

        const result = await edwin.actions.addLiquidity.execute({
            poolAddress: topPoolAddress,
            asset: 'sol',
            assetB: 'usdc',
            amount: '0.001',
            amountB: '1',
            protocol: 'meteora',
            chain: 'solana'
        });
        console.log("🚀 ~ it ~ result:", result)
    }, 120000); // 120 second timeout
});

import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { SolanaWalletService } from './solanaWalletService';
import { EdwinSolanaPublicKeyWallet } from '../../core/wallets/solana_wallet';
import {
    SolanaBalanceParameters,
    SolanaBalanceParametersSchema,
    SolanaWalletBalancesParameters,
    SolanaWalletBalancesParametersSchema,
    CurrentWalletBalancesParameters,
    CurrentWalletBalancesParametersSchema,
} from './parameters';
import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

// Schema for current wallet balance
const CurrentWalletBalanceParametersSchema = createParameterSchema(
    z.object({
        mintAddress: z.string().optional().describe('Optional SPL token mint address (or empty for SOL balance)'),
    })
);

type CurrentWalletBalanceParameters = typeof CurrentWalletBalanceParametersSchema.type;

export class SolanaWalletPlugin extends EdwinPlugin {
    constructor(wallet: EdwinSolanaPublicKeyWallet) {
        super('solana_wallet', [new SolanaWalletService(wallet)]);
    }

    getTools(): Record<string, EdwinTool> {
        // Combine public and private tools
        return {
            ...this.getPublicTools(),
            ...this.getPrivateTools(),
        };
    }

    getPublicTools(): Record<string, EdwinTool> {
        const solanaWalletService = this.toolProviders.find(
            provider => provider instanceof SolanaWalletService
        ) as SolanaWalletService;

        return {
            checkSolanaWalletBalance: {
                name: 'check_solana_wallet_balance',
                description: 'Check the balance of any Solana wallet',
                schema: SolanaBalanceParametersSchema.schema,
                execute: async (params: SolanaBalanceParameters) => {
                    return await solanaWalletService.getWalletBalance(params);
                },
            },
            checkCurrentSolanaWalletBalance: {
                name: 'check_current_solana_wallet_balance',
                description: 'Check the balance of your current Solana wallet',
                schema: CurrentWalletBalanceParametersSchema.schema,
                execute: async (params: CurrentWalletBalanceParameters) => {
                    return await solanaWalletService.getCurrentWalletBalance(params.mintAddress);
                },
            },
            getWalletBalances: {
                name: 'get_wallet_balances',
                description: 'Get all token balances for any Solana wallet',
                schema: SolanaWalletBalancesParametersSchema.schema,
                execute: async (params: SolanaWalletBalancesParameters) => {
                    return await solanaWalletService.getWalletBalances(params);
                },
            },
            getCurrentWalletBalances: {
                name: 'get_current_wallet_balances',
                description: 'Get all token balances for your current Solana wallet',
                schema: CurrentWalletBalancesParametersSchema.schema,
                execute: async (_params: CurrentWalletBalancesParameters) => {
                    return await solanaWalletService.getCurrentWalletBalances();
                },
            },
        };
    }

    getPrivateTools(): Record<string, EdwinTool> {
        // Solana Wallet has no private tools
        return {};
    }

    supportsChain = (chain: Chain) => chain.type === 'solana';
}

// Factory function to create a new instance of the plugin
export const solanaWallet = (wallet: EdwinSolanaPublicKeyWallet) => new SolanaWalletPlugin(wallet);

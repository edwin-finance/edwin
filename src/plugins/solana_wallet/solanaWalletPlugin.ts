import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { SolanaWalletService } from './solanaWalletService';
import { SolanaWalletClient } from '../../core/wallets/solana_wallet';
import {
    SolanaWalletTokenBalanceParameters,
    SolanaWalletTokenBalanceParametersSchema,
    CurrentSolanaWalletTokenBalanceParameters,
    CurrentSolanaWalletTokenBalanceParametersSchema,
    SolanaWalletBalancesParameters,
    SolanaWalletBalancesParametersSchema,
    CurrentSolanaWalletBalancesParameters,
    CurrentSolanaWalletBalancesParametersSchema,
} from './parameters';

export class SolanaWalletPlugin extends EdwinPlugin {
    constructor(wallet: SolanaWalletClient) {
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
            getSolanaWalletTokenBalance: {
                name: 'get_solana_wallet_token_balance',
                description: 'Get the balance of a Solana wallet and a specific token mint (default is SOL)',
                schema: SolanaWalletTokenBalanceParametersSchema.schema,
                execute: async (params: SolanaWalletTokenBalanceParameters) => {
                    return await solanaWalletService.getSolanaWalletTokenBalance(params);
                },
            },
            getCurrentSolanaWalletTokenBalance: {
                name: 'get_current_solana_wallet_token_balance',
                description: 'Get the balance of your current Solana wallet and a specific token mint (default is SOL)',
                schema: CurrentSolanaWalletTokenBalanceParametersSchema.schema,
                execute: async (params: CurrentSolanaWalletTokenBalanceParameters) => {
                    return await solanaWalletService.getCurrentSolanaWalletTokenBalance(params.mintAddress);
                },
            },
            getSolanaWalletBalances: {
                name: 'get_solana_wallet_balances',
                description: 'Get all token balances of a Solana wallet',
                schema: SolanaWalletBalancesParametersSchema.schema,
                execute: async (params: SolanaWalletBalancesParameters) => {
                    return await solanaWalletService.getSolanaWalletBalances(params);
                },
            },
            getCurrentSolanaWalletBalances: {
                name: 'get_current_solana_wallet_balances',
                description: 'Get all token balances of your current Solana wallet',
                schema: CurrentSolanaWalletBalancesParametersSchema.schema,
                execute: async (_params: CurrentSolanaWalletBalancesParameters) => {
                    return await solanaWalletService.getCurrentSolanaWalletBalances();
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
export const solanaWallet = (wallet: SolanaWalletClient) => new SolanaWalletPlugin(wallet);

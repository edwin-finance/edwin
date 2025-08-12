import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { HederaWalletService } from './hederaWalletService';
import { HederaWalletClient, canSign } from '../../core/wallets/hedera_wallet';
import {
    HederaWalletBalanceParameters,
    HederaWalletBalanceParametersSchema,
    CurrentHederaWalletBalanceParameters,
    CurrentHederaWalletBalanceParametersSchema,
    HederaWalletTokenBalanceParameters,
    HederaWalletTokenBalanceParametersSchema,
    CurrentHederaWalletTokenBalanceParameters,
    CurrentHederaWalletTokenBalanceParametersSchema,
    HederaWalletAccountInfoParameters,
    HederaWalletAccountInfoParametersSchema,
    CurrentHederaWalletAccountInfoParameters,
    CurrentHederaWalletAccountInfoParametersSchema,
    HederaWalletTransferHbarParameters,
    HederaWalletTransferHbarParametersSchema,
    HederaWalletTransferTokenParameters,
    HederaWalletTransferTokenParametersSchema,
} from './parameters';

export class HederaWalletPlugin extends EdwinPlugin {
    constructor(private wallet: HederaWalletClient) {
        super('hedera_wallet', [new HederaWalletService(wallet)]);
    }

    getTools(): Record<string, EdwinTool> {
        // Combine public and private tools
        return {
            ...this.getPublicTools(),
            ...this.getPrivateTools(),
        };
    }

    getPublicTools(): Record<string, EdwinTool> {
        const hederaWalletService = this.toolProviders.find(
            provider => provider instanceof HederaWalletService
        ) as HederaWalletService;

        return {
            getHederaWalletBalance: {
                name: 'get_hedera_wallet_balance',
                description: 'Get the HBAR balance of a Hedera account',
                schema: HederaWalletBalanceParametersSchema.schema,
                execute: async (params: HederaWalletBalanceParameters) => {
                    return await hederaWalletService.getHederaWalletBalance(params);
                },
            },
            getCurrentHederaWalletBalance: {
                name: 'get_current_hedera_wallet_balance',
                description: 'Get the HBAR balance of your current Hedera account',
                schema: CurrentHederaWalletBalanceParametersSchema.schema,
                execute: async (_params: CurrentHederaWalletBalanceParameters) => {
                    return await hederaWalletService.getCurrentHederaWalletBalance();
                },
            },
            getHederaWalletTokenBalance: {
                name: 'get_hedera_wallet_token_balance',
                description: 'Get the token balance of a Hedera account for a specific token',
                schema: HederaWalletTokenBalanceParametersSchema.schema,
                execute: async (params: HederaWalletTokenBalanceParameters) => {
                    return await hederaWalletService.getHederaWalletTokenBalance(params);
                },
            },
            getCurrentHederaWalletTokenBalance: {
                name: 'get_current_hedera_wallet_token_balance',
                description: 'Get the token balance of your current Hedera account for a specific token',
                schema: CurrentHederaWalletTokenBalanceParametersSchema.schema,
                execute: async (params: CurrentHederaWalletTokenBalanceParameters) => {
                    return await hederaWalletService.getCurrentHederaWalletTokenBalance(params.tokenId);
                },
            },
            getHederaWalletAccountInfo: {
                name: 'get_hedera_wallet_account_info',
                description: 'Get account information for a Hedera account',
                schema: HederaWalletAccountInfoParametersSchema.schema,
                execute: async (params: HederaWalletAccountInfoParameters) => {
                    return await hederaWalletService.getHederaWalletAccountInfo(params);
                },
            },
            getCurrentHederaWalletAccountInfo: {
                name: 'get_current_hedera_wallet_account_info',
                description: 'Get account information for your current Hedera account',
                schema: CurrentHederaWalletAccountInfoParametersSchema.schema,
                execute: async (_params: CurrentHederaWalletAccountInfoParameters) => {
                    return await hederaWalletService.getCurrentHederaWalletAccountInfo();
                },
            },
        };
    }

    getPrivateTools(): Record<string, EdwinTool> {
        // Only include transfer tools if the wallet can sign
        if (!canSign(this.wallet)) {
            return {};
        }

        const hederaWalletService = this.toolProviders.find(
            provider => provider instanceof HederaWalletService
        ) as HederaWalletService;

        return {
            transferHbar: {
                name: 'transfer_hbar',
                description: 'Transfer HBAR from your account to another account',
                schema: HederaWalletTransferHbarParametersSchema.schema,
                execute: async (params: HederaWalletTransferHbarParameters) => {
                    return await hederaWalletService.transferHbar(params);
                },
            },
            transferToken: {
                name: 'transfer_token',
                description: 'Transfer tokens from your account to another account',
                schema: HederaWalletTransferTokenParametersSchema.schema,
                execute: async (params: HederaWalletTransferTokenParameters) => {
                    return await hederaWalletService.transferToken(params);
                },
            },
        };
    }

    supportsChain = (chain: Chain) => chain.type === 'hedera';
}

// Factory function to create a new instance of the plugin
export const hederaWallet = (wallet: HederaWalletClient) => new HederaWalletPlugin(wallet);

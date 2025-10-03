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
    HederaWalletTokenLookupParameters,
    HederaWalletTokenLookupParametersSchema,
    HederaWalletWrapHbarParameters,
    HederaWalletWrapHbarParametersSchema,
    HederaWalletUnwrapWhbarParameters,
    HederaWalletUnwrapWhbarParametersSchema,
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
                name: 'get_hedera_hbar_balance',
                description: 'Get the HBAR balance of any Hedera account on the Hedera network',
                schema: HederaWalletBalanceParametersSchema.schema,
                execute: async (params: HederaWalletBalanceParameters) => {
                    return await hederaWalletService.getHederaWalletBalance(params);
                },
            },
            getCurrentHederaWalletBalance: {
                name: 'get_current_hedera_hbar_balance',
                description: 'Get the HBAR balance of your current connected Hedera wallet',
                schema: CurrentHederaWalletBalanceParametersSchema.schema,
                execute: async (_params: CurrentHederaWalletBalanceParameters) => {
                    return await hederaWalletService.getCurrentHederaWalletBalance();
                },
            },
            getHederaWalletTokenBalance: {
                name: 'get_hedera_hts_token_balance',
                description:
                    'Get the HTS (Hedera Token Service) token balance of any Hedera account for a specific token',
                schema: HederaWalletTokenBalanceParametersSchema.schema,
                execute: async (params: HederaWalletTokenBalanceParameters) => {
                    return await hederaWalletService.getHederaWalletTokenBalance(params);
                },
            },
            getCurrentHederaWalletTokenBalance: {
                name: 'get_current_hedera_hts_token_balance',
                description:
                    'Get the HTS (Hedera Token Service) token balance of your current connected Hedera wallet for a specific token',
                schema: CurrentHederaWalletTokenBalanceParametersSchema.schema,
                execute: async (params: CurrentHederaWalletTokenBalanceParameters) => {
                    return await hederaWalletService.getCurrentHederaWalletTokenBalance(params.tokenId);
                },
            },
            getHederaWalletAccountInfo: {
                name: 'get_hedera_account_info',
                description: 'Get detailed account information for any Hedera account (balance, keys, tokens, etc.)',
                schema: HederaWalletAccountInfoParametersSchema.schema,
                execute: async (params: HederaWalletAccountInfoParameters) => {
                    return await hederaWalletService.getHederaWalletAccountInfo(params);
                },
            },
            getCurrentHederaWalletAccountInfo: {
                name: 'get_current_hedera_account_info',
                description:
                    'Get detailed account information for your current connected Hedera wallet (balance, keys, tokens, etc.)',
                schema: CurrentHederaWalletAccountInfoParametersSchema.schema,
                execute: async (_params: CurrentHederaWalletAccountInfoParameters) => {
                    return await hederaWalletService.getCurrentHederaWalletAccountInfo();
                },
            },
            lookupTokenByName: {
                name: 'lookup_hedera_hts_token_by_name',
                description:
                    'Lookup an HTS (Hedera Token Service) token ID by name or symbol on the Hedera network (e.g., "USDC" -> "0.0.456858"). Use this to get token IDs for other Hedera functions like transferToken.',
                schema: HederaWalletTokenLookupParametersSchema.schema,
                execute: async (params: HederaWalletTokenLookupParameters) => {
                    return await hederaWalletService.lookupTokenByName(params);
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
                name: 'transfer_hedera_hbar',
                description:
                    'Transfer HBAR (Hedera native cryptocurrency) from your Hedera wallet to another Hedera account',
                schema: HederaWalletTransferHbarParametersSchema.schema,
                execute: async (params: HederaWalletTransferHbarParameters) => {
                    return await hederaWalletService.transferHbar(params);
                },
            },
            transferToken: {
                name: 'transfer_hedera_hts_token',
                description:
                    'Transfer HTS (Hedera Token Service) tokens from your Hedera wallet to another Hedera account',
                schema: HederaWalletTransferTokenParametersSchema.schema,
                execute: async (params: HederaWalletTransferTokenParameters) => {
                    return await hederaWalletService.transferToken(params);
                },
            },
            wrapHbarToWhbar: {
                name: 'wrap_hbar_to_whbar',
                description:
                    'Wrap HBAR into WHBAR (Wrapped HBAR ERC20 token). WHBAR is an ERC20-compatible version of HBAR that can be used in DeFi protocols. The WHBAR token will be sent to your wallet.',
                schema: HederaWalletWrapHbarParametersSchema.schema,
                execute: async (params: HederaWalletWrapHbarParameters) => {
                    return await hederaWalletService.wrapHbarToWhbar(params);
                },
            },
            unwrapWhbarToHbar: {
                name: 'unwrap_whbar_to_hbar',
                description:
                    'Unwrap WHBAR back into native HBAR. This converts your WHBAR tokens back into regular HBAR that can be used for transaction fees and native transfers.',
                schema: HederaWalletUnwrapWhbarParametersSchema.schema,
                execute: async (params: HederaWalletUnwrapWhbarParameters) => {
                    return await hederaWalletService.unwrapWhbarToHbar(params);
                },
            },
        };
    }

    supportsChain = (chain: Chain) => chain.type === 'hedera';
}

// Factory function to create a new instance of the plugin
export const hederaWallet = (wallet: HederaWalletClient) => new HederaWalletPlugin(wallet);

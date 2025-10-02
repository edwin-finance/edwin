import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { BonzoService } from './bonzoService';
import { HederaWalletClient, canSign } from '../../core/wallets/hedera_wallet';
import {
    BonzoSupplyParametersSchema,
    BonzoWithdrawParametersSchema,
    BonzoBorrowParametersSchema,
    BonzoGetSuppliedBalanceParametersSchema,
    CurrentBonzoGetSuppliedBalanceParametersSchema,
    BonzoSupplyParameters,
    BonzoWithdrawParameters,
    BonzoBorrowParameters,
    BonzoGetSuppliedBalanceParameters,
    CurrentBonzoGetSuppliedBalanceParameters,
} from './parameters';

export class BonzoPlugin extends EdwinPlugin {
    constructor(private wallet: HederaWalletClient) {
        super('bonzo', [new BonzoService(wallet)]);
    }

    getTools(): Record<string, EdwinTool> {
        return {
            ...this.getPublicTools(),
            ...this.getPrivateTools(),
        };
    }

    getPublicTools(): Record<string, EdwinTool> {
        const bonzoService = this.toolProviders.find(provider => provider instanceof BonzoService) as BonzoService;

        return {
            getBonzoSuppliedBalance: {
                name: 'get_bonzo_supplied_balance',
                description: 'Get the supplied balance for a specific token in Bonzo Finance',
                schema: BonzoGetSuppliedBalanceParametersSchema.schema,
                execute: async (params: BonzoGetSuppliedBalanceParameters) => {
                    return await bonzoService.getSuppliedBalance(params);
                },
            },
            getCurrentBonzoSuppliedBalance: {
                name: 'get_current_bonzo_supplied_balance',
                description: 'Get the current supplied balance for your connected wallet in Bonzo Finance',
                schema: CurrentBonzoGetSuppliedBalanceParametersSchema.schema,
                execute: async (params: CurrentBonzoGetSuppliedBalanceParameters) => {
                    return await bonzoService.getCurrentSuppliedBalance(params.tokenSymbol);
                },
            },
        };
    }

    getPrivateTools(): Record<string, EdwinTool> {
        if (!canSign(this.wallet)) {
            return {};
        }

        const bonzoService = this.toolProviders.find(provider => provider instanceof BonzoService) as BonzoService;

        return {
            bonzoSupply: {
                name: 'bonzo_supply_tokens',
                description: 'Supply tokens to Bonzo Finance lending protocol to earn interest',
                schema: BonzoSupplyParametersSchema.schema,
                execute: async (params: BonzoSupplyParameters) => {
                    return await bonzoService.supply(params);
                },
            },
            bonzoWithdraw: {
                name: 'bonzo_withdraw_tokens',
                description: 'Withdraw supplied tokens from Bonzo Finance lending protocol',
                schema: BonzoWithdrawParametersSchema.schema,
                execute: async (params: BonzoWithdrawParameters) => {
                    return await bonzoService.withdraw(params);
                },
            },
            bonzoBorrow: {
                name: 'bonzo_borrow_tokens',
                description: 'Borrow tokens from Bonzo Finance lending protocol (requires collateral)',
                schema: BonzoBorrowParametersSchema.schema,
                execute: async (params: BonzoBorrowParameters) => {
                    return await bonzoService.borrow(params);
                },
            },
        };
    }

    supportsChain = (chain: Chain) => chain.type === 'hedera';
}

export const bonzo = (wallet: HederaWalletClient) => new BonzoPlugin(wallet);

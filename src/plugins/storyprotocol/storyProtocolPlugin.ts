import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool, Chain } from '../../core/types';
import { StoryProtocolService } from './storyProtocolService';
import { EdwinEVMWallet } from '../../core/wallets';
import {
    RegisterIPAssetParametersSchema,
    AttachTermsParametersSchema,
    MintLicenseTokenParametersSchema,
    RegisterDerivativeParametersSchema,
    PayIPAssetParametersSchema,
    ClaimRevenueParametersSchema,
    RegisterIPAssetParameters,
    AttachTermsParameters,
    MintLicenseTokenParameters,
    RegisterDerivativeParameters,
    PayIPAssetParameters,
    ClaimRevenueParameters,
} from './parameters';

export class StoryProtocolPlugin extends EdwinPlugin {
    constructor(wallet: EdwinEVMWallet) {
        super('storyprotocol', [new StoryProtocolService(wallet)]);
    }

    getTools(): Record<string, EdwinTool> {
        const storyProtocolService = this.toolProviders.find(
            provider => provider instanceof StoryProtocolService
        ) as StoryProtocolService;

        return {
            registerIPAsset: {
                name: 'register_ip_asset',
                description: 'Register an IP asset on Story Protocol',
                schema: RegisterIPAssetParametersSchema.schema,
                execute: async (params: RegisterIPAssetParameters) => {
                    return await storyProtocolService.registerIPAsset(params);
                },
            },
            attachTerms: {
                name: 'attach_terms',
                description: 'Attach terms to an IP asset on Story Protocol',
                schema: AttachTermsParametersSchema.schema,
                execute: async (params: AttachTermsParameters) => {
                    return await storyProtocolService.attachTerms(params);
                },
            },
            mintLicenseToken: {
                name: 'mint_license_token',
                description: 'Mint a license token for an IP asset on Story Protocol',
                schema: MintLicenseTokenParametersSchema.schema,
                execute: async (params: MintLicenseTokenParameters) => {
                    return await storyProtocolService.mintLicenseToken(params);
                },
            },
            registerDerivative: {
                name: 'register_derivative',
                description: 'Register a derivative IP asset on Story Protocol',
                schema: RegisterDerivativeParametersSchema.schema,
                execute: async (params: RegisterDerivativeParameters) => {
                    return await storyProtocolService.registerDerivative(params);
                },
            },
            payIPAsset: {
                name: 'pay_ip_asset',
                description: 'Pay royalty to an IP asset on Story Protocol',
                schema: PayIPAssetParametersSchema.schema,
                execute: async (params: PayIPAssetParameters) => {
                    return await storyProtocolService.payIPAsset(params);
                },
            },
            claimRevenue: {
                name: 'claim_revenue',
                description: 'Claim revenue from an IP asset on Story Protocol',
                schema: ClaimRevenueParametersSchema.schema,
                execute: async (params: ClaimRevenueParameters) => {
                    return await storyProtocolService.claimRevenue(params);
                },
            },
        };
    }

    supportsChain = (chain: Chain) => chain.type === 'evm';
}

export const storyprotocol = (wallet: EdwinEVMWallet) => new StoryProtocolPlugin(wallet);

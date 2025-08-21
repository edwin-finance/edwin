import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

// Schema for checking HBAR balance on Hedera
export const HederaWalletBalanceParametersSchema = createParameterSchema(
    z.object({
        accountId: z.string().describe('The Hedera account ID to check the HBAR balance of (format: 0.0.123456)'),
    })
);

export const CurrentHederaWalletBalanceParametersSchema = createParameterSchema(
    z.object({}).describe('No parameters needed - gets HBAR balance for your current Hedera wallet')
);

// Schema for getting HTS token balance on Hedera
export const HederaWalletTokenBalanceParametersSchema = createParameterSchema(
    z.object({
        accountId: z.string().describe('The Hedera account ID to check HTS token balance of (format: 0.0.123456)'),
        tokenId: z
            .string()
            .describe('The Hedera Token Service (HTS) token ID to check balance for (format: 0.0.123456)'),
    })
);

export const CurrentHederaWalletTokenBalanceParametersSchema = createParameterSchema(
    z.object({
        tokenId: z
            .string()
            .describe('The Hedera Token Service (HTS) token ID to check balance for (format: 0.0.123456)'),
    })
);

// Schema for getting Hedera account information
export const HederaWalletAccountInfoParametersSchema = createParameterSchema(
    z.object({
        accountId: z.string().describe('The Hedera account ID to get information for (format: 0.0.123456)'),
    })
);

export const CurrentHederaWalletAccountInfoParametersSchema = createParameterSchema(
    z.object({}).describe('No parameters needed - gets account information for your current Hedera wallet')
);

// Schema for HBAR transfer on Hedera
export const HederaWalletTransferHbarParametersSchema = createParameterSchema(
    z.object({
        toAccountId: z.string().describe('The recipient Hedera account ID (format: 0.0.123456)'),
        amount: z.number().positive().describe('Amount of HBAR (Hedera native cryptocurrency) to transfer'),
    })
);

// Schema for HTS token transfer on Hedera
export const HederaWalletTransferTokenParametersSchema = createParameterSchema(
    z.object({
        toAccountId: z.string().describe('The recipient Hedera account ID (format: 0.0.123456)'),
        tokenId: z.string().describe('The Hedera Token Service (HTS) token ID to transfer (format: 0.0.123456)'),
        amount: z.number().positive().describe('Amount of HTS tokens to transfer (in human-readable format)'),
    })
);

// Schema for HTS token lookup by name/symbol on Hedera
export const HederaWalletTokenLookupParametersSchema = createParameterSchema(
    z.object({
        tokenName: z
            .string()
            .describe('The HTS token name or symbol to lookup on Hedera (e.g., "USDC", "SAUCE", "KARATE")'),
        network: z
            .enum(['mainnet', 'testnet', 'previewnet'])
            .optional()
            .describe('The Hedera network to search on (mainnet, testnet, or previewnet - defaults to mainnet)'),
    })
);

// Export clean parameter types
export type HederaWalletBalanceParameters = typeof HederaWalletBalanceParametersSchema.type;
export type CurrentHederaWalletBalanceParameters = typeof CurrentHederaWalletBalanceParametersSchema.type;
export type HederaWalletTokenBalanceParameters = typeof HederaWalletTokenBalanceParametersSchema.type;
export type CurrentHederaWalletTokenBalanceParameters = typeof CurrentHederaWalletTokenBalanceParametersSchema.type;
export type HederaWalletAccountInfoParameters = typeof HederaWalletAccountInfoParametersSchema.type;
export type CurrentHederaWalletAccountInfoParameters = typeof CurrentHederaWalletAccountInfoParametersSchema.type;
export type HederaWalletTransferHbarParameters = typeof HederaWalletTransferHbarParametersSchema.type;
export type HederaWalletTransferTokenParameters = typeof HederaWalletTransferTokenParametersSchema.type;
export type HederaWalletTokenLookupParameters = typeof HederaWalletTokenLookupParametersSchema.type;

import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

// Schema for checking account balance on Hedera
export const HederaWalletBalanceParametersSchema = createParameterSchema(
    z.object({
        accountId: z.string().describe('The Hedera account ID to check the balance of'),
    })
);

export const CurrentHederaWalletBalanceParametersSchema = createParameterSchema(
    z.object({}).describe('No parameters needed')
);

// Schema for getting token balance
export const HederaWalletTokenBalanceParametersSchema = createParameterSchema(
    z.object({
        accountId: z.string().describe('The Hedera account ID to check the token balance of'),
        tokenId: z.string().describe('The token ID to check balance for'),
    })
);

export const CurrentHederaWalletTokenBalanceParametersSchema = createParameterSchema(
    z.object({
        tokenId: z.string().describe('The token ID to check balance for'),
    })
);

// Schema for getting account information
export const HederaWalletAccountInfoParametersSchema = createParameterSchema(
    z.object({
        accountId: z.string().describe('The Hedera account ID to get information for'),
    })
);

export const CurrentHederaWalletAccountInfoParametersSchema = createParameterSchema(
    z.object({}).describe('No parameters needed')
);

// Schema for HBAR transfer
export const HederaWalletTransferHbarParametersSchema = createParameterSchema(
    z.object({
        toAccountId: z.string().describe('The recipient account ID'),
        amount: z.number().positive().describe('Amount of HBAR to transfer'),
    })
);

// Schema for token transfer
export const HederaWalletTransferTokenParametersSchema = createParameterSchema(
    z.object({
        toAccountId: z.string().describe('The recipient account ID'),
        tokenId: z.string().describe('The token ID to transfer'),
        amount: z.number().positive().describe('Amount of tokens to transfer'),
    })
);

// Schema for token lookup by name/symbol
export const HederaWalletTokenLookupParametersSchema = createParameterSchema(
    z.object({
        tokenName: z.string().describe('The token name or symbol to lookup (e.g., "USDC", "HBAR", "ETH")'),
        network: z
            .enum(['mainnet', 'testnet', 'previewnet'])
            .optional()
            .describe('The Hedera network to search on (defaults to mainnet)'),
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

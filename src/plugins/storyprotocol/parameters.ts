import { z } from 'zod';
import { createParameterSchema } from '../../core/utils/createParameterSchema';

export const RegisterIPAssetParametersSchema = createParameterSchema(
    z.object({
        name: z.string().min(1).describe('The name of the IP asset'),
        description: z.string().min(1).describe('The description of the IP asset'),
        mediaUrl: z.string().url().describe('The URL to the media file of the IP asset'),
        contentHash: z.string().min(1).describe('The hash of the content'),
        externalUrl: z.string().url().nullable().optional().describe('An optional external URL for the IP asset'),
    })
);

export const AttachTermsParametersSchema = createParameterSchema(
    z.object({
        ipId: z.string().min(1).describe('The ID of the IP asset'),
        termsUrl: z.string().url().describe('The URL to the terms document'),
        termsHash: z.string().min(1).describe('The hash of the terms document'),
        royaltyPercentage: z.number().describe('The royalty percentage'),
    })
);

export const MintLicenseTokenParametersSchema = createParameterSchema(
    z.object({
        ipId: z.string().min(1).describe('The ID of the IP asset'),
        licenseTermsUrl: z.string().url().describe('The URL to the license terms document'),
        licenseTermsHash: z.string().min(1).describe('The hash of the license terms document'),
        mintTo: z.string().min(1).describe('The address to mint the license token to'),
    })
);

export const RegisterDerivativeParametersSchema = createParameterSchema(
    z.object({
        parentIpId: z.string().min(1).describe('The ID of the parent IP asset'),
        name: z.string().min(1).describe('The name of the derivative IP asset'),
        description: z.string().min(1).describe('The description of the derivative IP asset'),
        mediaUrl: z.string().url().describe('The URL to the media file of the derivative IP asset'),
        contentHash: z.string().min(1).describe('The hash of the content'),
        externalUrl: z
            .string()
            .url()
            .nullable()
            .optional()
            .describe('An optional external URL for the derivative IP asset'),
        isCommercial: z.boolean().describe('Whether the derivative is for commercial use'),
    })
);

export const PayIPAssetParametersSchema = createParameterSchema(
    z.object({
        ipId: z.string().min(1).describe('The ID of the IP asset'),
        amount: z.string().min(1).describe('The amount to pay'),
    })
);

export const ClaimRevenueParametersSchema = createParameterSchema(
    z.object({
        ipId: z.string().min(1).describe('The ID of the IP asset'),
    })
);

// Export clean parameter types
export type RegisterIPAssetParameters = typeof RegisterIPAssetParametersSchema.type;
export type AttachTermsParameters = typeof AttachTermsParametersSchema.type;
export type MintLicenseTokenParameters = typeof MintLicenseTokenParametersSchema.type;
export type RegisterDerivativeParameters = typeof RegisterDerivativeParametersSchema.type;
export type PayIPAssetParameters = typeof PayIPAssetParametersSchema.type;
export type ClaimRevenueParameters = typeof ClaimRevenueParametersSchema.type;

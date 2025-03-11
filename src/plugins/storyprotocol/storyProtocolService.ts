import { StoryClient, WIP_TOKEN_ADDRESS, RegisterPILTermsRequest } from '@story-protocol/core-sdk';
import { createWalletClient, http, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { EdwinEVMWallet } from '../../core/wallets';
import { SupportedChain } from '../../core/types';
import {
    RegisterIPAssetParameters,
    AttachTermsParameters,
    MintLicenseTokenParameters,
    RegisterDerivativeParameters,
    PayIPAssetParameters,
    ClaimRevenueParameters,
} from './parameters';
import { LicensingConfig } from '@story-protocol/core-sdk/dist/declarations/src/types/common';

export class StoryProtocolService {
    supportedChains: SupportedChain[] = ['sepolia'];
    private wallet: EdwinEVMWallet;
    private client: StoryClient;
    private nftContractAddress: string;
    private spgNftContractAddress: string;

    constructor(wallet: EdwinEVMWallet) {
        this.wallet = wallet;

        // Load environment variables
        this.nftContractAddress = process.env.NFT_CONTRACT_ADDRESS || '';
        this.spgNftContractAddress = process.env.SPG_NFT_CONTRACT_ADDRESS || '';

        if (!this.nftContractAddress) {
            throw new Error('NFT_CONTRACT_ADDRESS environment variable is required');
        }

        if (!this.spgNftContractAddress) {
            throw new Error('SPG_NFT_CONTRACT_ADDRESS environment variable is required');
        }

        // Create Story client
        const privateKey = process.env.WALLET_PRIVATE_KEY || '';
        if (!privateKey) {
            throw new Error('WALLET_PRIVATE_KEY environment variable is required');
        }

        const account = privateKeyToAccount(privateKey as `0x${string}`);
        // Create wallet client (not used in this implementation but would be in a real implementation)
        const _viemWalletClient = createWalletClient({
            account,
            chain: sepolia,
            transport: http(process.env.RPC_PROVIDER_URL || 'https://sepolia.infura.io/v3/'),
        });

        // Initialize the Story client
        // Note: This is a placeholder. The actual initialization depends on the SDK version
        this.client = {
            ipAsset: {
                registerIpAndAttachPilTerms: async () => ({ ipId: '', txHash: '', licenseTermsIds: [] }),
                registerDerivativeIp: async () => ({ ipId: '', txHash: '' }),
            },
            royalty: {
                payRoyaltyOnBehalf: async () => ({ txHash: '' }),
                claimAllRevenue: async () => ({ claimedTokens: [] }),
            },
        } as unknown as StoryClient;
    }

    async registerIPAsset(params: RegisterIPAssetParameters): Promise<string> {
        const {
            name: _name,
            description: _description,
            mediaUrl: _mediaUrl,
            contentHash: _contentHash,
            externalUrl: _externalUrl,
        } = params;

        // Upload metadata to IPFS
        const ipMetadata = {
            ipMetadataURI: 'test-uri',
            ipMetadataHash: toHex('test-metadata-hash', { size: 32 }),
            nftMetadataHash: toHex('test-nft-metadata-hash', { size: 32 }),
            nftMetadataURI: 'test-nft-uri',
        };

        // Register IP asset
        const { ipId } = await this.client.ipAsset.registerIpAndAttachPilTerms({
            nftContract: this.nftContractAddress as `0x${string}`,
            tokenId: BigInt(1), // This would typically be dynamic
            licenseTermsData: [],
            ipMetadata,
            txOptions: { waitForTransaction: true },
        });

        return ipId || '';
    }

    async attachTerms(params: AttachTermsParameters): Promise<string> {
        const { ipId: _ipId, termsUrl, termsHash } = params;

        // Attach terms to IP asset
        // Note: This is a simplified implementation
        const { txHash } = await this.client.ipAsset.registerIpAndAttachPilTerms({
            nftContract: this.nftContractAddress as `0x${string}`,
            tokenId: BigInt(1),
            licenseTermsData: [
                {
                    // Using 'unknown' type for mock implementation since we don't have access to the actual SDK types
                    terms: {} as RegisterPILTermsRequest,
                    licensingConfig: {} as LicensingConfig,
                },
            ],
            ipMetadata: {
                ipMetadataURI: termsUrl,
                ipMetadataHash: termsHash as `0x${string}`,
                nftMetadataHash: '0x' as `0x${string}`,
                nftMetadataURI: '',
            },
            txOptions: { waitForTransaction: true },
        });

        return txHash || '';
    }

    async mintLicenseToken(params: MintLicenseTokenParameters): Promise<string> {
        const {
            ipId: _ipId,
            licenseTermsUrl: _licenseTermsUrl,
            licenseTermsHash: _licenseTermsHash,
            mintTo: _mintTo,
        } = params;

        // Mint license token
        // Note: This is a placeholder. The actual implementation depends on the SDK version
        return 'license-token-id';
    }

    async registerDerivative(params: RegisterDerivativeParameters): Promise<string> {
        const {
            parentIpId,
            name: _name,
            description: _description,
            mediaUrl: _mediaUrl,
            contentHash: _contentHash,
            externalUrl: _externalUrl,
            isCommercial: _isCommercial,
        } = params;

        // Register derivative IP
        const { ipId } = await this.client.ipAsset.registerDerivativeIp({
            nftContract: this.nftContractAddress as `0x${string}`,
            tokenId: BigInt(1), // This would typically be dynamic
            derivData: {
                parentIpIds: [parentIpId as `0x${string}`],
                licenseTermsIds: [BigInt(1)], // This would typically be dynamic
                maxMintingFee: 0,
                maxRts: 100_000_000,
                maxRevenueShare: 100,
            },
            ipMetadata: {
                ipMetadataURI: 'test-uri',
                ipMetadataHash: toHex('test-metadata-hash', { size: 32 }),
                nftMetadataHash: toHex('test-nft-metadata-hash', { size: 32 }),
                nftMetadataURI: 'test-nft-uri',
            },
            txOptions: { waitForTransaction: true },
        });

        return ipId || '';
    }

    async payIPAsset(params: PayIPAssetParameters): Promise<string> {
        const { ipId, amount } = params;

        // Pay IP asset
        const { txHash } = await this.client.royalty.payRoyaltyOnBehalf({
            receiverIpId: ipId as `0x${string}`,
            payerIpId: '0x0000000000000000000000000000000000000000' as `0x${string}`,
            token: WIP_TOKEN_ADDRESS,
            amount: Number(amount),
            txOptions: { waitForTransaction: true },
        });

        return txHash || '';
    }

    async claimRevenue(params: ClaimRevenueParameters): Promise<string> {
        const { ipId } = params;

        // Claim revenue
        const result = await this.client.royalty.claimAllRevenue({
            ancestorIpId: ipId as `0x${string}`,
            claimer: ipId as `0x${string}`,
            childIpIds: [],
            royaltyPolicies: [],
            currencyTokens: [WIP_TOKEN_ADDRESS],
        });

        return JSON.stringify(result.claimedTokens);
    }
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storyprotocol } from '../src/plugins/storyprotocol';
import { StoryProtocolService } from '../src/plugins/storyprotocol/storyProtocolService';
import { EdwinEVMWallet } from '../src/core/wallets';
import { setupStoryProtocolMocks } from './setup/storyprotocol.setup';

// Set up mocks for StoryProtocol tests
setupStoryProtocolMocks();

// Mock the EdwinEVMWallet
vi.mock('../src/core/wallets', () => ({
    EdwinEVMWallet: vi.fn().mockImplementation((chain = '0x1234567890abcdef1234567890abcdef12345678') => ({
        // Add any methods that the StoryProtocolService might call on the wallet
        chain,
    })),
}));

// Mock environment variables
process.env.WALLET_PRIVATE_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
process.env.NFT_CONTRACT_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
process.env.SPG_NFT_CONTRACT_ADDRESS = '0x1234567890abcdef1234567890abcdef12345679';
process.env.RPC_PROVIDER_URL = 'https://sepolia.infura.io/v3/your-api-key';

// Mock the StoryProtocolService methods
vi.mock('../src/plugins/storyprotocol/storyProtocolService', () => {
    return {
        StoryProtocolService: vi.fn().mockImplementation(() => ({
            registerIPAsset: vi.fn().mockResolvedValue('ip-asset-id'),
            attachTerms: vi.fn().mockResolvedValue('tx-hash'),
            mintLicenseToken: vi.fn().mockResolvedValue('license-token-id'),
            registerDerivative: vi.fn().mockResolvedValue('derivative-ip-id'),
            payIPAsset: vi.fn().mockResolvedValue('payment-tx-hash'),
            claimRevenue: vi.fn().mockResolvedValue('["claimed-token-1", "claimed-token-2"]'),
            supportedChains: ['sepolia'],
        })),
    };
});

describe('StoryProtocol Plugin', () => {
    let wallet: EdwinEVMWallet;
    let plugin: ReturnType<typeof storyprotocol>;

    beforeEach(() => {
        wallet = new EdwinEVMWallet('0x1234567890abcdef1234567890abcdef12345678');
        plugin = storyprotocol(wallet);
    });

    it('should have the correct plugin instance', () => {
        expect(plugin).toBeDefined();
    });

    it('should support EVM chains', () => {
        // @ts-ignore - Simplified chain object for testing
        expect(plugin.supportsChain({ type: 'evm' })).toBe(true);
        // @ts-ignore - Simplified chain object for testing
        expect(plugin.supportsChain({ type: 'solana' })).toBe(false);
    });

    describe('Tools', () => {
        it('should register an IP asset', async () => {
            const tools = plugin.getTools();
            const result = await tools.registerIPAsset.execute({
                name: 'Test IP Asset',
                description: 'This is a test IP asset',
                mediaUrl: 'https://example.com/image.jpg',
                contentHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                externalUrl: 'https://example.com',
            });

            expect(result).toBe('ip-asset-id');
        });

        it('should attach terms to an IP asset', async () => {
            const tools = plugin.getTools();
            const result = await tools.attachTerms.execute({
                ipId: 'ip-asset-id',
                termsUrl: 'https://example.com/terms',
                termsHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            });

            expect(result).toBe('tx-hash');
        });

        it('should mint a license token', async () => {
            const tools = plugin.getTools();
            const result = await tools.mintLicenseToken.execute({
                ipId: 'ip-asset-id',
                licenseTermsUrl: 'https://example.com/license-terms',
                licenseTermsHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                mintTo: '0x1234567890abcdef1234567890abcdef12345678',
            });

            expect(result).toBe('license-token-id');
        });

        it('should register a derivative', async () => {
            const tools = plugin.getTools();
            const result = await tools.registerDerivative.execute({
                parentIpId: 'ip-asset-id',
                name: 'Test Derivative',
                description: 'This is a test derivative',
                mediaUrl: 'https://example.com/derivative.jpg',
                contentHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                externalUrl: 'https://example.com/derivative',
                isCommercial: true,
            });

            expect(result).toBe('derivative-ip-id');
        });

        it('should pay an IP asset', async () => {
            const tools = plugin.getTools();
            const result = await tools.payIPAsset.execute({
                ipId: 'ip-asset-id',
                amount: '100000000000000000', // 0.1 ETH in wei
            });

            expect(result).toBe('payment-tx-hash');
        });

        it('should claim revenue', async () => {
            const tools = plugin.getTools();
            const result = await tools.claimRevenue.execute({
                ipId: 'ip-asset-id',
            });

            expect(result).toBe('["claimed-token-1", "claimed-token-2"]');
        });
    });
});

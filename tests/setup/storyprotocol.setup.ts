import { vi } from 'vitest';

/**
 * Sets up mocks for StoryProtocol tests
 * This allows tests to run without actual blockchain interactions
 */
export function setupStoryProtocolMocks() {
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
}

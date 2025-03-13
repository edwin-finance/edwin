import { vi } from 'vitest';

/**
 * Sets up mocks for StoryProtocol tests
 * This allows tests to run without actual blockchain interactions
 */
export function setupStoryProtocolMocks() {
    // Mock the viem library for wallet interactions
    vi.mock('viem', () => {
        return {
            createWalletClient: vi.fn().mockReturnValue({
                account: {
                    address: '0xmockaddress',
                },
                chain: {
                    id: 11155111, // Sepolia
                },
                sendTransaction: vi.fn().mockResolvedValue('0xmock-tx-hash'),
            }),
            http: vi.fn(),
            toHex: vi.fn().mockImplementation((value, options) => {
                return `0x${value.toString().padStart((options?.size || 32) * 2, '0')}`;
            }),
            parseEther: vi.fn().mockImplementation((value) => BigInt(value) * BigInt(10 ** 18)),
        };
    });

    // Mock viem/accounts
    vi.mock('viem/accounts', () => {
        return {
            privateKeyToAccount: vi.fn().mockReturnValue({
                address: '0xmockaddress',
                signMessage: vi.fn().mockResolvedValue('0xmocksignature'),
                signTransaction: vi.fn().mockResolvedValue('0xmocksignedtx'),
            }),
        };
    });

    // Mock viem/chains
    vi.mock('viem/chains', () => {
        return {
            sepolia: {
                id: 11155111,
                name: 'Sepolia',
                network: 'sepolia',
                nativeCurrency: {
                    name: 'Sepolia Ether',
                    symbol: 'ETH',
                    decimals: 18,
                },
            },
        };
    });

    // Mock the EdwinEVMWallet
    vi.mock('../../src/core/wallets', () => {
        return {
            EdwinEVMWallet: vi.fn().mockImplementation(() => ({
                getProvider: vi.fn().mockReturnValue({
                    getNetwork: vi.fn().mockResolvedValue({ chainId: 11155111 }), // Sepolia chain ID
                    waitForTransaction: vi.fn().mockResolvedValue({ status: 1 }),
                }),
                getWalletClient: vi.fn().mockReturnValue({
                    account: {
                        address: '0xmockaddress',
                    },
                    chain: {
                        id: 11155111, // Sepolia
                    },
                    sendTransaction: vi.fn().mockResolvedValue('0xmock-tx-hash'),
                }),
                getAddress: vi.fn().mockReturnValue('0xmockaddress'),
                switchChain: vi.fn().mockResolvedValue(true),
            })),
        };
    });

    // Mock the Story Protocol SDK
    vi.mock('@story-protocol/core-sdk', () => {
        return {
            StoryClient: vi.fn().mockImplementation(() => ({
                ipAsset: {
                    registerIpAndAttachPilTerms: vi.fn().mockResolvedValue({
                        ipId: 'ip-asset-id',
                        txHash: 'tx-hash',
                        licenseTermsIds: [],
                    }),
                    registerDerivativeIp: vi.fn().mockResolvedValue({
                        ipId: 'derivative-ip-id',
                        txHash: 'tx-hash',
                    }),
                },
                royalty: {
                    payRoyaltyOnBehalf: vi.fn().mockResolvedValue({
                        txHash: 'payment-tx-hash',
                    }),
                    claimAllRevenue: vi.fn().mockResolvedValue({
                        claimedTokens: ['claimed-token-1', 'claimed-token-2'],
                    }),
                },
            })),
            WIP_TOKEN_ADDRESS: '0x1234567890abcdef1234567890abcdef12345678',
            RegisterPILTermsRequest: {},
        };
    });
}

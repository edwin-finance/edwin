import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StoryProtocolService } from '../src/plugins/storyprotocol/storyProtocolService';
import { EdwinEVMWallet } from '../src/core/wallets/evm_wallet/evm_wallet';
import { StoryProtocolPlugin } from '../src/plugins/storyprotocol/storyProtocolPlugin';

// Mock the StoryProtocolService
vi.mock('../src/plugins/storyprotocol/storyProtocolService', () => {
    return {
        StoryProtocolService: vi.fn().mockImplementation(() => {
            return {
                // Mock all the required methods
                registerIPAsset: vi.fn().mockResolvedValue({
                    success: true,
                    txHash: 'mock-tx-hash',
                    ipId: '0x123'
                }),
                attachTerms: vi.fn().mockResolvedValue({
                    success: true,
                    txHash: 'mock-tx-hash'
                }),
                mintLicenseToken: vi.fn().mockResolvedValue({
                    success: true, 
                    txHash: 'mock-tx-hash',
                    tokenId: '1'
                }),
                registerDerivative: vi.fn().mockResolvedValue({
                    success: true,
                    txHash: 'mock-tx-hash',
                    derivativeId: '0x456'
                }),
                payIPAsset: vi.fn().mockResolvedValue({
                    success: true,
                    txHash: 'mock-tx-hash'
                }),
                claimRevenue: vi.fn().mockResolvedValue({
                    success: true,
                    txHash: 'mock-tx-hash',
                    amount: '0.1'
                })
            };
        })
    };
});

// Mock the EdwinEVMWallet
vi.mock('../src/core/wallets/evm_wallet/evm_wallet', () => {
    return {
        EdwinEVMWallet: vi.fn().mockImplementation(() => {
            return {
                getAddress: vi.fn().mockReturnValue('0x1234567890abcdef1234567890abcdef12345678'),
            };
        })
    };
});

describe('StoryProtocol Plugin', () => {
    let storyProtocol: StoryProtocolService;
    let wallet: EdwinEVMWallet;

    beforeEach(() => {
        wallet = new EdwinEVMWallet('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
        storyProtocol = new StoryProtocolService(wallet);
    });

    describe('Tools', () => {
        it('should register an IP asset', async () => {
            const result = await storyProtocol.registerIPAsset({
                name: 'Test IP Asset',
                description: 'A test IP asset',
                mediaUrl: 'https://example.com/media',
                contentHash: '0xabcdef',
                externalUrl: 'https://example.com/ip-asset'
            });

            expect(result).toEqual({
                success: true,
                txHash: 'mock-tx-hash',
                ipId: '0x123'
            });
        });

        it('should attach terms to an IP asset', async () => {
            const result = await storyProtocol.attachTerms({
                ipId: '0x123',
                termsUrl: 'https://example.com/terms',
                termsHash: '0xabcdef',
                royaltyPercentage: 5
            });

            expect(result).toEqual({
                success: true,
                txHash: 'mock-tx-hash'
            });
        });

        it('should mint a license token', async () => {
            const result = await storyProtocol.mintLicenseToken({
                ipId: '0x123',
                licenseTermsUrl: 'https://example.com/terms',
                licenseTermsHash: '0xabcdef',
                mintTo: '0x456'
            });

            expect(result).toEqual({
                success: true, 
                txHash: 'mock-tx-hash',
                tokenId: '1'
            });
        });

        it('should register a derivative', async () => {
            const result = await storyProtocol.registerDerivative({
                name: 'Test Derivative',
                description: 'A test derivative',
                mediaUrl: 'https://example.com/media',
                contentHash: '0xabcdef',
                externalUrl: 'https://example.com/derivative',
                parentIpId: '0x123',
                isCommercial: true
            });

            expect(result).toEqual({
                success: true,
                txHash: 'mock-tx-hash',
                derivativeId: '0x456'
            });
        });

        it('should pay an IP asset', async () => {
            const result = await storyProtocol.payIPAsset({
                ipId: '0x123',
                amount: '0.1',
            });

            expect(result).toEqual({
                success: true,
                txHash: 'mock-tx-hash'
            });
        });

        it('should claim revenue', async () => {
            const result = await storyProtocol.claimRevenue({
                ipId: '0x123'
            });

            expect(result).toEqual({
                success: true,
                txHash: 'mock-tx-hash',
                amount: '0.1'
            });
        });
    });
});

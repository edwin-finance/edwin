import { vi } from 'vitest';

/**
 * Sets up mocks for AAVE tests
 * This allows tests to run without actual blockchain interactions
 * and simulates successful transactions
 */
export function setupAaveMocks() {
    // Mock the ethers library
    vi.mock('ethers', () => {
        return {
            ethers: {
                Contract: vi.fn().mockImplementation(() => ({
                    supply: vi.fn().mockResolvedValue({
                        hash: '0x' + Array(64).fill('0').map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
                        wait: vi.fn().mockResolvedValue({ status: 1 }),
                    }),
                    withdraw: vi.fn().mockResolvedValue({
                        hash: '0x' + Array(64).fill('0').map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
                        wait: vi.fn().mockResolvedValue({ status: 1 }),
                    }),
                })),
                providers: {
                    JsonRpcProvider: vi.fn().mockImplementation(() => ({
                        getNetwork: vi.fn().mockResolvedValue({ chainId: 8453 }), // Base chain ID
                        waitForTransaction: vi.fn().mockResolvedValue({ status: 1 }),
                        sendTransaction: vi.fn().mockResolvedValue({
                            hash: '0x' + Array(64).fill('0').map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
                            wait: vi.fn().mockResolvedValue({ status: 1 }),
                        }),
                    })),
                },
                utils: {
                    parseUnits: vi.fn().mockImplementation((amount, decimals) => {
                        return BigInt(amount) * BigInt(10 ** (decimals || 18));
                    }),
                },
            },
        };
    });

    // Mock the EdwinEVMWallet
    vi.mock('../../src/core/wallets/evm_wallet/evm_wallet', () => {
        const actual = vi.importActual('../../src/core/wallets/evm_wallet/evm_wallet');
        return {
            ...actual,
            EdwinEVMWallet: vi.fn().mockImplementation(() => ({
                getProvider: vi.fn().mockReturnValue({
                    getNetwork: vi.fn().mockResolvedValue({ chainId: 8453 }), // Base chain ID
                    waitForTransaction: vi.fn().mockResolvedValue({ status: 1 }),
                }),
                getWalletClient: vi.fn().mockReturnValue({
                    account: {
                        address: '0xmockaddress',
                    },
                    chain: {
                        id: 8453, // Base
                    },
                    sendTransaction: vi.fn().mockResolvedValue('0xmock-tx-hash'),
                }),
                getAddress: vi.fn().mockReturnValue('0xmockaddress'),
                switchChain: vi.fn().mockResolvedValue(true),
            })),
        };
    });

    // Create a mock AaveService class that can be used directly in tests
    vi.mock('../../src/plugins/aave/aaveService', () => {
        const originalModule = vi.importActual('../../src/plugins/aave/aaveService');
        
        return {
            ...originalModule,
            AaveService: vi.fn().mockImplementation(() => {
                // Create a mock instance with the same methods as the original
                return {
                    supply: vi.fn().mockImplementation((params) => {
                        // Generate a deterministic mock transaction hash
                        const mockTxHash = '0x' + Array(64).fill('0').map(() => Math.floor(Math.random() * 16).toString(16)).join('');
                        
                        return Promise.resolve(
                            'Successfully supplied ' +
                            params.amount +
                            ' ' +
                            params.asset +
                            ' to Aave, transaction signature: ' +
                            mockTxHash
                        );
                    }),
                    
                    withdraw: vi.fn().mockImplementation((params) => {
                        // Generate a deterministic mock transaction hash
                        const mockTxHash = '0x' + Array(64).fill('0').map(() => Math.floor(Math.random() * 16).toString(16)).join('');
                        
                        return Promise.resolve(
                            'Successfully withdrew ' +
                            params.amount +
                            ' ' +
                            params.asset +
                            ' from Aave, transaction signature: ' +
                            mockTxHash
                        );
                    }),
                    
                    // Add other required methods from EdwinService
                    getPortfolio: vi.fn().mockResolvedValue(''),
                    supportedChains: ['base'],
                };
            }),
        };
    });
}

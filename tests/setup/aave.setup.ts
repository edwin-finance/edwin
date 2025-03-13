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
            providers: {
                JsonRpcProvider: vi.fn().mockImplementation(() => ({
                    getBalance: vi.fn().mockResolvedValue(1000000000000000000n), // 1 ETH
                })),
            },
            Wallet: vi.fn().mockImplementation(() => ({
                connect: vi.fn().mockReturnThis(),
                sendTransaction: vi.fn().mockResolvedValue({ hash: 'mock-tx-hash' }),
            })),
        };
    });

    // Mock the @aave/contract-helpers
    vi.mock('@aave/contract-helpers', () => {
        return {
            Pool: vi.fn().mockImplementation(() => ({
                supply: vi.fn().mockResolvedValue([
                    {
                        from: '0xmockAddress',
                        to: '0xAavePoolAddress',
                        data: '0xmockData',
                        value: '0',
                        gasLimit: '1000000',
                    },
                ]),
                withdraw: vi.fn().mockResolvedValue([
                    {
                        from: '0xmockAddress',
                        to: '0xAavePoolAddress',
                        data: '0xmockData',
                        value: '0',
                        gasLimit: '1000000',
                    },
                ]),
            })),
        };
    });

    // Mock the wallet client for EVM
    vi.mock('../../src/core/wallets/evm_wallet/evm_wallet', () => {
        const actual = vi.importActual('../../src/core/wallets/evm_wallet/evm_wallet');
        return {
            ...actual,
            EdwinEVMWallet: vi.fn().mockImplementation(() => ({
                switchChain: vi.fn(),
                getWalletClient: vi.fn().mockReturnValue({
                    account: {
                        address: '0xmockAddress',
                    },
                    chain: {
                        id: 8453, // Base chain ID
                    },
                    transport: {
                        url: 'https://mock-rpc-url.com',
                    },
                    sendTransaction: vi.fn().mockResolvedValue('0xmock-tx-hash'),
                }),
                getEthersWallet: vi.fn().mockReturnValue({
                    connect: vi.fn().mockReturnThis(),
                    sendTransaction: vi.fn().mockResolvedValue({
                        hash: 'mock-tx-hash',
                        wait: vi.fn().mockResolvedValue({
                            status: 1,
                        }),
                    }),
                    provider: {
                        getBalance: vi.fn().mockResolvedValue(1000000000000000000n), // 1 ETH
                    },
                }),
                getChainConfigs: vi.fn().mockReturnValue({
                    id: 8453,
                    name: 'base',
                }),
            })),
        };
    });
}

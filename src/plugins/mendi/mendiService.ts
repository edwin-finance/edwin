import { ethers, providers } from 'ethers';
import { EdwinEVMWallet } from '../../core/wallets/evm_wallet/evm_wallet';
import { type SupportedChain, type SupportedEVMChain } from '../../core/types';
import edwinLogger from '../../utils/logger';
import { SupplyParameters, WithdrawParameters } from './parameters';
import { EdwinService } from '../../core/classes/edwinToolProvider';

interface MendiError extends Error {
    code?: string;
    error?: {
        body?: string;
    };
    reason?: string;
}

export class MendiService extends EdwinService {
    // Mendi is supported on Linea mainnet
    public supportedChains: SupportedChain[] = ['linea'] as SupportedChain[];
    private wallet: EdwinEVMWallet;

    constructor(wallet: EdwinEVMWallet) {
        super();
        this.wallet = wallet;
    }

    async getPortfolio(): Promise<string> {
        return '';
    }

    private getMendiChain(chain: string): SupportedEVMChain {
        const supportedChains = this.supportedChains.map(c => c.toLowerCase());
        if (!supportedChains.includes((chain as SupportedChain).toLowerCase())) {
            throw new Error(`Chain ${chain} is not supported by Mendi protocol`);
        }
        return chain as SupportedEVMChain;
    }

    /**
     * Set up for Mendi operations
     */
    private async setupMendiClient(chain: SupportedChain): Promise<{
        provider: providers.Provider;
        signer: ethers.Wallet;
        userAddress: string;
    }> {
        // Get the chain and switch wallet
        const mendiChain = this.getMendiChain(chain);
        this.wallet.switchChain(mendiChain);

        // Setup wallet client and provider
        const walletClient = this.wallet.getWalletClient(mendiChain);
        const rpcUrl = walletClient.transport.url;
        const provider = new providers.JsonRpcProvider(rpcUrl);
        const ethers_wallet = this.wallet.getEthersWallet(walletClient, provider);
        ethers_wallet.connect(provider);

        return {
            provider,
            signer: ethers_wallet,
            userAddress: ethers_wallet.address,
        };
    }

    /**
     * Get mToken address for the given asset (Mendi uses mTokens instead of cTokens)
     */
    private getMTokenAddress(chain: SupportedEVMChain, asset: string): string {
        // Convert asset to lowercase for case-insensitive comparison
        const assetLower = asset.toLowerCase();

        // Define mToken addresses for supported assets on Linea
        const mTokens: Record<string, Record<string, string>> = {
            linea: {
                eth: '0xf401D1482DaC313EAD2Cf6aD33585C679b24c51b',
                usdc: '0xAFb95cc0BD320648B3E8Df6595bD18Ec8134581f',
                usdt: '0x8cFe327CEc66d1C090Dd72bd0FF11d690C33a2Eb',
                dai: '0xC5212D0A8A74E6BBF6fcA7d2C02C5cF1F6A7388D',
                wbtc: '0xb28C9BbBD10c05C979D04865E5F0D6fE1cB530F7',
                mnd: '0x4C5Bba045bf4b63D93C7C6F45544E977C3C63995',
            },
        };

        // Check if the chain is supported
        if (!mTokens[chain]) {
            throw new Error(`Chain ${chain} is not supported by Mendi protocol`);
        }

        // Check if the asset is supported on the chain
        if (!mTokens[chain][assetLower]) {
            throw new Error(`Asset ${asset} is not supported on ${chain} by Mendi protocol`);
        }

        return ethers.utils.getAddress(mTokens[chain][assetLower]);
    }

    /**
     * Get underlying token address for the given asset
     */
    private getUnderlyingTokenAddress(chain: SupportedEVMChain, asset: string): string {
        // Convert asset to lowercase for case-insensitive comparison
        const assetLower = asset.toLowerCase();

        // Define underlying token addresses for supported assets on Linea
        const tokenAddresses: Record<string, Record<string, string>> = {
            linea: {
                eth: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                usdc: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff',
                usdt: '0xA219439258ca9da29E9Cc4cE5596924745e12B93',
                dai: '0x4AF15ec2A0BD43Db75dd04E62FAA3B8EF36b00d5',
                wbtc: '0x3aAB2285ddcDdaD8edf438C1bAB47e1a9D05a9b4',
                mnd: '0x463913D3a3D3D350C60CF87EFE366507dDCB5AFd',
            },
        };

        // Check if the chain is supported
        if (!tokenAddresses[chain]) {
            throw new Error(`Chain ${chain} is not supported by Mendi protocol`);
        }

        // Check if the asset is supported on the chain
        if (!tokenAddresses[chain][assetLower]) {
            throw new Error(`Asset ${asset} is not supported on ${chain} by Mendi protocol`);
        }

        return ethers.utils.getAddress(tokenAddresses[chain][assetLower]);
    }

    /**
     * Get decimals for the given asset
     */
    private getAssetDecimals(asset: string): number {
        const decimalsMap: Record<string, number> = {
            usdc: 6,
            usdt: 6,
            dai: 18,
            wbtc: 8,
            mnd: 18,
            eth: 18,
        };

        return decimalsMap[asset.toLowerCase()] || 18;
    }

    /**
     * Supply assets to Mendi
     */
    async supply(params: SupplyParameters): Promise<string> {
        try {
            const { chain, asset, amount } = params;

            // Setup Mendi client
            const { signer } = await this.setupMendiClient(chain as SupportedChain);

            // Get token decimals
            const decimals = this.getAssetDecimals(asset);

            // Calculate amount in smallest units (e.g., wei for ETH)
            const amountInSmallestUnits = ethers.utils.parseUnits(amount.toString(), decimals);

            // For ETH, we handle differently
            if (asset.toLowerCase() === 'eth') {
                edwinLogger.debug(`Supplying ${amount} ETH to Mendi on ${chain}`);

                // Create contract instance for mETH
                const mEthAbi = ['function mint() external payable returns (uint256)'];
                const mEthAddress = this.getMTokenAddress(chain as SupportedEVMChain, 'eth');
                const mEthContract = new ethers.Contract(mEthAddress, mEthAbi, signer);

                // Supply ETH to Mendi (mint mETH)
                const tx = await mEthContract.mint({
                    value: amountInSmallestUnits,
                });

                // Wait for transaction confirmation
                await tx.wait(1);

                return `Successfully supplied ${amount} ETH to Mendi on ${chain}`;
            } else if (asset.toLowerCase() === 'usdc') {
                const usdcTokenAddress = this.getUnderlyingTokenAddress(chain as SupportedEVMChain, 'usdc');
                const mUsdcTokenAddress = this.getMTokenAddress(chain as SupportedEVMChain, 'usdc');

                edwinLogger.debug(`Approving ${amount} USDC for Mendi on ${chain}`);

                try {
                    // Create contract instance for USDC token
                    const erc20Abi = [
                        'function approve(address spender, uint256 amount) external returns (bool)',
                        'function decimals() external view returns (uint8)',
                    ];
                    const tokenContract = new ethers.Contract(usdcTokenAddress, erc20Abi, signer);

                    // Approve mToken to spend underlying token
                    const approveTx = await tokenContract.approve(mUsdcTokenAddress, amountInSmallestUnits);
                    await approveTx.wait(1);

                    edwinLogger.debug(`Supplying ${amount} USDC to Mendi on ${chain}`);

                    // Create contract instance for mUSDC token
                    const mTokenAbi = ['function mint(uint256 mintAmount) external returns (uint256)'];
                    const mTokenContract = new ethers.Contract(mUsdcTokenAddress, mTokenAbi, signer);

                    // Supply asset to Mendi (mint mToken)
                    const supplyTx = await mTokenContract.mint(amountInSmallestUnits);
                    await supplyTx.wait(1);

                    return `Successfully supplied ${amount} USDC to Mendi on ${chain}`;
                } catch (error) {
                    const err = error as MendiError;
                    edwinLogger.error(`Error in USDC supply process: ${err.message || err}`);
                    throw new Error(`Failed in USDC supply process: ${err.message || err}`);
                }
            } else {
                // Generic implementation for other supported assets
                const tokenAddress = this.getUnderlyingTokenAddress(chain as SupportedEVMChain, asset);
                const mTokenAddress = this.getMTokenAddress(chain as SupportedEVMChain, asset);

                edwinLogger.debug(`Approving ${amount} ${asset} for Mendi on ${chain}`);

                // Create contract instance for token
                const erc20Abi = [
                    'function approve(address spender, uint256 amount) external returns (bool)',
                    'function decimals() external view returns (uint8)',
                ];
                const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, signer);

                // Approve mToken to spend underlying token
                const approveTx = await tokenContract.approve(mTokenAddress, amountInSmallestUnits);
                await approveTx.wait(1);

                edwinLogger.debug(`Supplying ${amount} ${asset} to Mendi on ${chain}`);

                // Create contract instance for mToken
                const mTokenAbi = ['function mint(uint256 mintAmount) external returns (uint256)'];
                const mTokenContract = new ethers.Contract(mTokenAddress, mTokenAbi, signer);

                // Supply asset to Mendi (mint mToken)
                const supplyTx = await mTokenContract.mint(amountInSmallestUnits);
                await supplyTx.wait(1);

                return `Successfully supplied ${amount} ${asset} to Mendi on ${chain}`;
            }
        } catch (error) {
            const err = error as MendiError;
            edwinLogger.error(`Error supplying to Mendi: ${err.message || err}`);
            throw new Error(`Failed to supply to Mendi: ${err.message || err}`);
        }
    }

    /**
     * Withdraw assets from Mendi
     */
    async withdraw(params: WithdrawParameters): Promise<string> {
        try {
            const { chain, asset, amount } = params;

            // Setup Mendi client
            const { signer } = await this.setupMendiClient(chain as SupportedChain);

            // Get token decimals
            const decimals = this.getAssetDecimals(asset);

            // Calculate amount in smallest units (e.g., wei for ETH)
            const amountInSmallestUnits = ethers.utils.parseUnits(amount.toString(), decimals);

            edwinLogger.debug(`Withdrawing ${amount} ${asset} from Mendi on ${chain}`);

            // Get mToken address for the asset
            const mTokenAddress = this.getMTokenAddress(chain as SupportedEVMChain, asset);

            // Create contract instance for mToken
            const mTokenAbi = [
                'function redeem(uint256 redeemTokens) external returns (uint256)',
                'function redeemUnderlying(uint256 redeemAmount) external returns (uint256)',
            ];
            const mTokenContract = new ethers.Contract(mTokenAddress, mTokenAbi, signer);

            // Withdraw asset from Mendi (redeem mToken)
            // Using redeemUnderlying to withdraw exact amount of underlying asset
            const withdrawTx = await mTokenContract.redeemUnderlying(amountInSmallestUnits);
            await withdrawTx.wait(1);

            return `Successfully withdrew ${amount} ${asset} from Mendi on ${chain}`;
        } catch (error) {
            const err = error as MendiError;
            edwinLogger.error(`Error withdrawing from Mendi: ${err.message || err}`);
            throw new Error(`Failed to withdraw from Mendi: ${err.message || err}`);
        }
    }
}

import Compound from '@compound-finance/compound-js';
import { ethers, providers } from 'ethers';
import { EdwinEVMWallet } from '../../core/wallets/evm_wallet/evm_wallet';
import { type SupportedChain, type SupportedEVMChain } from '../../core/types';
import edwinLogger from '../../utils/logger';
import { SupplyParameters, WithdrawParameters } from './parameters';
import { EdwinService } from '../../core/classes/edwinToolProvider';

// NOTE: Using CompoundInstance type for compound since the type definitions are incomplete
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCompound = any;

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
     * Set up Compound client with the correct provider and wallet for Mendi
     */
    private async setupMendi(chain: SupportedChain): Promise<{
        compound: AnyCompound;
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

        // Create Compound instance for Mendi - using the RPC URL for Linea
        const compound = Compound(rpcUrl) as AnyCompound;

        return {
            compound,
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
                eth: '0xf401D1482DaC313EAD2Cf6aD33585C679b24c51b', // mETH
                usdc: '0xAFb95cc0BD320648B3E8Df6595bD18Ec8134581f', // mUSDC
                usdt: '0x8cFe327CEc66d1C090Dd72bd0FF11d690C33a2Eb', // mUSDT
                dai: '0xC5212D0A8A74E6BBF6fcA7d2C02C5cF1F6A7388D', // mDAI
                wbtc: '0xb28C9BbBD10c05C979D04865E5F0D6fE1cB530F7', // mWBTC
                mnd: '0x4C5Bba045bf4b63D93C7C6F45544E977C3C63995', // mMND (Mendi token)
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

        return mTokens[chain][assetLower];
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
                eth: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH uses this special address
                usdc: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff', // USDC on Linea
                usdt: '0xA219439258ca9da29E9Cc4cE5596924745e12B93', // USDT on Linea
                dai: '0x4AF15ec2A0BD43Db75dd04E62FAA3B8EF36b00d5', // DAI on Linea
                wbtc: '0x3aAB2285ddcDdaD8edf438C1bAB47e1a9D05a9b4', // WBTC on Linea
                mnd: '0x463913D3a3D3D350C60CF87EFE366507dDCB5AFd', // MND token
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

        return tokenAddresses[chain][assetLower];
    }

    /**
     * Supply assets to Mendi
     */
    async supply(params: SupplyParameters): Promise<string> {
        try {
            const { chain, asset, amount } = params;

            // Setup Mendi client
            const { compound, userAddress } = await this.setupMendi(chain as SupportedChain);

            // Get the mToken for the asset
            const mTokenAddress = this.getMTokenAddress(chain as SupportedEVMChain, asset);

            // For ETH, we need to use special ETH handling
            if (asset.toLowerCase() === 'eth') {
                edwinLogger.debug(`Supplying ${amount} ETH to Mendi on ${chain}`);
                const trx = await compound.supply('ETH', amount, { from: userAddress });
                await trx.wait(1);
                return `Successfully supplied ${amount} ETH to Mendi on ${chain}`;
            } else {
                // Get underlying token address
                const underlyingAddress = this.getUnderlyingTokenAddress(chain as SupportedEVMChain, asset);

                // Approve the mToken to spend the underlying token
                edwinLogger.debug(`Approving ${amount} ${asset} for Mendi on ${chain}`);
                const decimals = await compound.decimals(underlyingAddress);
                const scaledAmount = (amount * Math.pow(10, decimals)).toString();

                const approvalTrx = await compound.approve({
                    asset: asset.toUpperCase(),
                    to: mTokenAddress,
                    amount: scaledAmount,
                    from: userAddress,
                });
                await approvalTrx.wait(1);

                // Supply the asset
                edwinLogger.debug(`Supplying ${amount} ${asset} to Mendi on ${chain}`);
                const supplyTrx = await compound.supply({
                    asset: asset.toUpperCase(),
                    amount: amount.toString(),
                    from: userAddress,
                });
                await supplyTrx.wait(1);

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
            const { compound, userAddress } = await this.setupMendi(chain as SupportedChain);

            // Withdraw the asset
            edwinLogger.debug(`Withdrawing ${amount} ${asset} from Mendi on ${chain}`);

            if (asset.toLowerCase() === 'eth') {
                // For ETH, use the mETH address
                const mETH = this.getMTokenAddress(chain as SupportedEVMChain, 'eth');
                const trx = await compound.redeem(mETH, amount, { from: userAddress });
                await trx.wait(1);
                return `Successfully withdrew ${amount} ETH from Mendi on ${chain}`;
            } else {
                const trx = await compound.redeem({
                    asset: asset.toUpperCase(),
                    amount: amount.toString(),
                    from: userAddress,
                });
                await trx.wait(1);
                return `Successfully withdrew ${amount} ${asset} from Mendi on ${chain}`;
            }
        } catch (error) {
            const err = error as MendiError;
            edwinLogger.error(`Error withdrawing from Mendi: ${err.message || err}`);
            throw new Error(`Failed to withdraw from Mendi: ${err.message || err}`);
        }
    }
}

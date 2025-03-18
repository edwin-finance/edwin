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

interface CompoundError extends Error {
    code?: string;
    error?: {
        body?: string;
    };
    reason?: string;
}

export class CompoundV2Service extends EdwinService {
    // Currently Compound V2 is supported on Ethereum mainnet and Goerli testnet
    // Note: We assume these chains are defined in the SupportedChain type
    public supportedChains: SupportedChain[] = ['mainnet', 'goerli'] as SupportedChain[];
    private wallet: EdwinEVMWallet;

    constructor(wallet: EdwinEVMWallet) {
        super();
        this.wallet = wallet;
    }

    async getPortfolio(): Promise<string> {
        return '';
    }

    private getCompoundChain(chain: string): SupportedEVMChain {
        const supportedChains = this.supportedChains.map(c => c.toLowerCase());
        if (!supportedChains.includes((chain as SupportedChain).toLowerCase())) {
            throw new Error(`Chain ${chain} is not supported by Compound V2 protocol`);
        }
        return chain as SupportedEVMChain;
    }

    /**
     * Set up Compound client with the correct provider and wallet
     */
    private async setupCompound(chain: SupportedChain): Promise<{
        compound: AnyCompound;
        provider: providers.Provider;
        signer: ethers.Wallet;
        userAddress: string;
    }> {
        // Get the chain and switch wallet
        const compoundChain = this.getCompoundChain(chain);
        this.wallet.switchChain(compoundChain);

        // Setup wallet client and provider
        const walletClient = this.wallet.getWalletClient(compoundChain);
        const rpcUrl = walletClient.transport.url;
        const provider = new providers.JsonRpcProvider(rpcUrl);
        const ethers_wallet = this.wallet.getEthersWallet(walletClient, provider);
        ethers_wallet.connect(provider);

        // Create Compound instance - just pass the URL
        const compound = Compound(rpcUrl) as AnyCompound;

        return {
            compound,
            provider,
            signer: ethers_wallet,
            userAddress: ethers_wallet.address,
        };
    }

    /**
     * Get cToken address for the given asset
     */
    private getCTokenAddress(chain: SupportedEVMChain, asset: string): string {
        // Convert asset to lowercase for case-insensitive comparison
        const assetLower = asset.toLowerCase();

        // Define cToken addresses for supported assets
        const cTokens: Record<string, Record<string, string>> = {
            mainnet: {
                dai: '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643', // cDAI
                usdc: '0x39AA39c021dfbaE8faC545936693aC917d5E7563', // cUSDC
                eth: '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5', // cETH
                bat: '0x6C8c6b02E7b2BE14d4fA6022Dfd6d75921D90E4E', // cBAT
                usdt: '0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9', // cUSDT
                wbtc: '0xC11b1268C1A384e55C48c2391d8d480264A3A7F4', // cWBTC
                zrx: '0xB3319f5D18Bc0D84dD1b4825Dcde5d5f7266d407', // cZRX
                comp: '0x70e36f6BF80a52b3B46b3aF8e106CC0ed743E8e4', // cCOMP
                sai: '0xF5DCe57282A584D2746FaF1593d3121Fcac444dC', // cSAI
                uni: '0x35A18000230DA775CAc24873d00Ff85BccdeD550', // cUNI
            },
            goerli: {
                dai: '0xe5cd8f092bd8d3ca1d4e5374e89e6e0f5e1ef741',
                usdc: '0x822397d9a55d0fefd20f5c4bcab33c5f65bd28eb',
                eth: '0x20572e4c090f15667cf7378e16fad2ea0e2f3eff',
            },
        };

        // Check if the chain is supported
        if (!cTokens[chain]) {
            throw new Error(`Chain ${chain} is not supported by Compound V2 protocol`);
        }

        // Check if the asset is supported on the chain
        if (!cTokens[chain][assetLower]) {
            throw new Error(`Asset ${asset} is not supported on ${chain} by Compound V2 protocol`);
        }

        return cTokens[chain][assetLower];
    }

    /**
     * Supply assets to Compound V2
     */
    async supply(params: SupplyParameters): Promise<string> {
        try {
            const { chain, asset, amount } = params;

            // Setup Compound client
            const { compound, userAddress } = await this.setupCompound(chain as SupportedChain);

            // Get the cToken for the asset
            const cTokenAddress = this.getCTokenAddress(chain as SupportedEVMChain, asset);

            // For ETH, we need to use special ETH handling
            if (asset.toLowerCase() === 'eth') {
                edwinLogger.debug(`Supplying ${amount} ETH to Compound V2 on ${chain}`);
                const trx = await compound.supply('ETH', amount, { from: userAddress });
                await trx.wait(1);
                return `Successfully supplied ${amount} ETH to Compound V2 on ${chain}`;
            } else {
                // For ERC20 tokens, we need to approve first
                const underlyingAddress = await compound.getTokenAddress(asset.toUpperCase());

                // Approve the cToken to spend the underlying token
                edwinLogger.debug(`Approving ${amount} ${asset} for Compound V2 on ${chain}`);
                const decimals = await compound.decimals(underlyingAddress);
                const scaledAmount = (amount * Math.pow(10, decimals)).toString();

                const approvalTrx = await compound.approve({
                    asset: asset.toUpperCase(),
                    to: cTokenAddress,
                    amount: scaledAmount,
                    from: userAddress,
                });
                await approvalTrx.wait(1);

                // Supply the asset
                edwinLogger.debug(`Supplying ${amount} ${asset} to Compound V2 on ${chain}`);
                const supplyTrx = await compound.supply({
                    asset: asset.toUpperCase(),
                    amount: amount.toString(),
                    from: userAddress,
                });
                await supplyTrx.wait(1);

                return `Successfully supplied ${amount} ${asset} to Compound V2 on ${chain}`;
            }
        } catch (error) {
            const err = error as CompoundError;
            edwinLogger.error(`Error supplying to Compound V2: ${err.message || err}`);
            throw new Error(`Failed to supply to Compound V2: ${err.message || err}`);
        }
    }

    /**
     * Withdraw assets from Compound V2
     */
    async withdraw(params: WithdrawParameters): Promise<string> {
        try {
            const { chain, asset, amount } = params;

            // Setup Compound client
            const { compound, userAddress } = await this.setupCompound(chain as SupportedChain);

            // Withdraw the asset
            edwinLogger.debug(`Withdrawing ${amount} ${asset} from Compound V2 on ${chain}`);

            if (asset.toLowerCase() === 'eth') {
                // For ETH, use the cETH address
                const cETH = this.getCTokenAddress(chain as SupportedEVMChain, 'eth');
                const trx = await compound.redeem(cETH, amount, { from: userAddress });
                await trx.wait(1);
                return `Successfully withdrew ${amount} ETH from Compound V2 on ${chain}`;
            } else {
                const trx = await compound.redeem({
                    asset: asset.toUpperCase(),
                    amount: amount.toString(),
                    from: userAddress,
                });
                await trx.wait(1);
                return `Successfully withdrew ${amount} ${asset} from Compound V2 on ${chain}`;
            }
        } catch (error) {
            const err = error as CompoundError;
            edwinLogger.error(`Error withdrawing from Compound V2: ${err.message || err}`);
            throw new Error(`Failed to withdraw from Compound V2: ${err.message || err}`);
        }
    }
}

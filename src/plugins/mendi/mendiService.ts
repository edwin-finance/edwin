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

// Token addresses used by Mendi protocol
const MENDI_TOKEN_ADDRESSES = {
    linea: {
        // Underlying tokens
        tokens: {
            usdc: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff',
        },
        // Mendi tokens (markets)
        markets: {
            usdc: '0x333D8b480BDB25eA7Be4Dd87EEB359988CE1b30D',
        },
    },
};

export class MendiService extends EdwinService {
    // Mendi is supported on Linea mainnet
    public supportedChains: SupportedEVMChain[] = ['linea'] as SupportedEVMChain[];
    private wallet: EdwinEVMWallet;

    constructor(wallet: EdwinEVMWallet) {
        super();
        this.wallet = wallet;
    }

    async getPortfolio(): Promise<string> {
        return '';
    }

    private getMendiChain(chain: string): SupportedEVMChain {
        const matchingChain = this.supportedChains.find(c => c.toLowerCase() === chain.toLowerCase());
        if (!matchingChain) {
            throw new Error(`Chain ${chain} is not supported by Mendi protocol`);
        }
        return matchingChain;
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
            // Use getMendiChain for validation
            const mendiChain = this.getMendiChain(chain);

            // Setup Mendi client
            const { signer } = await this.setupMendiClient(mendiChain);

            // Get token decimals
            const decimals = this.getAssetDecimals(asset);

            // Calculate amount in smallest units (e.g., wei for ETH)
            const amountInSmallestUnits = ethers.utils.parseUnits(amount.toString(), decimals);

            const chainAddresses = MENDI_TOKEN_ADDRESSES['linea'];
            const tokenAddress = chainAddresses.tokens[asset.toLowerCase() as keyof typeof chainAddresses.tokens];
            if (!tokenAddress) {
                throw new Error(`Asset ${asset} is not yet fully implemented for supply in Mendi`);
            }
            const meTokenAddress = chainAddresses.markets[asset.toLowerCase() as keyof typeof chainAddresses.markets];
            if (!meTokenAddress) {
                throw new Error(`Asset ${asset} is not yet fully implemented for supply in Mendi`);
            }

            edwinLogger.debug(`Approving ${amount} ${asset} for Mendi on ${chain}`);
            // Create contract instance for USDC token
            const erc20Abi = [
                'function approve(address spender, uint256 amount) external returns (bool)',
                'function decimals() external view returns (uint8)',
            ];
            const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, signer);

            // Approve mToken to spend underlying token
            const approveTx = await tokenContract.approve(meTokenAddress, amountInSmallestUnits);
            await approveTx.wait(1);

            edwinLogger.debug(`Supplying ${amount} ${asset} to Mendi on ${chain}`);

            // Create contract instance for mUSDC token
            const mTokenAbi = ['function mint(uint256 mintAmount) external returns (uint256)'];
            const mTokenContract = new ethers.Contract(meTokenAddress, mTokenAbi, signer);

            // Supply asset to Mendi (mint mToken)
            const supplyTx = await mTokenContract.mint(amountInSmallestUnits);
            await supplyTx.wait(1);
            return `Successfully supplied ${amount} ${asset} to Mendi on ${chain}`;
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
            // Use getMendiChain for validation
            const mendiChain = this.getMendiChain(chain);

            // Setup Mendi client
            const { signer } = await this.setupMendiClient(mendiChain);

            // Get token decimals
            const decimals = this.getAssetDecimals(asset);

            // Calculate amount in smallest units (e.g., wei for ETH)
            const amountInSmallestUnits = ethers.utils.parseUnits(amount.toString(), decimals);

            edwinLogger.debug(`Withdrawing ${amount} ${asset} from Mendi on ${chain}`);

            const chainAddresses = MENDI_TOKEN_ADDRESSES['linea'];
            const tokenAddress = chainAddresses.tokens[asset.toLowerCase() as keyof typeof chainAddresses.tokens];
            if (!tokenAddress) {
                throw new Error(`Asset ${asset} is not yet fully implemented for withdraw in Mendi`);
            }
            const meTokenAddress = chainAddresses.markets[asset.toLowerCase() as keyof typeof chainAddresses.markets];
            if (!meTokenAddress) {
                throw new Error(`Asset ${asset} is not yet fully implemented for withdraw in Mendi`);
            }

            // Create contract instance for mToken
            const mTokenAbi = [
                'function redeem(uint256 redeemTokens) external returns (uint256)',
                'function redeemUnderlying(uint256 redeemAmount) external returns (uint256)',
            ];
            const mTokenContract = new ethers.Contract(meTokenAddress, mTokenAbi, signer);

            // Withdraw asset from Mendi (redeem mToken)
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

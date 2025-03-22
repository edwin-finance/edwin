import { ethers, providers } from 'ethers';
import { EdwinEVMWallet } from '../../core/wallets/evm_wallet/evm_wallet';
import { type SupportedChain, type SupportedEVMChain } from '../../core/types';
import { EdwinService } from '../../core/classes/edwinToolProvider';
import { StakeParameters, ClaimParameters } from './parameters';
import edwinLogger from '../../utils/logger';

// Renzo Protocol contract addresses
const RENZO_RESTAKE_MANAGER = '0x74a09653A083691711cF8215a6ab074BB4e99ef5';

// ABI fragments for the Renzo Protocol contract
const RENZO_ABI = [
    // Staking function
    'function depositETH() external payable',
    // Claiming function
    'function requestWithdraw(uint256 amount) external',
    // View function to check withdrawal status
    'function withdrawalRequestsByUser(address user) external view returns (uint256)',
];

export class RenzoProtocol extends EdwinService {
    private wallet: EdwinEVMWallet;

    constructor(wallet: EdwinEVMWallet) {
        super();
        this.wallet = wallet;
    }

    supportedChains: SupportedChain[] = ['mainnet'];

    async getPortfolio(): Promise<string> {
        return '';
    }

    private getEthersProvider(chain: SupportedEVMChain): providers.JsonRpcProvider {
        const walletClient = this.wallet.getWalletClient(chain);
        return new providers.JsonRpcProvider(walletClient.transport.url);
    }

    private getRenzoContract(provider: providers.Provider, _walletAddress: string): ethers.Contract {
        return new ethers.Contract(RENZO_RESTAKE_MANAGER, RENZO_ABI, provider);
    }

    async stake(params: StakeParameters): Promise<string> {
        const { chain, amount } = params;
        edwinLogger.info(`Staking ${amount} ETH to Renzo Protocol on ${chain}`);

        try {
            if (amount <= 0) {
                throw new Error('Amount must be greater than 0');
            }

            // Switch to the correct chain
            this.wallet.switchChain(chain as SupportedEVMChain);

            // Get wallet client and provider
            const walletClient = this.wallet.getWalletClient(chain as SupportedEVMChain);
            const provider = this.getEthersProvider(chain as SupportedEVMChain);

            // Connect wallet
            const ethers_wallet = this.wallet.getEthersWallet(walletClient, provider);

            // Initialize contract with signer
            const contract = this.getRenzoContract(provider, walletClient.account?.address as string);
            const contractWithSigner = contract.connect(ethers_wallet);

            // Convert amount to wei
            const amountInWei = ethers.utils.parseEther(amount.toString());

            // Submit transaction
            const tx = await contractWithSigner.depositETH({
                value: amountInWei,
            });

            // Wait for transaction confirmation
            const receipt = await tx.wait();

            return `Successfully staked ${amount} ETH with Renzo Protocol. Transaction hash: ${receipt.transactionHash}`;
        } catch (error: unknown) {
            edwinLogger.error('Renzo staking error:', error);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Renzo staking failed: ${message}`);
        }
    }

    async claim(params: ClaimParameters): Promise<string> {
        const { chain } = params;
        edwinLogger.info(`Claiming rewards from Renzo Protocol on ${chain}`);

        try {
            // Switch to the correct chain
            this.wallet.switchChain(chain as SupportedEVMChain);

            // Get wallet client and provider
            const walletClient = this.wallet.getWalletClient(chain as SupportedEVMChain);
            const provider = this.getEthersProvider(chain as SupportedEVMChain);

            // Connect wallet
            const ethers_wallet = this.wallet.getEthersWallet(walletClient, provider);

            // Initialize contract with signer
            const contract = this.getRenzoContract(provider, walletClient.account?.address as string);
            const contractWithSigner = contract.connect(ethers_wallet);

            // Get user's staked balance
            const stakedBalance = await contractWithSigner.withdrawalRequestsByUser(walletClient.account?.address);

            if (stakedBalance.eq(0)) {
                throw new Error('No staked balance available to claim');
            }

            // Request withdrawal of all staked ETH
            const tx = await contractWithSigner.requestWithdraw(stakedBalance);

            // Wait for transaction confirmation
            const receipt = await tx.wait();

            return `Successfully requested withdrawal of rewards from Renzo Protocol. Transaction hash: ${receipt.transactionHash}`;
        } catch (error: unknown) {
            edwinLogger.error('Renzo claiming error:', error);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Renzo claiming failed: ${message}`);
        }
    }
}

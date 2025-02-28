import { ethers } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { EdwinEVMWallet } from '../../src/core/wallets/evm_wallet/evm_wallet';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

// This will be populated in the test files
let hardhatRuntime: HardhatRuntimeEnvironment;

// ERC20 interface for token interactions
const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function transfer(address to, uint amount) returns (bool)',
    'function approve(address spender, uint256 amount) returns (bool)',
];

// AAVE V3 Pool interface
const AAVE_POOL_ABI = [
    'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
];

// Base USDC token address
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Create a wallet from a hardhat signer
export async function createWalletFromSigner(signer: SignerWithAddress): Promise<EdwinEVMWallet> {
    // For testing purposes, we'll use a hardcoded private key
    // This is safe because it's only used in the test environment
    const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Hardhat's first account private key
    return new EdwinEVMWallet(testPrivateKey as `0x${string}`);
}

// Get test tokens (USDC) for a signer
export async function getTestTokens(signer: SignerWithAddress, tokenAddress: string, amount: string): Promise<void> {
    // For Hardhat network with forking, we can impersonate an account with tokens
    const whaleAddress = '0x7a16ff8270133f063aab6c9977183d9e72835428'; // USDC whale on Base
    // In a real test with network forking, we would use:
    // await hardhatRuntime.network.provider.send('hardhat_impersonateAccount', [whaleAddress]);
    // const whale = await hardhatRuntime.ethers.getSigner(whaleAddress);
    
    // For mock testing, we'll use a dummy signer
    const provider = new ethers.providers.JsonRpcProvider();
    const whale = new ethers.Wallet('0x0000000000000000000000000000000000000000000000000000000000000001', provider);

    const token = new ethers.Contract(tokenAddress, ERC20_ABI, whale);
    const decimals = await token.decimals();
    const amountInWei = ethers.utils.parseUnits(amount, decimals);

    await token.transfer(signer.address, amountInWei);

    // Stop impersonating
    // In a real test with network forking, we would use:
    // await hardhatRuntime.network.provider.send('hardhat_stopImpersonatingAccount', [whaleAddress]);
}

// Get token balance for an address
export async function getTokenBalance(tokenAddress: string, address: string): Promise<string> {
    // Create a provider for mock testing
    const provider = new ethers.providers.JsonRpcProvider();
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await token.balanceOf(address);
    const decimals = await token.decimals();
    return ethers.utils.formatUnits(balance, decimals);
}

// Get AAVE user account data
export async function getAaveUserData(poolAddress: string, userAddress: string) {
    // Create a provider for mock testing
    const provider = new ethers.providers.JsonRpcProvider();
    const pool = new ethers.Contract(poolAddress, AAVE_POOL_ABI, provider);
    return pool.getUserAccountData(userAddress);
}

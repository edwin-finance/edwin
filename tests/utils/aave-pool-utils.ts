import { Contract } from 'ethers';
import { AAVE_ADDRESSES } from './aave-addresses';

// We'll use require for hardhat to avoid TypeScript import issues
const hre = require('hardhat');
const { ethers } = hre;

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
    'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
    'function withdraw(address asset, uint256 amount, address to)',
    'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
];

// Get AAVE Pool contract instance
export async function getAavePool() {
    return new ethers.Contract(AAVE_ADDRESSES.POOL, AAVE_POOL_ABI, ethers.provider);
}

// Get ERC20 token contract instance
export async function getERC20(tokenAddress: string) {
    return new ethers.Contract(tokenAddress, ERC20_ABI, ethers.provider);
}

// Supply tokens to AAVE
export async function supplyToAave(
    signer: any,
    tokenAddress: string,
    amount: string,
    onBehalfOf?: string
) {
    const token = await getERC20(tokenAddress);
    const pool = await getAavePool();
    const poolWithSigner = pool.connect(signer);
    const tokenWithSigner = token.connect(signer);
    
    // Approve tokens for AAVE Pool
    await tokenWithSigner.approve(AAVE_ADDRESSES.POOL, amount);
    
    // Supply tokens to AAVE
    return poolWithSigner.supply(tokenAddress, amount, onBehalfOf || signer.address, 0);
}

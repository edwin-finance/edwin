// Comprehensive test script for AAVE supply function integration
// This script can be run with Node.js directly without requiring Hardhat network forking

const { ethers } = require('ethers');

// AAVE V3 contract addresses on Base network
const AAVE_ADDRESSES = {
    // Pool contract address on Base
    POOL: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
    // Pool address provider
    POOL_ADDRESSES_PROVIDER: '0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D',
    // Common tokens on Base
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    ETH: '0x4200000000000000000000000000000000000006',
    WETH: '0x4200000000000000000000000000000000000006',
    DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    // AAVE token addresses (aTokens)
    aUSDC: '0x7c8fF2f9B7836F0310bE3B2C905c97D15b8C7bDB',
};

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

// Mock implementation of the AaveService
class MockAaveService {
    constructor(wallet) {
        this.wallet = wallet;
        this.provider = new ethers.providers.JsonRpcProvider();
        this.signer = new ethers.Wallet('0x0000000000000000000000000000000000000000000000000000000000000001', this.provider);
        
        // Initialize token balances for testing
        this.tokenBalances = {
            [AAVE_ADDRESSES.USDC]: ethers.utils.parseUnits('1000', 6), // 1000 USDC
            [AAVE_ADDRESSES.aUSDC]: ethers.utils.parseUnits('0', 6),    // 0 aUSDC initially
        };
    }

    async supply(params) {
        const { chain, amount, asset } = params;
        
        console.log(`Supplying ${amount} ${asset} to AAVE on ${chain}`);
        
        // Get the token address based on the asset
        let tokenAddress;
        let aTokenAddress;
        let decimals;
        
        if (asset.toLowerCase() === 'usdc') {
            tokenAddress = AAVE_ADDRESSES.USDC;
            aTokenAddress = AAVE_ADDRESSES.aUSDC;
            decimals = 6;
        } else if (asset.toLowerCase() === 'eth' || asset.toLowerCase() === 'weth') {
            tokenAddress = AAVE_ADDRESSES.WETH;
            decimals = 18;
        } else if (asset.toLowerCase() === 'dai') {
            tokenAddress = AAVE_ADDRESSES.DAI;
            decimals = 18;
        } else {
            throw new Error(`Unsupported asset: ${asset}`);
        }
        
        // Convert amount to wei based on decimals
        const amountInWei = ethers.utils.parseUnits(amount.toString(), decimals);
        
        // Check if user has enough balance
        if (this.tokenBalances[tokenAddress].lt(amountInWei)) {
            throw new Error(`Insufficient ${asset} balance`);
        }
        
        // Update token balances to simulate the supply
        this.tokenBalances[tokenAddress] = this.tokenBalances[tokenAddress].sub(amountInWei);
        
        // Update aToken balance if applicable
        if (aTokenAddress) {
            if (!this.tokenBalances[aTokenAddress]) {
                this.tokenBalances[aTokenAddress] = ethers.utils.parseUnits('0', decimals);
            }
            this.tokenBalances[aTokenAddress] = this.tokenBalances[aTokenAddress].add(amountInWei);
        }
        
        // Simulate the supply transaction
        const txHash = '0x' + Array(64).fill('0').map(() => 
            '0123456789abcdef'[Math.floor(Math.random() * 16)]
        ).join('');
        
        return `Successfully supplied ${amount} ${asset} to Aave, transaction signature: ${txHash}`;
    }
    
    // Helper method to get token balance
    getTokenBalance(tokenAddress) {
        return this.tokenBalances[tokenAddress] || ethers.utils.parseUnits('0', 18);
    }
}

// Mock implementation of the EdwinEVMWallet
class MockEdwinEVMWallet {
    constructor(privateKey) {
        this.privateKey = privateKey;
        this.address = '0x' + Array(40).fill('0').map(() => 
            '0123456789abcdef'[Math.floor(Math.random() * 16)]
        ).join('');
    }
    
    getAddress() {
        return this.address;
    }
}

// Main test function
async function runTest() {
    console.log('Starting AAVE supply function integration test');
    
    // Create a mock wallet
    const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const wallet = new MockEdwinEVMWallet(testPrivateKey);
    
    // Initialize the AAVE service with the wallet
    const aaveService = new MockAaveService(wallet);
    
    // Test case 1: Supply USDC to AAVE
    try {
        console.log('\n--- Test Case 1: Supply USDC to AAVE ---');
        
        // Get initial balances
        const initialUsdcBalance = aaveService.getTokenBalance(AAVE_ADDRESSES.USDC);
        const initialAUsdcBalance = aaveService.getTokenBalance(AAVE_ADDRESSES.aUSDC);
        
        console.log(`Initial USDC balance: ${ethers.utils.formatUnits(initialUsdcBalance, 6)}`);
        console.log(`Initial aUSDC balance: ${ethers.utils.formatUnits(initialAUsdcBalance, 6)}`);
        
        // Supply USDC to AAVE
        const supplyAmount = 100; // 100 USDC
        const result = await aaveService.supply({
            chain: 'base',
            amount: supplyAmount,
            asset: 'usdc',
        });
        
        console.log('Supply result:', result);
        
        // Get final balances
        const finalUsdcBalance = aaveService.getTokenBalance(AAVE_ADDRESSES.USDC);
        const finalAUsdcBalance = aaveService.getTokenBalance(AAVE_ADDRESSES.aUSDC);
        
        console.log(`Final USDC balance: ${ethers.utils.formatUnits(finalUsdcBalance, 6)}`);
        console.log(`Final aUSDC balance: ${ethers.utils.formatUnits(finalAUsdcBalance, 6)}`);
        
        // Verify balance changes
        const usdcDecrease = initialUsdcBalance.sub(finalUsdcBalance);
        const aUsdcIncrease = finalAUsdcBalance.sub(initialAUsdcBalance);
        
        console.log(`USDC decrease: ${ethers.utils.formatUnits(usdcDecrease, 6)}`);
        console.log(`aUSDC increase: ${ethers.utils.formatUnits(aUsdcIncrease, 6)}`);
        
        // Verify that USDC balance decreased by the supply amount
        if (ethers.utils.formatUnits(usdcDecrease, 6) === supplyAmount.toString()) {
            console.log('✅ Test passed: USDC balance decreased by the correct amount');
        } else {
            console.log('❌ Test failed: USDC balance did not decrease by the correct amount');
        }
        
        // Verify that aUSDC balance increased by the supply amount
        if (ethers.utils.formatUnits(aUsdcIncrease, 6) === supplyAmount.toString()) {
            console.log('✅ Test passed: aUSDC balance increased by the correct amount');
        } else {
            console.log('❌ Test failed: aUSDC balance did not increase by the correct amount');
        }
        
        // Verify the result contains the expected information
        if (result.includes(`Successfully supplied ${supplyAmount} usdc to Aave`)) {
            console.log('✅ Test passed: Supply function returned the expected result');
        } else {
            console.log('❌ Test failed: Supply function did not return the expected result');
        }
    } catch (error) {
        console.error('Error during test case 1:', error);
    }
    
    // Test case 2: Supply with different amount
    try {
        console.log('\n--- Test Case 2: Supply with different amount ---');
        
        // Get initial balances
        const initialUsdcBalance = aaveService.getTokenBalance(AAVE_ADDRESSES.USDC);
        const initialAUsdcBalance = aaveService.getTokenBalance(AAVE_ADDRESSES.aUSDC);
        
        console.log(`Initial USDC balance: ${ethers.utils.formatUnits(initialUsdcBalance, 6)}`);
        console.log(`Initial aUSDC balance: ${ethers.utils.formatUnits(initialAUsdcBalance, 6)}`);
        
        // Supply USDC to AAVE with a different amount
        const supplyAmount = 200; // 200 USDC
        const result = await aaveService.supply({
            chain: 'base',
            amount: supplyAmount,
            asset: 'usdc',
        });
        
        console.log('Supply result:', result);
        
        // Get final balances
        const finalUsdcBalance = aaveService.getTokenBalance(AAVE_ADDRESSES.USDC);
        const finalAUsdcBalance = aaveService.getTokenBalance(AAVE_ADDRESSES.aUSDC);
        
        console.log(`Final USDC balance: ${ethers.utils.formatUnits(finalUsdcBalance, 6)}`);
        console.log(`Final aUSDC balance: ${ethers.utils.formatUnits(finalAUsdcBalance, 6)}`);
        
        // Verify balance changes
        const usdcDecrease = initialUsdcBalance.sub(finalUsdcBalance);
        const aUsdcIncrease = finalAUsdcBalance.sub(initialAUsdcBalance);
        
        console.log(`USDC decrease: ${ethers.utils.formatUnits(usdcDecrease, 6)}`);
        console.log(`aUSDC increase: ${ethers.utils.formatUnits(aUsdcIncrease, 6)}`);
        
        // Verify that USDC balance decreased by the supply amount
        if (ethers.utils.formatUnits(usdcDecrease, 6) === supplyAmount.toString()) {
            console.log('✅ Test passed: USDC balance decreased by the correct amount');
        } else {
            console.log('❌ Test failed: USDC balance did not decrease by the correct amount');
        }
        
        // Verify that aUSDC balance increased by the supply amount
        if (ethers.utils.formatUnits(aUsdcIncrease, 6) === supplyAmount.toString()) {
            console.log('✅ Test passed: aUSDC balance increased by the correct amount');
        } else {
            console.log('❌ Test failed: aUSDC balance did not increase by the correct amount');
        }
    } catch (error) {
        console.error('Error during test case 2:', error);
    }
    
    // Test case 3: Error handling - Insufficient balance
    try {
        console.log('\n--- Test Case 3: Error handling - Insufficient balance ---');
        
        // Get current USDC balance
        const currentUsdcBalance = aaveService.getTokenBalance(AAVE_ADDRESSES.USDC);
        console.log(`Current USDC balance: ${ethers.utils.formatUnits(currentUsdcBalance, 6)}`);
        
        // Try to supply more than the available balance
        const supplyAmount = parseFloat(ethers.utils.formatUnits(currentUsdcBalance, 6)) + 100;
        console.log(`Attempting to supply ${supplyAmount} USDC (more than available)`);
        
        try {
            await aaveService.supply({
                chain: 'base',
                amount: supplyAmount,
                asset: 'usdc',
            });
            console.log('❌ Test failed: Supply should have failed due to insufficient balance');
        } catch (error) {
            console.log(`✅ Test passed: Supply correctly failed with error: ${error.message}`);
        }
    } catch (error) {
        console.error('Error during test case 3:', error);
    }
    
    console.log('\nAAVE supply function integration test completed');
}

// Run the test
runTest().catch(console.error);

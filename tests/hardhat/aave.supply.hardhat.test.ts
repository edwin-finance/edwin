import { expect } from 'chai';
import { Contract } from 'ethers';
import { AaveService } from '../../src/plugins/aave/aaveService';
import { EdwinEVMWallet } from '../../src/core/wallets/evm_wallet/evm_wallet';
import { AAVE_ADDRESSES } from '../utils/aave-addresses';
import { getERC20, getAavePool, supplyToAave } from '../utils/aave-pool-utils';

// We'll use require for hardhat to avoid TypeScript import issues
const hre = require('hardhat');

describe('AAVE Supply Function Integration Test', function () {
    let signer: any;
    let wallet: EdwinEVMWallet;
    let aaveService: AaveService;
    let usdcToken: Contract;
    let aavePool: Contract;
    let aUsdcToken: Contract;

    before(async function () {
        // This test requires forking the Base network
        // Skip if not in a forked environment
        if (!process.env.BASE_FORK_URL) {
            console.log('Skipping test: BASE_FORK_URL not set');
            this.skip();
        }

        // Get ethers and network from hardhat
        const { ethers, network } = hre;

        // Get signers from Hardhat
        [signer] = await ethers.getSigners();

        // Create Edwin wallet with the signer's private key
        // For testing purposes, we'll use a hardcoded private key
        const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Hardhat's first account private key
        wallet = new EdwinEVMWallet(testPrivateKey);

        // Initialize AAVE service with the wallet
        aaveService = new AaveService(wallet);

        // Get contract instances
        usdcToken = await getERC20(AAVE_ADDRESSES.USDC);
        aavePool = await getAavePool();
        aUsdcToken = await getERC20(AAVE_ADDRESSES.aUSDC);

        // Fund the signer with USDC
        // In a forked environment, we need to impersonate an account with USDC
        const whaleAddress = '0x7a16ff8270133f063aab6c9977183d9e72835428'; // USDC whale on Base
        await network.provider.send('hardhat_impersonateAccount', [whaleAddress]);
        const whale = await ethers.getSigner(whaleAddress);
        
        // Transfer USDC to the test signer
        const usdcWhale = usdcToken.connect(whale);
        const decimals = await usdcToken.decimals();
        const amount = ethers.utils.parseUnits('1000', decimals); // 1000 USDC
        await usdcWhale.transfer(signer.address, amount);
        
        // Stop impersonating
        await network.provider.send('hardhat_stopImpersonatingAccount', [whaleAddress]);
    });

    it('should supply USDC to AAVE and verify balance changes', async function () {
        // Get ethers from hardhat
        const { ethers } = hre;
        
        // Get initial balances
        const initialUsdcBalance = await usdcToken.balanceOf(signer.address);
        const initialAUsdcBalance = await aUsdcToken.balanceOf(signer.address);
        
        console.log(`Initial USDC balance: ${ethers.utils.formatUnits(initialUsdcBalance, 6)}`);
        console.log(`Initial aUSDC balance: ${ethers.utils.formatUnits(initialAUsdcBalance, 6)}`);

        // Supply USDC to AAVE using the Edwin SDK
        const supplyAmount = 100; // 100 USDC
        const result = await aaveService.supply({
            chain: 'base',
            amount: supplyAmount,
            asset: 'usdc',
        });

        console.log(`Supply result: ${result}`);

        // Get final balances
        const finalUsdcBalance = await usdcToken.balanceOf(signer.address);
        const finalAUsdcBalance = await aUsdcToken.balanceOf(signer.address);
        
        console.log(`Final USDC balance: ${ethers.utils.formatUnits(finalUsdcBalance, 6)}`);
        console.log(`Final aUSDC balance: ${ethers.utils.formatUnits(finalAUsdcBalance, 6)}`);

        // Verify balance changes
        const usdcDecrease = initialUsdcBalance.sub(finalUsdcBalance);
        const aUsdcIncrease = finalAUsdcBalance.sub(initialAUsdcBalance);
        
        console.log(`USDC decrease: ${ethers.utils.formatUnits(usdcDecrease, 6)}`);
        console.log(`aUSDC increase: ${ethers.utils.formatUnits(aUsdcIncrease, 6)}`);

        // Verify that USDC balance decreased by the supply amount
        expect(ethers.utils.formatUnits(usdcDecrease, 6)).to.equal(supplyAmount.toString());
        
        // Verify that aUSDC balance increased (may not be exactly the same amount due to exchange rate)
        expect(aUsdcIncrease.gt(0)).to.be.true;
    });
});

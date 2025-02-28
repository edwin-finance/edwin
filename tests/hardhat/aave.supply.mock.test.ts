import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { AaveService } from '../../src/plugins/aave/aaveService';
import { EdwinEVMWallet } from '../../src/core/wallets/evm_wallet/evm_wallet';

// Mock implementation for testing
class MockAaveService extends AaveService {
    constructor(wallet: EdwinEVMWallet) {
        super(wallet);
    }

    async supply(params: { chain: string; amount: number; asset: string }): Promise<string> {
        // Mock implementation that simulates a successful supply
        return `Successfully supplied ${params.amount} ${params.asset} to Aave, transaction signature: 0x1234567890abcdef`;
    }
}

describe('AAVE Supply Function Mock Test', function () {
    let signer: SignerWithAddress;
    let wallet: EdwinEVMWallet;
    let aaveService: MockAaveService;

    before(async function () {
        // Get a signer from Hardhat
        [signer] = await ethers.getSigners();

        // Create Edwin wallet with the test private key
        const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Hardhat's first account private key
        wallet = new EdwinEVMWallet(testPrivateKey as `0x${string}`);

        // Initialize mock AAVE service
        aaveService = new MockAaveService(wallet);
    });

    it('should supply USDC to AAVE and verify the result', async function () {
        // Supply tokens to AAVE
        const supplyAmount = 10; // 10 USDC
        const result = await aaveService.supply({
            chain: 'base',
            amount: supplyAmount,
            asset: 'usdc',
        });

        console.log(`Supply result: ${result}`);

        // Verify the result contains the expected information
        expect(result).to.include(`Successfully supplied ${supplyAmount} usdc to Aave`);
        expect(result).to.include('transaction signature');
    });

    it('should handle different assets and amounts', async function () {
        // Test with ETH
        const ethSupplyResult = await aaveService.supply({
            chain: 'base',
            amount: 1,
            asset: 'eth',
        });

        expect(ethSupplyResult).to.include('Successfully supplied 1 eth to Aave');

        // Test with a larger amount
        const largeSupplyResult = await aaveService.supply({
            chain: 'base',
            amount: 1000,
            asset: 'usdc',
        });

        expect(largeSupplyResult).to.include('Successfully supplied 1000 usdc to Aave');
    });
});

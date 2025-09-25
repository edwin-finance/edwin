import { EdwinService } from '../../core/classes/edwinToolProvider';
import { HederaWalletClient } from '../../core/wallets/hedera_wallet';
import { KeypairClient } from '../../core/wallets/hedera_wallet';
import edwinLogger from '../../utils/logger';
// Following official Bonzo pattern: full ethers.js approach with contract ABIs
import * as ethers from 'ethers';
import {
    BonzoSupplyParameters,
    BonzoWithdrawParameters,
    BonzoBorrowParameters,
    BonzoGetSuppliedBalanceParameters,
} from './parameters';

// Token decimals mapping based on official Bonzo code
const TOKEN_DECIMALS = {
    USDC: 6,
    HBARX: 8,
    SAUCE: 6,
    XSAUCE: 6,
    KARATE: 8,
    WHBAR: 8,
    GRELF: 8,
    KBL: 8,
    BONZO: 8,
    DOVU: 8,
    HST: 8,
    PACK: 6,
    STEAM: 2,
} as Record<string, number>;

// Complete contract ABIs from official Bonzo contracts.js
const CONTRACT_ABIS = {
    LendingPool: [
        'function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external payable',
        'function withdraw(address asset, uint256 amount, address to) external returns (uint256)',
        'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external',
        'function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf) external payable returns (uint256)',
    ],
    ERC20Wrapper: [
        'function balanceOf(address account) external view returns (uint256)',
        'function allowance(address owner, address spender) external view returns (uint256)',
        'function approve(address spender, uint256 amount) external returns (bool)',
        'function decimals() external view returns (uint8)',
    ],
    AToken: [
        'function balanceOf(address account) external view returns (uint256)',
        'function allowance(address owner, address spender) external view returns (uint256)',
        'function approve(address spender, uint256 amount) external returns (bool)',
    ],
    WHBARContract: [
        'function deposit() external payable',
        'function withdraw(uint256 amount) external',
        'function balanceOf(address account) external view returns (uint256)',
        'function approve(address spender, uint256 amount) external returns (bool)',
    ],
};

interface TokenConfig {
    tokenId: string; // Hedera token ID for balance checks
    decimals: number;
    // Real EVM addresses from bonzo_contracts.json
    tokenAddress: string;
    aTokenAddress: string;
    stableDebtAddress?: string;
    variableDebtAddress?: string;
}

export class BonzoService extends EdwinService {
    // Real addresses from official Bonzo bonzo_contracts.json - matching official structure
    private static readonly NETWORK_CONFIG = {
        mainnet: {
            lendingPoolAddress: '0x236897c518996163E7b313aD21D1C9fCC7BA1afc', // Real LendingPool from JSON
            whbarContractAddress: '0x0000000000000000000000000000000000163b59', // WHBAR contract
            tokens: {
                // Real addresses from bonzo_contracts.json mainnet
                WHBAR: {
                    tokenId: '0.0.1456986', // Hedera ID for balance checks
                    decimals: 8,
                    tokenAddress: '0x0000000000000000000000000000000000163b5a', // Real WHBAR token from JSON
                    aTokenAddress: '0x6e96a607F2F5657b39bf58293d1A006f9415aF32', // Real aWHBAR from JSON
                    stableDebtAddress: '0x1F267FBa2ca543EFb4b31bBb8d47abD9c436Aa01',
                    variableDebtAddress: '0xCD5A1FF3AD6EDd7e85ae6De3854f3915dD8c9103',
                },
                USDC: {
                    tokenId: '0.0.456858',
                    decimals: 6,
                    tokenAddress: '0x000000000000000000000000000000000006f89a', // Real USDC token from JSON
                    aTokenAddress: '0xB7687538c7f4CAD022d5e97CC778d0b46457c5DB', // Real aUSDC from JSON
                    stableDebtAddress: '0x9E83bE4C2a95b9CC10CF3Cf27BABe1a33867581D',
                    variableDebtAddress: '0x8a90C2f80Fc266e204cb37387c69EA2ed42A3cc1',
                },
                HBARX: {
                    tokenId: '0.0.834116',
                    decimals: 8,
                    tokenAddress: '0x00000000000000000000000000000000000cba44', // Real HBARX token from JSON
                    aTokenAddress: '0x40EBC87627Fe4689567C47c8C9C84EDC4Cf29132', // Real aHBARX from JSON
                    stableDebtAddress: '0x6cD2D4319419Fe01712727749bc90dB1ed814fB2',
                    variableDebtAddress: '0xF4167Af5C303ec2aD1B96316fE013CA96Eb141B5',
                },
                SAUCE: {
                    tokenId: '0.0.731861',
                    decimals: 6,
                    tokenAddress: '0x00000000000000000000000000000000000b2ad5', // Real SAUCE token from JSON
                    aTokenAddress: '0x2bcC0a304c0bc816D501c7C647D958b9A5bc716d', // Real aSAUCE from JSON
                    stableDebtAddress: '0xb67d416dE3b6c8Ff891C6f384852538987300C38',
                    variableDebtAddress: '0x736c5dbB8ADC643f04c1e13a9C25f28d3D4f0503',
                },
            } as Record<string, TokenConfig>,
        },
    };

    private static readonly GAS_LIMIT = 800000; // Following official Bonzo gas limits

    private ethersWallet: ethers.Wallet | null = null;
    private provider: ethers.providers.JsonRpcProvider | null = null;

    constructor(private wallet: HederaWalletClient) {
        super();
    }

    /**
     * Initialize ethers wallet and provider (following official Bonzo pattern)
     */
    private initializeEthersWallet(): void {
        if (this.ethersWallet && this.provider) {
            return; // Already initialized
        }

        // Create provider exactly like official Bonzo code
        const providerUrl = 'https://mainnet.hashio.io/api';
        this.provider = new ethers.providers.JsonRpcProvider(providerUrl);

        // Create ethers wallet from private key (exactly like official implementation)
        if ('getPrivateKey' in this.wallet) {
            const hederaPrivateKey = (this.wallet as KeypairClient).getPrivateKey();
            const privateKeyHex = hederaPrivateKey.toStringRaw();
            this.ethersWallet = new ethers.Wallet(privateKeyHex, this.provider);
        } else {
            throw new Error('Wallet does not support private key access - cannot create ethers wallet');
        }
    }

    /**
     * Setup contract instance (exactly like official setupContract function)
     */
    private async setupContract(artifactName: string, contractAddress: string): Promise<ethers.Contract> {
        this.initializeEthersWallet();

        const abi = (CONTRACT_ABIS as Record<string, string[]>)[artifactName];
        if (!abi) {
            throw new Error(`ABI not found for contract type: ${artifactName}`);
        }

        return new ethers.Contract(contractAddress, abi, this.ethersWallet!);
    }

    /**
     * Check balance exactly like official checkBalance function
     */
    private async checkBalance(contract: ethers.Contract, address: string, label: string): Promise<ethers.BigNumber> {
        const balance = await contract.balanceOf(address);
        edwinLogger.info(`💰 ${label}: ${balance.toString()}`);
        return balance;
    }

    /**
     * Approve token for spending (exactly like official approveToken function)
     */
    private async approveToken(
        tokenContract: ethers.Contract,
        spenderAddress: string,
        amount: ethers.BigNumber,
        label = ''
    ): Promise<void> {
        this.initializeEthersWallet();
        const ownerAddress = this.ethersWallet!.address;

        edwinLogger.info(`🔍 APPROVAL CHECK: ${label}`);
        const allowance = await tokenContract.allowance(ownerAddress, spenderAddress);
        edwinLogger.info(`📊 Current allowance: ${allowance.toString()}`);

        if (allowance.lt(amount)) {
            edwinLogger.info('✅ Approving...');
            const approveTx = await tokenContract.approve(spenderAddress, amount, { gasLimit: BonzoService.GAS_LIMIT });
            await approveTx.wait();
            const newAllowance = await tokenContract.allowance(ownerAddress, spenderAddress);
            edwinLogger.info(`✨ Approved: ${approveTx.hash} | New allowance: ${newAllowance.toString()}`);
        }
    }

    /**
     * Ensure WHBAR balance (exactly like official ensureWHBARBalance function)
     */
    private async ensureWHBARBalance(
        whbarContract: ethers.Contract,
        erc20Contract: ethers.Contract,
        requiredAmount: ethers.BigNumber
    ): Promise<void> {
        this.initializeEthersWallet();

        edwinLogger.info('🔍 WHBAR BALANCE CHECK');
        const whbarBalance = await erc20Contract.balanceOf(this.ethersWallet!.address);
        edwinLogger.info(`💰 Current: ${whbarBalance.toString()} | Required: ${requiredAmount.toString()}`);

        if (whbarBalance.lt(requiredAmount)) {
            const shortfall = requiredAmount.sub(whbarBalance);
            edwinLogger.info(
                `⚠️  Insufficient WHBAR balance! Converting ${shortfall.toString()} WHBAR units to native HBAR...`
            );

            const shortfallInWei = shortfall.mul(ethers.BigNumber.from('10000000000'));
            edwinLogger.info(`📊 Shortfall in wei: ${shortfallInWei.toString()}`);

            const depositTx = await whbarContract.deposit({
                value: shortfallInWei,
                gasLimit: 300000,
            });
            await depositTx.wait();
            const newBalance = await erc20Contract.balanceOf(this.ethersWallet!.address);
            edwinLogger.info(
                `✅ HBAR to WHBAR conversion completed: ${depositTx.hash} | New balance: ${newBalance.toString()}`
            );
        } else {
            edwinLogger.info('✅ Sufficient WHBAR balance available');
        }
    }

    /**
     * Supply tokens to Bonzo Finance lending pool
     * Exactly following the official performDeposit pattern
     */
    async supply(params: BonzoSupplyParameters): Promise<string> {
        edwinLogger.info(`Supplying ${params.amount} ${params.tokenSymbol} to Bonzo Finance on mainnet`);

        try {
            const config = BonzoService.NETWORK_CONFIG.mainnet;
            const tokenConfig = config.tokens[params.tokenSymbol];

            if (!tokenConfig) {
                throw new Error(`Token ${params.tokenSymbol} not supported by Bonzo Finance`);
            }

            this.initializeEthersWallet();

            // Get decimals and normalize amount exactly like official code
            const decimals = TOKEN_DECIMALS[params.tokenSymbol] || 8;
            const normalizedAmount = ethers.utils.parseUnits(params.amount.toString(), decimals);
            const isWHBAR = params.tokenSymbol === 'WHBAR';

            edwinLogger.info(
                `📊 Normalized amount: ${normalizedAmount.toString()} | 🔑 Token address: ${tokenConfig.tokenAddress}`
            );

            // Setup contracts exactly like official code
            const lendingPoolContract = await this.setupContract('LendingPool', config.lendingPoolAddress);
            const erc20Contract = await this.setupContract('ERC20Wrapper', tokenConfig.tokenAddress);

            // Setup WHBAR contract if needed
            let whbarContract = null;
            if (isWHBAR) {
                whbarContract = await this.setupContract('WHBARContract', config.whbarContractAddress);
                edwinLogger.info(`🌊 WHBAR Contract: ${whbarContract.address}`);
            }

            edwinLogger.info(`🏦 Lending Pool: ${lendingPoolContract.address}`);

            // Perform deposit exactly like official performDeposit function
            return await this.performDeposit(
                erc20Contract,
                lendingPoolContract,
                tokenConfig.tokenAddress,
                normalizedAmount,
                isWHBAR,
                whbarContract
            );
        } catch (error) {
            edwinLogger.error('Failed to supply tokens:', error);
            throw error;
        }
    }

    /**
     * Perform deposit operation exactly like official performDeposit function
     */
    private async performDeposit(
        erc20Contract: ethers.Contract,
        lendingPoolContract: ethers.Contract,
        tokenAddress: string,
        amount: ethers.BigNumber,
        isWHBAR: boolean,
        whbarContract: ethers.Contract | null = null
    ): Promise<string> {
        this.initializeEthersWallet();
        const onBehalfOf = this.ethersWallet!.address;

        edwinLogger.info('🏦 DEPOSIT OPERATION');

        // Handle WHBAR conversion and approvals exactly like official code - BEFORE balance check
        if (isWHBAR && whbarContract) {
            await this.ensureWHBARBalance(whbarContract, erc20Contract, amount);
            await this.approveToken(erc20Contract, lendingPoolContract.address, amount, 'WHBAR to Lending Pool');
            await this.approveToken(erc20Contract, whbarContract.address, amount, 'WHBAR to WHBAR Contract');
        } else if (!isWHBAR) {
            // Check initial balance for non-WHBAR tokens
            const userBalance = await this.checkBalance(erc20Contract, onBehalfOf, 'Current token balance');
            if (userBalance.lt(amount)) {
                const shortfall = amount.sub(userBalance);
                edwinLogger.error(
                    `❌ INSUFFICIENT BALANCE | Required: ${amount.toString()} | Available: ${userBalance.toString()} | Shortfall: ${shortfall.toString()}`
                );
                throw new Error('Cannot proceed with deposit - insufficient token balance');
            }
            await this.approveToken(erc20Contract, lendingPoolContract.address, amount, 'ERC20 for deposit');
        }

        edwinLogger.info('💸 Depositing...');
        let depositTx;
        if (isWHBAR) {
            const hbarValue = amount.mul(ethers.BigNumber.from('10000000000'));
            edwinLogger.info(`💰 HBAR value being sent: ${hbarValue.toString()}`);
            depositTx = await lendingPoolContract.deposit(tokenAddress, amount, onBehalfOf, 0, { value: hbarValue });
        } else {
            depositTx = await lendingPoolContract.deposit(tokenAddress, amount, onBehalfOf, 0);
        }

        await depositTx.wait();
        edwinLogger.info(`✅ Deposited: ${depositTx.hash}`);
        return depositTx.hash;
    }

    /**
     * Withdraw tokens from Bonzo Finance lending pool
     * Exactly following the official performWithdraw pattern
     */
    async withdraw(params: BonzoWithdrawParameters): Promise<string> {
        edwinLogger.info(`Withdrawing ${params.amount} ${params.tokenSymbol} from Bonzo Finance on mainnet`);

        try {
            const config = BonzoService.NETWORK_CONFIG.mainnet;
            const tokenConfig = config.tokens[params.tokenSymbol];

            if (!tokenConfig) {
                throw new Error(`Token ${params.tokenSymbol} not supported by Bonzo Finance`);
            }

            this.initializeEthersWallet();

            // Get decimals and normalize amount exactly like official code
            const decimals = TOKEN_DECIMALS[params.tokenSymbol] || 8;
            const normalizedAmount = ethers.utils.parseUnits(params.amount.toString(), decimals);
            const isWHBAR = params.tokenSymbol === 'WHBAR';

            // Setup contracts exactly like official code
            const lendingPoolContract = await this.setupContract('LendingPool', config.lendingPoolAddress);
            const aTokenContract = await this.setupContract('AToken', tokenConfig.aTokenAddress);

            // Check aToken balance first exactly like official code
            const aTokenBalance = await this.checkBalance(
                aTokenContract,
                this.ethersWallet!.address,
                'aToken before withdrawal'
            );
            if (aTokenBalance.lt(normalizedAmount)) {
                throw new Error(
                    `❌ Insufficient aToken balance. Have: ${aTokenBalance.toString()}, need: ${normalizedAmount.toString()}`
                );
            }

            // For exact withdrawals (like MAX), use the actual aToken balance instead of normalized amount
            let withdrawAmount = normalizedAmount;
            if (aTokenBalance.eq(normalizedAmount) || normalizedAmount.gte(aTokenBalance)) {
                // If trying to withdraw full balance, use exact aToken balance to avoid precision issues
                withdrawAmount = aTokenBalance;
                edwinLogger.info(`Using exact aToken balance for withdrawal: ${withdrawAmount.toString()}`);
            }

            // Perform withdraw exactly like official performWithdraw function
            return await this.performWithdraw(
                aTokenContract,
                lendingPoolContract,
                tokenConfig.tokenAddress,
                withdrawAmount,
                isWHBAR
            );
        } catch (error) {
            edwinLogger.error('Failed to withdraw tokens:', error);
            throw error;
        }
    }

    /**
     * Perform withdraw operation exactly like official performWithdraw function
     */
    private async performWithdraw(
        aTokenContract: ethers.Contract,
        lendingPoolContract: ethers.Contract,
        tokenAddress: string,
        amount: ethers.BigNumber,
        isWHBAR: boolean
    ): Promise<string> {
        this.initializeEthersWallet();
        const to = this.ethersWallet!.address;

        edwinLogger.info('💵 WITHDRAW OPERATION');

        // Handle WHBAR approvals if needed
        if (isWHBAR) {
            const config = BonzoService.NETWORK_CONFIG.mainnet;
            const whbarContract = await this.setupContract('WHBARContract', config.whbarContractAddress);
            const whbarTokenContract = await this.setupContract('ERC20Wrapper', tokenAddress);
            await this.approveToken(whbarTokenContract, lendingPoolContract.address, amount, 'WHBAR to Lending Pool');
            await this.approveToken(whbarTokenContract, whbarContract.address, amount, 'WHBAR to WHBAR Contract');
        }

        edwinLogger.info('🔄 Withdrawing...');
        // For WHBAR, try withdrawing to user address first (not WHBAR contract)
        const withdrawTx = await lendingPoolContract.withdraw(
            tokenAddress,
            amount,
            to, // Always withdraw to user address
            { gasLimit: BonzoService.GAS_LIMIT }
        );
        await withdrawTx.wait();
        edwinLogger.info(`✅ Withdrawn: ${withdrawTx.hash}`);
        return withdrawTx.hash;
    }

    /**
     * Borrow tokens from Bonzo Finance lending pool
     * Following the official performBorrow pattern
     */
    async borrow(params: BonzoBorrowParameters): Promise<string> {
        edwinLogger.info(`Borrowing ${params.amount} ${params.tokenSymbol} from Bonzo Finance on mainnet`);

        try {
            const config = BonzoService.NETWORK_CONFIG.mainnet;
            const tokenConfig = config.tokens[params.tokenSymbol];

            if (!tokenConfig) {
                throw new Error(`Token ${params.tokenSymbol} not supported by Bonzo Finance`);
            }

            this.initializeEthersWallet();

            // Check collateral first (like official code)
            const collateralBalance = await this.getSuppliedBalance({
                tokenSymbol: params.tokenSymbol,
                network: 'mainnet',
            });

            if (collateralBalance === 0) {
                throw new Error('No collateral available - deposit some assets first to use as collateral');
            }

            // Get decimals and normalize amount exactly like official code
            const decimals = TOKEN_DECIMALS[params.tokenSymbol] || 8;
            const normalizedAmount = ethers.utils.parseUnits(params.amount.toString(), decimals);
            const isWHBAR = params.tokenSymbol === 'WHBAR';

            // Setup contracts exactly like official code
            const lendingPoolContract = await this.setupContract('LendingPool', config.lendingPoolAddress);

            // Perform borrow exactly like official performBorrow function
            return await this.performBorrow(lendingPoolContract, tokenConfig.tokenAddress, normalizedAmount, isWHBAR);
        } catch (error) {
            edwinLogger.error('Failed to borrow tokens:', error);
            throw error;
        }
    }

    /**
     * Perform borrow operation exactly like official performBorrow function
     */
    private async performBorrow(
        lendingPoolContract: ethers.Contract,
        tokenAddress: string,
        amount: ethers.BigNumber,
        isWHBAR: boolean
    ): Promise<string> {
        this.initializeEthersWallet();
        const onBehalfOf = this.ethersWallet!.address;

        edwinLogger.info('💳 BORROW OPERATION');

        // Handle WHBAR approvals if needed
        if (isWHBAR) {
            const config = BonzoService.NETWORK_CONFIG.mainnet;
            const whbarContract = await this.setupContract('WHBARContract', config.whbarContractAddress);
            const whbarTokenContract = await this.setupContract('ERC20Wrapper', tokenAddress);
            await this.approveToken(whbarTokenContract, lendingPoolContract.address, amount, 'WHBAR to Lending Pool');
            await this.approveToken(whbarTokenContract, whbarContract.address, amount, 'WHBAR to WHBAR Contract');
        }

        edwinLogger.info('🔄 Borrowing...');
        const borrowTx = await lendingPoolContract.borrow(tokenAddress, amount, 2, 0, onBehalfOf);
        await borrowTx.wait();
        edwinLogger.info(`✅ Borrowed: ${borrowTx.hash}`);
        return borrowTx.hash;
    }

    /**
     * Get supplied balance (aToken balance) for a specific token
     * Exactly following the official checkBalance pattern
     */
    async getSuppliedBalance(params: BonzoGetSuppliedBalanceParameters): Promise<number> {
        edwinLogger.info(`Getting supplied balance for ${params.tokenSymbol} on mainnet`);

        try {
            const config = BonzoService.NETWORK_CONFIG.mainnet;
            const tokenConfig = config.tokens[params.tokenSymbol];

            if (!tokenConfig || !tokenConfig.aTokenAddress) {
                throw new Error(`Token ${params.tokenSymbol} not supported or aToken not configured`);
            }

            this.initializeEthersWallet();

            // Setup aToken contract exactly like official code
            const aTokenContract = await this.setupContract('AToken', tokenConfig.aTokenAddress);

            // Check balance exactly like official checkBalance function
            const rawBalance = await this.checkBalance(
                aTokenContract,
                this.ethersWallet!.address,
                `aToken balance for ${params.tokenSymbol}`
            );

            // Convert to human readable amount using token decimals
            const decimals = TOKEN_DECIMALS[params.tokenSymbol] || 8;
            const balance = parseFloat(ethers.utils.formatUnits(rawBalance, decimals));

            edwinLogger.info(`📊 Final aToken balance: ${balance} ${params.tokenSymbol}`);
            return balance;
        } catch (error) {
            edwinLogger.error('Failed to get supplied balance:', error);
            // If there's an error (like account not found), return 0 instead of throwing
            edwinLogger.warn('Returning 0 balance due to error - might not be associated with aToken yet');
            return 0;
        }
    }

    /**
     * Get current supplied balance for the connected wallet
     */
    async getCurrentSuppliedBalance(tokenSymbol: string): Promise<number> {
        return this.getSuppliedBalance({
            tokenSymbol,
            network: 'mainnet',
        });
    }
}

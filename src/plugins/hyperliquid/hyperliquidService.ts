import * as ccxt from 'ccxt';
import { Hyperliquid, OrderType as HyperliquidOrderType } from 'hyperliquid';
import { TransactionRequest } from 'viem';
import { EdwinEVMWallet } from '../../core/wallets/evm_wallet/evm_wallet';
import { EdwinService } from '../../core/classes/edwinToolProvider';
import edwinLogger from '../../utils/logger';
import {
    DepositParametersType,
    WithdrawParametersType,
    OpenPositionParametersType,
    ClosePositionParametersType,
    OrderType,
    PositionType,
} from './parameters';

/**
 * Service for interacting with the HyperLiquid protocol
 */
export class HyperLiquidService extends EdwinService {
    private wallet: EdwinEVMWallet;
    private exchange: ccxt.Exchange; // Using ccxt.Exchange type instead of any
    private hyperliquid: Hyperliquid;

    /**
     * Creates a new HyperLiquidService
     * @param wallet - The EVM wallet to use for transactions
     */
    constructor(wallet: EdwinEVMWallet) {
        super();
        this.wallet = wallet;

        // Initialize the CCXT HyperLiquid exchange
        this.exchange = new ccxt.hyperliquid({
            apiKey: '', // Will be set when needed
            secret: '', // Will be set when needed
            enableRateLimit: true,
        });

        // Initialize the HyperLiquid SDK with a private key
        // Note: In a real implementation, we would need to securely access the private key
        // For now, we'll use a placeholder approach
        this.hyperliquid = new Hyperliquid({
            privateKey: '0x' + '1'.repeat(64), // Placeholder private key
            enableWs: false, // Disable WebSocket for now
            testnet: false, // Use mainnet by default
        });
    }

    /**
     * Deposits funds to HyperLiquid
     * @param params - Deposit parameters
     * @returns Transaction result
     */
    async deposit(params: DepositParametersType): Promise<Record<string, unknown>> {
        try {
            edwinLogger.info(`Depositing ${params.amount} ${params.asset} to HyperLiquid`);

            // Get deposit address from HyperLiquid
            const depositAddress = await this.exchange.fetchDepositAddress(params.asset);

            if (!depositAddress || !depositAddress.address) {
                throw new Error(`Failed to get deposit address for ${params.asset}`);
            }

            // Get wallet client for the transaction
            const walletClient = this.wallet.getWalletClient('arbitrum');

            // Create transaction parameters
            const txParams: TransactionRequest = {
                to: depositAddress.address as `0x${string}`,
                value: BigInt(params.amount * 10 ** 18), // Convert to wei
            };

            // Send the transaction
            const txHash = await walletClient.sendTransaction(txParams);

            const result = {
                success: true,
                amount: params.amount,
                asset: params.asset,
                address: depositAddress.address,
                txHash: txHash,
            };

            edwinLogger.info(`Deposit successful: ${JSON.stringify(result)}`);
            return result;
        } catch (error) {
            edwinLogger.error(`Error depositing to HyperLiquid: ${error}`);
            throw error;
        }
    }

    /**
     * Withdraws funds from HyperLiquid
     * @param params - Withdrawal parameters
     * @returns Transaction result
     */
    async withdraw(params: WithdrawParametersType): Promise<Record<string, unknown>> {
        try {
            edwinLogger.info(`Withdrawing ${params.amount} ${params.asset} from HyperLiquid`);

            // Get the wallet address
            const address = this.wallet.getAddress();

            // Use the HyperLiquid SDK to initiate the withdrawal
            const withdrawResult = await this.hyperliquid.exchange.initiateWithdrawal(address, params.amount);

            // Convert to Record<string, unknown>
            const result: Record<string, unknown> = {
                ...withdrawResult,
                success: true,
            };

            edwinLogger.info(`Withdrawal successful: ${JSON.stringify(result)}`);
            return result;
        } catch (error) {
            edwinLogger.error(`Error withdrawing from HyperLiquid: ${error}`);
            throw error;
        }
    }

    /**
     * Opens a position on HyperLiquid
     * @param params - Open position parameters
     * @returns Order result
     */
    async openPosition(params: OpenPositionParametersType): Promise<Record<string, unknown>> {
        try {
            const { asset, positionType, orderType, size, leverage, price, reduceOnly } = params;

            edwinLogger.info(`Opening ${positionType} position for ${asset} with size ${size} USD`);

            // Set leverage if specified
            if (leverage > 1) {
                await this.hyperliquid.exchange.updateLeverage(
                    asset,
                    'cross', // Use cross margin by default
                    leverage
                );
                edwinLogger.info(`Set leverage to ${leverage}x for ${asset}`);
            }

            // Determine order type and side
            const is_buy = positionType === PositionType.LONG;
            const sdk_order_type = orderType === OrderType.LIMIT ? 'limit' : 'market';

            // Create the order using the HyperLiquid SDK
            const orderResult = await this.hyperliquid.exchange.placeOrder({
                coin: asset,
                is_buy: is_buy,
                sz: size,
                limit_px: price || 0, // Use 0 for market orders
                order_type: sdk_order_type as HyperliquidOrderType,
                reduce_only: reduceOnly,
            });

            // Convert to Record<string, unknown>
            const result: Record<string, unknown> = {
                ...orderResult,
                success: true,
            };

            edwinLogger.info(`Position opened successfully: ${JSON.stringify(result)}`);
            return result;
        } catch (error) {
            edwinLogger.error(`Error opening position on HyperLiquid: ${error}`);
            throw error;
        }
    }

    /**
     * Closes a position on HyperLiquid
     * @param params - Close position parameters
     * @returns Order result
     */
    async closePosition(params: ClosePositionParametersType): Promise<Record<string, unknown>> {
        try {
            const { asset, orderType, percentage, price } = params;

            edwinLogger.info(`Closing position for ${asset} (${percentage}%)`);

            // Get current position using CCXT as a fallback
            // In a real implementation, we would use the HyperLiquid SDK's appropriate method
            const positions = await this.exchange.fetchPositions([asset]);
            // Use type assertion to handle the positions array
            const position = (positions as ccxt.Position[]).find(pos => pos.symbol === asset);

            if (!position) {
                throw new Error(`No open position found for ${asset}`);
            }

            // Calculate amount to close based on percentage
            // Use 'contracts' property for CCXT positions
            const positionSize = (position['contracts'] as number) || 0;
            const closeSize = positionSize * (percentage / 100);

            // Determine side (opposite of current position)
            const is_buy = (position['side'] as string) === 'short';
            const sdk_order_type = orderType === OrderType.LIMIT ? 'limit' : 'market';

            // Create the order using the HyperLiquid SDK
            const orderResult = await this.hyperliquid.exchange.placeOrder({
                coin: asset,
                is_buy: is_buy,
                sz: closeSize,
                limit_px: price || 0, // Use 0 for market orders
                order_type: sdk_order_type as HyperliquidOrderType,
                reduce_only: true,
            });

            // Convert to Record<string, unknown>
            const result: Record<string, unknown> = {
                ...orderResult,
                success: true,
            };

            edwinLogger.info(`Position closed successfully: ${JSON.stringify(result)}`);
            return result;
        } catch (error) {
            edwinLogger.error(`Error closing position on HyperLiquid: ${error}`);
            throw error;
        }
    }

    /**
     * Gets the current balance on HyperLiquid
     * @returns Balance information
     */
    async getBalance(): Promise<Record<string, unknown>> {
        try {
            // Use the CCXT exchange to fetch balance as a fallback
            // In a real implementation, we would use the HyperLiquid SDK's appropriate method
            const balance = await this.exchange.fetchBalance();
            return balance as Record<string, unknown>;
        } catch (error) {
            edwinLogger.error(`Error fetching balance from HyperLiquid: ${error}`);
            throw error;
        }
    }

    /**
     * Gets open positions on HyperLiquid
     * @returns List of open positions
     */
    async getPositions(): Promise<Record<string, unknown>[]> {
        try {
            // Use the CCXT exchange to fetch positions as a fallback
            // In a real implementation, we would use the HyperLiquid SDK's appropriate method
            const positions = await this.exchange.fetchPositions();
            // Convert to Record<string, unknown>[] using a more explicit approach
            return (positions as ccxt.Position[]).map(pos => ({ ...pos }) as Record<string, unknown>);
        } catch (error) {
            edwinLogger.error(`Error fetching positions from HyperLiquid: ${error}`);
            throw error;
        }
    }

    /**
     * Sets up authentication for the exchange
     * @param privateKey - The private key to use for authentication
     */
    private setupAuthentication(privateKey: string): void {
        if (!privateKey) {
            throw new Error('Private key is required for HyperLiquid authentication');
        }

        // In a real implementation, we would set up the authentication here
        // For CCXT, this typically involves setting the apiKey and secret
        this.exchange.apiKey = 'derived-from-private-key';
        this.exchange.secret = 'derived-from-private-key';
    }
}

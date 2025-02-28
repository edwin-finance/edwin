import * as ccxt from 'ccxt';
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
    private exchange: ccxt.hyperliquid;

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
    }

    /**
     * Deposits funds to HyperLiquid
     * @param params - Deposit parameters
     * @returns Transaction result
     */
    async deposit(params: DepositParametersType): Promise<Record<string, unknown>> {
        try {
            edwinLogger.info(`Depositing ${params.amount} ${params.asset} to HyperLiquid`);

            // Get deposit address
            const depositAddress = await this.exchange.fetchDepositAddress(params.asset);

            // In a real implementation, we would use the wallet to send funds to this address
            // For now, we'll just log the address and return a mock result
            edwinLogger.info(`Deposit address for ${params.asset}: ${JSON.stringify(depositAddress)}`);

            const result = {
                success: true,
                amount: params.amount,
                asset: params.asset,
                address: depositAddress.address,
                txId: 'mock-tx-id', // In a real implementation, this would be the transaction hash
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

            // In a real implementation, we would need to provide a destination address
            // For now, we'll use a mock address
            const address = '0x1234567890abcdef1234567890abcdef12345678';

            const result = await this.exchange.withdraw(params.asset, params.amount, address, {
                network: 'EVM', // Specify the network if needed
            });

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
                await this.exchange.setLeverage(leverage, asset);
                edwinLogger.info(`Set leverage to ${leverage}x for ${asset}`);
            }

            // Determine order type and side
            const side = positionType === PositionType.LONG ? 'buy' : 'sell';
            const type = orderType === OrderType.LIMIT ? 'limit' : 'market';

            // Create the order
            const result = await this.exchange.createOrder(asset, type, side, size, price || undefined, {
                reduceOnly: reduceOnly,
            });

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

            // Get current position
            const positions = await this.exchange.fetchPositions([asset]);
            const position = positions.find(pos => pos.symbol === asset);

            if (!position) {
                throw new Error(`No open position found for ${asset}`);
            }

            // Calculate amount to close based on percentage
            const closeAmount = position.contracts * (percentage / 100);

            // Determine side (opposite of current position)
            const side = position.side === 'long' ? 'sell' : 'buy';
            const type = orderType === OrderType.LIMIT ? 'limit' : 'market';

            // Create the order
            const result = await this.exchange.createOrder(asset, type, side, closeAmount, price || undefined, {
                reduceOnly: true,
            });

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
            const balance = await this.exchange.fetchBalance();
            return balance;
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
            const positions = await this.exchange.fetchPositions();
            return positions;
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

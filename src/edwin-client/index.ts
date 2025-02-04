import type { DeFiProtocol, EdwinConfig } from '../types';
import { EdwinEVMWallet, EdwinSolanaWallet, EdwinWallet } from '../edwin-core/wallets';
import { initializeProtocols } from './protocols_client';
import { initializeActions, ActionMap } from './actions_client';

export { getEdwinTools } from './langchain';

export class Edwin {
    private wallets: Record<string, EdwinWallet> = {};
    public protocols: Record<string, DeFiProtocol>;
    public actions: ActionMap;

    constructor(config: EdwinConfig) {
        // Initialize wallets
        if (config.evmPrivateKey) {
            this.wallets['evm'] = new EdwinEVMWallet(config.evmPrivateKey);
        }
        if (config.solanaPrivateKey) {
            this.wallets['solana'] = new EdwinSolanaWallet(config.solanaPrivateKey);
        }

        // Initialize protocols
        this.protocols = initializeProtocols(
            this.wallets['evm'] as EdwinEVMWallet,
            this.wallets['solana'] as EdwinSolanaWallet
        );

        // Initialize actions
        this.actions = initializeActions(this, config.actions);
    }

    public async getActions() {
        return Object.values(this.actions);
    }

    public async getPortfolio() {
        // Build wallet address section
        const walletAddresses = Object.entries(this.wallets)
            .map(([type, wallet]) => {
                const address = wallet.getAddress();
                const formattedType = type.toUpperCase();
                return `${formattedType} wallet address: ${address}`;
            })
            .join('\n');

        // Get portfolio positions per each protocol
        const portfolioPromises = Object.entries(this.protocols).map(async ([name, protocol]) => {
            try {
                const portfolio = await protocol.getPortfolio();
                if (!portfolio || portfolio.length === 0) {
                    return null;
                }
                return `${name.toUpperCase()} Portfolio:\n${portfolio}`;
            } catch (error) {
                console.error(`Error getting portfolio for ${name}:`, error);
                return null;
            }
        });

        const portfolioResults = (await Promise.all(portfolioPromises)).filter(result => result !== null);

        return [walletAddresses, ...portfolioResults].join('\n\n');
    }
}

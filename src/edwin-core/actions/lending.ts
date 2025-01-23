import type { EdwinProvider, Transaction } from "../../types";
import { SupplyParams, WithdrawParams } from "../../types";
import { getLendingProtocol } from "../../protocols";
import { EdwinAction } from "../../types";
import { supplyTemplate, withdrawTemplate } from "../templates";
import { EdwinWallet } from "../providers";

export class SupplyAction implements EdwinAction {
    public name = 'supply';
    public description = 'Supply assets to a lending protocol';
    public template = supplyTemplate;
    public provider: EdwinProvider;

    constructor(provider: EdwinProvider) {
        this.provider = provider;
    }

    async execute(params: SupplyParams): Promise<Transaction> {
        console.log(
            `Supplying: ${params.amount} ${params.asset} to ${params.protocol} on ${params.chain})`
        );
        try {
            // Get the appropriate protocol service based on the protocol name
            const lendingProtocol = getLendingProtocol(params.protocol);
            if (!lendingProtocol) {
                throw new Error(`Unsupported protocol: ${params.protocol}`);
            }
            // Check which wallet is required by the protocol and if it is supported by the provider
            const walletProvider = this.provider.getWallet(params.chain);
            if (!walletProvider || !(walletProvider instanceof EdwinWallet)) {
                throw new Error(`Unsupported wallet provider: ${params.protocol}`);
            }
            // Check if the chain is supported by the protocol
            if (!lendingProtocol.supportedChains.includes(params.chain)) {
                throw new Error(`Unsupported chain: ${params.chain}`);
            }
            // Use the protocol-specific supply implementation
            return await lendingProtocol.supply(params, walletProvider);
        } catch (error: any) {
            // If error has a message, use it
            if (error.message) {
                throw new Error(`Supply failed: ${error.message}`);
            }
            // Otherwise, use the error itself
            throw new Error(`Supply failed: ${error}`);
        }
    }
}
export class WithdrawAction implements EdwinAction {
    public name = 'withdraw';
    public description = 'Withdraw assets from a lending protocol';
    public template = withdrawTemplate;
    public provider: EdwinProvider;

    constructor(provider: EdwinProvider) {
        this.provider = provider;
    }

    async execute(params: WithdrawParams): Promise<Transaction> {
        console.log(
            `Withdrawing: ${params.amount} ${params.asset} from ${params.protocol} on ${params.chain})`
        );

        try {
            // Get the appropriate protocol service based on the protocol name
            const lendingProtocol = getLendingProtocol(params.protocol);
            if (!lendingProtocol) {
                throw new Error(`Unsupported protocol: ${params.protocol}`);
            }

            // Check which wallet is required by the protocol and if it is supported by the provider
            const walletProvider = this.provider.getWallet(params.chain);
            if (!walletProvider) {
                throw new Error(`Unsupported wallet provider: ${params.protocol}`);
            }

            // Use the protocol-specific withdraw implementation
            return await lendingProtocol.withdraw(params, walletProvider);
        } catch (error: any) {
            // If error has a message, use it
            if (error.message) {
                throw new Error(`Withdraw failed: ${error.message}`);
            }
            // Otherwise, use the error itself
            throw new Error(`Withdraw failed: ${error}`);
        }
    }
}

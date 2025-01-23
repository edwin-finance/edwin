import {
    type ILendingProtocol,
    type SupplyParams,
    type WithdrawParams,
    type Transaction,
    type SupportedChain,
} from "../../types";
import { SolanaWallet } from "../../edwin-core/providers/solana_wallet";
import { KaminoMarket, KaminoAction } from "@kamino-finance/klend-sdk";


export class KaminoProtocol implements ILendingProtocol {
    public supportedChains: SupportedChain[] = ["solana"];

    async supply(params: SupplyParams, walletProvider: SolanaWallet): Promise<Transaction> {
        const { chain, amount, asset, data } = params;
        console.log(`Calling the inner Kamino logic to supply ${amount} ${asset}`);

        try {

            throw new Error("No transaction generated from Kamino Pool");
        } catch (error: unknown) {
            console.error("Kamino supply error:", error);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Kamino supply failed: ${message}`);
        }
    }

    async withdraw(params: WithdrawParams, walletProvider: SolanaWallet): Promise<Transaction> {
        const { amount, asset } = params;
        console.log(
            `Calling the inner Kamino logic to withdraw ${amount} ${asset}`
        );
        try {
            throw new Error("Kamino withdraw not implemented");
        } catch (error: unknown) {
            console.error("Kamino withdraw error:", error);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Kamino withdraw failed: ${message}`);
        }
    }
}
import {
    type ILendingProtocol,
    type SupplyParams,
    type WithdrawParams,
    type Transaction,
    type SupportedChain,
} from "../../types";
import { SolanaWallet } from "../../edwin-core/providers/solana_wallet";
import { KaminoMarket, KaminoAction, KaminoReserve, PROGRAM_ID, VanillaObligation, initEnv } from "@kamino-finance/klend-sdk";
import { PublicKey } from "@solana/web3.js";


export class KaminoProtocol implements ILendingProtocol {
    public supportedChains: SupportedChain[] = ["solana"];

    async supply(params: SupplyParams, walletProvider: SolanaWallet): Promise<Transaction> {
        const { chain, amount, asset, data } = params;
        console.log(`Calling the inner Kamino logic to supply ${amount} ${asset}`);

        try {
            // Verify chain is solana
            if (chain !== "solana") {
                throw new Error("Kamino protocol only supports Solana");
            }
            const connection = await walletProvider.getConnection();
            const market = await KaminoMarket.load(
                connection,
                new PublicKey("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF"), // main market address. Defaults to 'Main' market
                1000,
            );
            if (!market) {
                throw new Error("Kamino market not found");
            }
            // Refresh reserves
            await market.loadReserves();
            
            const kaminoAction = await KaminoAction.buildDepositTxns(
                market,
                amount,
                new PublicKey("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF"), // todo make asset,
                walletProvider.getPublicKey(),
                new VanillaObligation(PROGRAM_ID),
            );

            const env = await initEnv('mainnet-beta');

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
import {
    type ILendingProtocol,
    type SupplyParams,
    type WithdrawParams,
    type Transaction,
    type SupportedChain,
} from "../../types";
import { SolanaWallet } from "../../edwin-core/providers/solana_wallet";
import { PublicKey } from "@solana/web3.js";
import { SolendMarket } from "@solendprotocol/solend-sdk/dist/state";
import { SolendActionCore } from "@solendprotocol/solend-sdk";

export class SolendProtocol implements ILendingProtocol {
    public supportedChains: SupportedChain[] = ["solana"];

    async supply(params: SupplyParams, walletProvider: SolanaWallet): Promise<Transaction> {
        const { chain, amount, asset } = params;
        console.log(`Calling Solend protocol to supply ${amount} ${asset}`);

        try {
            if (chain !== "solana") {
                throw new Error("Solend protocol only supports Solana");
            }

            const connection = walletProvider.getConnection();
            const publicKey = walletProvider.getPublicKey();

            // Initialize market with mainnet configuration
            const market = await SolendMarket.initialize(
                connection,
                "production",  // environment
                new PublicKey("7RCz8wb6WXxUhAigok9ttgrVgDFFFbibcirECzWSBauM") // TURBO SOL market
            );

            // Load latest reserve data
            await market.loadReserves();

            const pool: PoolType = market.pools[0];
            const selectedReserve: SelectedReserveType = pool.reserves[0];
            // Build deposit transaction
            const solendAction = await SolendActionCore.buildDepositTxns(
                market,
                selectedReserve,
                connection,
                amount,
                publicKey,
                "production",
            );

            // Send transaction
            const txHash = await solendAction.sendTransactions(
                async (txn) => await walletProvider.signAndSendTransaction(txn)
            );

            return {
                hash: txHash as `0x${string}`,
                from: publicKey.toBase58() as `0x${string}`,
                to: market.address.toBase58() as `0x${string}`,
                value: Number(amount)
            };

        } catch (error: unknown) {
            console.error("Solend supply error:", error);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Solend supply failed: ${message}`);
        }
    }

    async withdraw(params: WithdrawParams, walletProvider: SolanaWallet): Promise<Transaction> {
        throw new Error("Solend withdraw not implemented");
    }
}

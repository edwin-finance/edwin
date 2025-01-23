import bs58 from "bs58";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { EdwinWallet } from "./wallet";

export class SolanaWallet extends EdwinWallet {
    private wallet: Keypair;
    private wallet_address: PublicKey;

    constructor(protected privateKey: `0x${string}`) {
        super(privateKey);
        this.wallet = Keypair.fromSecretKey(bs58.decode(privateKey));
        this.wallet_address = this.wallet.publicKey;
    }

    getConnection(customRpcUrl?: string): Connection {
        return new Connection(customRpcUrl || 'https://api.mainnet-beta.solana.com', 'confirmed');
    }

    getPublicKey(): PublicKey {
        return this.wallet_address;
    }
}

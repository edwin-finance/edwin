import { createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { WalletClient, PrivateKeyAccount } from 'viem';
import type { SupportedEVMChain } from '../../types';
import { EdwinEVMPublicKeyWallet } from './evm_public_key_wallet';
import { ethers, providers } from 'ethers';

/**
 * EVM wallet that has full capabilities including transaction signing
 */
export class EdwinEVMWallet extends EdwinEVMPublicKeyWallet {
    private account: PrivateKeyAccount;
    private evmPrivateKey: `0x${string}`;

    constructor(privateKey: `0x${string}`) {
        const account = privateKeyToAccount(privateKey);
        super(account.address);
        this.account = account;
        this.evmPrivateKey = privateKey;
    }

    /**
     * Get the wallet client for a specific chain
     */
    getWalletClient(chainName: SupportedEVMChain): WalletClient {
        const transport = this.createHttpTransport(chainName);

        const walletClient = createWalletClient({
            chain: this.chains[chainName],
            transport,
            account: this.account,
        });

        return walletClient;
    }

    /**
     * Get an ethers.js wallet instance
     */
    getEthersWallet(walletClient: WalletClient, provider: providers.JsonRpcProvider): ethers.Wallet {
        const ethers_wallet = new ethers.Wallet(this.evmPrivateKey, provider);
        return ethers_wallet;
    }

    /**
     * Get the account (private key)
     */
    getSigner(): PrivateKeyAccount {
        return this.account;
    }
}

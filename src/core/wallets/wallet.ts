export abstract class EdwinWallet {
    abstract getAddress(): string;

    /**
     * Get balance of current wallet
     */
    abstract getBalance(): Promise<number>;

    /**
     * Get balance of any wallet address
     * @param walletAddress Address of the wallet to check
     */
    abstract getBalanceOfWallet(walletAddress: string, ...args: unknown[]): Promise<number>;
}

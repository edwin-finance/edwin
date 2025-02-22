export abstract class EdwinWallet {
    abstract getAddress(): string;

    abstract getBalance(): Promise<number>;
}

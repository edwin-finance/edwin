import type { SupportedChain } from '../../core/types';
import { EdwinEVMWallet } from '../../core/wallets/evm_wallet/evm_wallet';
import { LiquidityParameters } from './parameters';
import { EdwinService } from '../../core/classes/edwinToolProvider';

export class UniswapProtocol extends EdwinService {
    supportedChains: SupportedChain[] = ['mainnet'];
    private wallet: EdwinEVMWallet;

    constructor(wallet: EdwinEVMWallet) {
        super();
        this.wallet = wallet;
    }

    async getPortfolio(): Promise<string> {
        return '';
    }

    async swap(params: LiquidityParameters): Promise<number> {
        const { chain, asset, amount, assetB, amountB } = params;

        throw new Error(`Not implemented. Params: ${chain} ${asset} ${amount} ${assetB} ${amountB}`);
    }

    async addLiquidity(params: LiquidityParameters): Promise<{ liquidityAdded: [number, number] }> {
        const { chain, asset, amount, assetB, amountB } = params;

        throw new Error(`Not implemented. Params: ${chain} ${asset} ${amount} ${assetB} ${amountB}`);
    }

    async removeLiquidity(
        params: LiquidityParameters
    ): Promise<{ liquidityRemoved: [number, number]; feesClaimed: [number, number] }> {
        const { chain, asset, amount, assetB, amountB } = params;

        throw new Error(`Not implemented. Params: ${chain} ${asset} ${amount} ${assetB} ${amountB}`);
    }

    async getQuote(params: LiquidityParameters): Promise<string> {
        throw new Error(`Not implemented. Params: ${JSON.stringify(params)}`);
    }
}

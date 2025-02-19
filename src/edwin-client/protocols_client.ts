import { DeFiProtocol } from '../types';
import {
    AaveProtocol,
    LidoProtocol,
    LuloProtocol,
    MeteoraProtocol,
    UniswapProtocol,
    JupiterProtocol,
    CookieSwarmClient,
    EOracleClient,
} from '../protocols';
import { EdwinEVMWallet, EdwinSolanaWallet } from '../edwin-core/wallets';

export function initializeProtocols(
    evmWallet?: EdwinEVMWallet,
    solanaWallet?: EdwinSolanaWallet
): Record<string, DeFiProtocol> {
    const protocols: Record<string, DeFiProtocol> = {};

    if (evmWallet) {
        protocols['aave'] = new AaveProtocol(evmWallet);
        protocols['lido'] = new LidoProtocol(evmWallet);
        protocols['uniswap'] = new UniswapProtocol(evmWallet);
    }

    if (solanaWallet) {
        protocols['lulo'] = new LuloProtocol(solanaWallet);
        protocols['meteora'] = new MeteoraProtocol(solanaWallet);
        protocols['jupiter'] = new JupiterProtocol(solanaWallet);
    }

    if (process.env.COOKIE_API_KEY) {
        protocols['cookie'] = new CookieSwarmClient(process.env.COOKIE_API_KEY);
    }

    if (process.env.EORACLE_API_KEY) {
        protocols['eoracle'] = new EOracleClient(process.env.EORACLE_API_KEY);
    }

    return protocols;
}

import { EdwinEVMWallet, EdwinSolanaWallet } from '../core/wallets';
import type { EdwinTool } from '../core/types';
import { aave, lido, lulo, meteora, uniswap, jupiter, cookie, eoracle, storyprotocol, mendi } from '../plugins';
import { AavePlugin } from '../plugins/aave/aavePlugin';
import { LidoPlugin } from '../plugins/lido/lidoPlugin';
import { UniswapPlugin } from '../plugins/uniswap/uniswapPlugin';
import { LuloPlugin } from '../plugins/lulo/luloPlugin';
import { MeteoraPlugin } from '../plugins/meteora/meteoraPlugin';
import { JupiterPlugin } from '../plugins/jupiter/jupiterPlugin';
import { CookiePlugin } from '../plugins/cookie/cookiePlugin';
import { EOraclePlugin } from '../plugins/eoracle/eoraclePlugin';
import { StoryProtocolPlugin } from '../plugins/storyprotocol/storyProtocolPlugin';
import { MendiPlugin } from '../plugins/mendi/mendiPlugin';

export interface EdwinConfig {
    evmPrivateKey?: `0x${string}`;
    solanaPrivateKey?: string;
}

interface EdwinWallets {
    evm?: EdwinEVMWallet;
    solana?: EdwinSolanaWallet;
}

interface EdwinPlugins {
    aave?: AavePlugin;
    lido?: LidoPlugin;
    uniswap?: UniswapPlugin;
    lulo?: LuloPlugin;
    meteora?: MeteoraPlugin;
    jupiter?: JupiterPlugin;
    cookie?: CookiePlugin;
    eoracle?: EOraclePlugin;
    storyprotocol?: StoryProtocolPlugin;
    mendi?: MendiPlugin;
}

export class Edwin {
    public wallets: EdwinWallets = {};
    public plugins: EdwinPlugins = {};

    constructor(config: EdwinConfig) {
        // Initialize wallets
        if (config.evmPrivateKey) {
            this.wallets.evm = new EdwinEVMWallet(config.evmPrivateKey);
        }
        if (config.solanaPrivateKey) {
            this.wallets.solana = new EdwinSolanaWallet(config.solanaPrivateKey);
        }

        // Initialize plugins
        if (this.wallets.evm) {
            this.plugins.aave = aave(this.wallets.evm);
            this.plugins.lido = lido(this.wallets.evm);
            this.plugins.uniswap = uniswap(this.wallets.evm);
            this.plugins.mendi = mendi(this.wallets.evm);
            if (process.env.NFT_CONTRACT_ADDRESS && process.env.SPG_NFT_CONTRACT_ADDRESS) {
                this.plugins.storyprotocol = storyprotocol(this.wallets.evm);
            }
        }

        if (this.wallets.solana) {
            this.plugins.lulo = lulo(this.wallets.solana);
            this.plugins.meteora = meteora(this.wallets.solana);
            this.plugins.jupiter = jupiter(this.wallets.solana);
        }

        if (process.env.COOKIE_API_KEY) {
            this.plugins.cookie = cookie(process.env.COOKIE_API_KEY);
        }

        if (process.env.EORACLE_API_KEY) {
            this.plugins.eoracle = eoracle(process.env.EORACLE_API_KEY);
        }
    }

    async getTools(): Promise<Record<string, EdwinTool>> {
        const tools: Record<string, EdwinTool> = {};
        for (const plugin of Object.values(this.plugins)) {
            const pluginTools = plugin.getTools();
            for (const [name, tool] of Object.entries(pluginTools)) {
                tools[name] = tool as EdwinTool;
            }
        }
        return tools;
    }

    async getPortfolio(): Promise<string> {
        return '';
    }
}

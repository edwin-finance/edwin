import { EdwinEVMWallet, EdwinEVMPublicKeyWallet } from '../core/wallets';
import { EdwinSolanaWallet, EdwinSolanaPublicKeyWallet } from '../core/wallets/solana_wallet';
import type { EdwinTool } from '../core/types';
import { EdwinPlugin } from '../core/classes/edwinPlugin';
import {
    aave,
    lido,
    lulo,
    meteora,
    uniswap,
    jupiter,
    cookie,
    eoracle,
    storyprotocol,
    mendi,
    dexscreener,
    evmWallet,
    solanaWallet,
} from '../plugins';
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
import { DexScreenerPlugin } from '../plugins/dexscreener/dexscreenerPlugin';
import { EVMWalletPlugin } from '../plugins/evm_wallet/evmWalletPlugin';
import { SolanaWalletPlugin } from '../plugins/solana_wallet/solanaWalletPlugin';

export interface EdwinConfig {
    evmPrivateKey?: `0x${string}`;
    evmPublicKey?: `0x${string}`;
    solanaPrivateKey?: string;
    solanaPublicKey?: string;
}

interface EdwinWallets {
    evm?: EdwinEVMPublicKeyWallet;
    solana?: EdwinSolanaPublicKeyWallet;
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
    dexscreener?: DexScreenerPlugin;
    evmWallet?: EVMWalletPlugin;
    solanaWallet?: SolanaWalletPlugin;
}

export class Edwin {
    public wallets: EdwinWallets = {};
    public plugins: EdwinPlugins = {};

    constructor(config: EdwinConfig) {
        // Initialize EVM wallet based on whether private or public key is provided
        if (config.evmPrivateKey) {
            this.wallets.evm = new EdwinEVMWallet(config.evmPrivateKey);
        } else if (config.evmPublicKey) {
            this.wallets.evm = new EdwinEVMPublicKeyWallet(config.evmPublicKey);
        }

        // Initialize Solana wallet based on whether private or public key is provided
        if (config.solanaPrivateKey) {
            this.wallets.solana = new EdwinSolanaWallet(config.solanaPrivateKey);
        } else if (config.solanaPublicKey) {
            this.wallets.solana = new EdwinSolanaPublicKeyWallet(config.solanaPublicKey);
        }

        // Initialize EVM plugins
        if (this.wallets.evm) {
            // Initialize EVM wallet plugin (works with public key wallet)
            this.plugins.evmWallet = evmWallet(this.wallets.evm);

            // Initialize plugins that require signing capabilities
            if (this.wallets.evm instanceof EdwinEVMWallet) {
                this.plugins.aave = aave(this.wallets.evm);
                this.plugins.lido = lido(this.wallets.evm);
                this.plugins.uniswap = uniswap(this.wallets.evm);
                this.plugins.mendi = mendi(this.wallets.evm);
                if (process.env.NFT_CONTRACT_ADDRESS && process.env.SPG_NFT_CONTRACT_ADDRESS) {
                    this.plugins.storyprotocol = storyprotocol(this.wallets.evm);
                }
            }
        }

        if (this.wallets.solana) {
            this.plugins.lulo = lulo(this.wallets.solana);
            this.plugins.meteora = meteora(this.wallets.solana);
            this.plugins.jupiter = jupiter(this.wallets.solana);
            this.plugins.solanaWallet = solanaWallet(this.wallets.solana);
        }

        if (process.env.COOKIE_API_KEY) {
            this.plugins.cookie = cookie(process.env.COOKIE_API_KEY);
        }

        if (process.env.EORACLE_API_KEY) {
            this.plugins.eoracle = eoracle(process.env.EORACLE_API_KEY);
        }

        // Initialize DexScreener plugin (no wallet or API key required)
        this.plugins.dexscreener = dexscreener();
    }

    async getTools(): Promise<Record<string, EdwinTool>> {
        const tools: Record<string, EdwinTool> = {};

        for (const plugin of Object.values(this.plugins)) {
            // Get public tools from all plugins
            const publicTools = plugin.getPublicTools();
            for (const [name, tool] of Object.entries(publicTools)) {
                tools[name] = tool as EdwinTool;
            }

            // Get private tools from plugins if the wallet has signing capabilities
            if (this.hasSigningCapabilitiesForPlugin(plugin)) {
                const privateTools = plugin.getPrivateTools();
                for (const [name, tool] of Object.entries(privateTools)) {
                    tools[name] = tool as EdwinTool;
                }
            }
        }
        return tools;
    }

    /**
     * Checks if the wallet has signing capabilities for a specific plugin
     * @param plugin The plugin to check
     * @returns true if the wallet has signing capabilities for the plugin, false otherwise
     */
    private hasSigningCapabilitiesForPlugin(plugin: EdwinPlugin): boolean {
        // Check if the plugin is a Solana plugin
        if (
            plugin instanceof JupiterPlugin ||
            plugin instanceof MeteoraPlugin ||
            plugin instanceof LuloPlugin ||
            plugin instanceof SolanaWalletPlugin
        ) {
            return this.wallets.solana instanceof EdwinSolanaWallet;
        }

        // Check if the plugin is an EVM plugin
        if (
            plugin instanceof AavePlugin ||
            plugin instanceof LidoPlugin ||
            plugin instanceof UniswapPlugin ||
            plugin instanceof MendiPlugin ||
            plugin instanceof StoryProtocolPlugin ||
            plugin instanceof EVMWalletPlugin
        ) {
            return this.wallets.evm instanceof EdwinEVMWallet;
        }

        // For other plugins, assume they don't require signing capabilities
        return true;
    }

    async getPortfolio(): Promise<string> {
        return '';
    }
}

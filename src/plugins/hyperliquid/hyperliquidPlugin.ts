import { EdwinPlugin } from '../../core/classes/edwinPlugin';
import { EdwinTool } from '../../core/types';

/**
 * HyperLiquid plugin for Edwin
 */
export class HyperLiquidPlugin extends EdwinPlugin {
    constructor() {
        super('hyperliquid', []);
    }

    getTools(): Record<string, EdwinTool> {
        // Combine public and private tools
        return {
            ...this.getPublicTools(),
            ...this.getPrivateTools(),
        };
    }

    getPublicTools(): Record<string, EdwinTool> {
        // HyperLiquid has no public tools
        return {};
    }

    getPrivateTools(): Record<string, EdwinTool> {
        // HyperLiquid has no private tools
        return {};
    }
}

export const hyperliquid = new HyperLiquidPlugin();

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
        return {};
    }
}

export const hyperliquid = new HyperLiquidPlugin();

import { EdwinTool } from '../types';
import { EdwinService } from './edwinToolProvider';

export abstract class EdwinPlugin {
    private tools: EdwinTool[];

    constructor(
        protected name: string,
        protected toolProviders: EdwinService[]
    ) {
        this.tools = [];
    }

    protected getToolsArray(): EdwinTool[] {
        return this.tools;
    }

    /**
     * Get all tools provided by this plugin
     */
    abstract getTools(): Record<string, EdwinTool>;

    /**
     * Get tools that don't require signing capabilities
     */
    abstract getPublicTools(): Record<string, EdwinTool>;

    /**
     * Get tools that require signing capabilities
     */
    abstract getPrivateTools(): Record<string, EdwinTool>;
}

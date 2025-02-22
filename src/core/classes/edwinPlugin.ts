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

    abstract getTools(): Record<string, EdwinTool>;
}

import { ZodSchema } from 'zod';

export interface EdwinTool<TSchema extends ZodSchema = ZodSchema> {
    name: string;
    description: string;
    schema: TSchema;
    execute: (params: TSchema['_output']) => Promise<unknown>;
}

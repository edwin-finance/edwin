import { z } from 'zod';

/**
 * Represents a parameter schema with both validation and type information
 */
export interface ParameterSchema<T extends z.ZodSchema> {
    /** The Zod schema for validation */
    schema: T;
    /** Type information for TypeScript (used for type inference) */
    type: z.infer<T>;
}

/**
 * Creates a parameter schema with typing information
 * @param schema - The Zod schema definition
 * @returns The schema with type information
 */
export function createParameterSchema<T extends z.ZodSchema>(schema: T): ParameterSchema<T> {
    // Return both the schema and its inferred type
    return {
        schema,
        type: {} as z.infer<T>,
    };
}

import { z } from 'zod';
import { EdwinTool } from '../../core/types';

/**
 * Base template for extracting tool parameters
 */
export const toolParametersTemplate = `
You are an AI assistant specialized in extracting specific information from user messages and format it into a structured JSON response. Your task is to extract specific information from user messages and format it into a structured JSON response.

First, review the recent messages from the conversation:

<recent_messages>
{{recentMessages}}
</recent_messages>

Your goal is to extract the following parameters:
{{schemaParameters}}
Provide the final output in JSON format:

\`\`\`json
{{schemaJson}}
\`\`\`
`;

/**
 * Generates a tool parameters prompt from a tool and template
 * @param tool - The EdwinTool containing the schema
 * @returns The populated tool parameters prompt
 */
export function generateToolParametersPrompt(tool: EdwinTool): string {
    const schema = tool.schema as z.ZodTypeAny;

    // Generate parameter descriptions
    const schemaParameters = generateParameterDescriptions(schema);

    // Generate JSON template
    const jsonTemplate = generateJsonTemplate(schema);

    // Replace template placeholders
    return toolParametersTemplate
        .replace('{{schemaParameters}}', schemaParameters)
        .replace('{{schemaJson}}', JSON.stringify(jsonTemplate, null, 2));
}

/**
 * Generates parameter descriptions from a schema
 */
function generateParameterDescriptions(schema: z.ZodTypeAny): string {
    // Only process object schemas
    if (schema._def?.typeName !== 'ZodObject') {
        return '';
    }

    const shape = schema._def.shape();

    // Generate a description line for each parameter
    const paramLines = Object.entries<z.ZodTypeAny>(shape).map(([key, value]) => {
        const isOptional = value.isOptional?.() || false;
        const description = value.description || 'No description provided';
        const type = getTypeString(value);

        return `- ${key}${isOptional ? ' (optional)' : ''}: ${description}. Type: ${type}`;
    });

    return paramLines.join('\n');
}

/**
 * Generates a JSON template from a schema
 */
function generateJsonTemplate(schema: z.ZodTypeAny): Record<string, any> {
    if (schema._def?.typeName !== 'ZodObject') {
        return {};
    }

    const shape = schema._def.shape();
    const template: Record<string, any> = {};

    Object.entries<z.ZodTypeAny>(shape).forEach(([key, value]) => {
        template[key] = getPlaceholderValue(value);
    });

    return template;
}

/**
 * Gets a human-readable type name
 */
function getTypeString(schema: z.ZodTypeAny): string {
    const typeName = schema._def?.typeName;

    switch (typeName) {
        case 'ZodOptional':
            return getTypeString((schema as z.ZodOptional<z.ZodTypeAny>).unwrap());
        case 'ZodString':
            return 'string';
        case 'ZodNumber':
            return 'number';
        case 'ZodBoolean':
            return 'boolean';
        case 'ZodArray':
            return 'array';
        case 'ZodObject':
            return 'object';
        default:
            return 'unknown';
    }
}

/**
 * Creates an appropriate placeholder value for the JSON template
 */
function getPlaceholderValue(schema: z.ZodTypeAny): any {
    const typeName = schema._def?.typeName;

    switch (typeName) {
        case 'ZodOptional':
            return getPlaceholderValue((schema as z.ZodOptional<z.ZodTypeAny>).unwrap());
        case 'ZodString':
            return '<string>';
        case 'ZodNumber':
            return '<number>';
        case 'ZodBoolean':
            return '<true|false>';
        case 'ZodArray':
            return ['<items>'];
        case 'ZodObject': {
            const shape = schema._def.shape();
            const result: Record<string, any> = {};
            Object.entries<z.ZodTypeAny>(shape).forEach(([key, value]) => {
                result[key] = getPlaceholderValue(value);
            });
            return result;
        }
        default:
            return '<value>';
    }
}

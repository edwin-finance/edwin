export const toolParametersTemplate = `Your task is to extract specific information from user messages and format it into a structured JSON response.

First, review the recent messages from the conversation:

<recent_messages>
{{recentMessages}}
</recent_messages>

Your goal is to extract the following information about the requested liquidity removal:
{{schemaParameters}}
Provide the final output in JSON format:

\`\`\`json
{{schemaJson}}
\`\`\`
`;

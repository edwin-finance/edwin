import { HumanMessage } from '@langchain/core/messages';
import { MemorySaver } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as readline from 'readline';
import { Edwin, EdwinConfig, getEdwinTools } from '../src';
import { ACTION_MAP } from '../src/edwin-client/actions_client';
dotenv.config();

function validateEnvironment(): void {
    const missingVars: string[] = [];
    const requiredVars = ['OPENAI_API_KEY', 'EVM_PRIVATE_KEY', 'SOLANA_PRIVATE_KEY'];

    requiredVars.forEach(varName => {
        if (!process.env[varName]) {
            missingVars.push(varName);
        }
    });

    if (missingVars.length > 0) {
        console.error('Error: Required environment variables are not set');
        missingVars.forEach(varName => {
            console.error(`${varName}=your_${varName.toLowerCase()}_here`);
        });
        process.exit(1);
    }
}

validateEnvironment();

async function initializeAgent() {
    try {
        const llm = new ChatOpenAI({
            modelName: 'gpt-4o-mini',
            temperature: 0.7,
        });

        if (!process.env.EVM_PRIVATE_KEY) {
            console.error('Error: EVM private key is not set');
            throw new Error('EVM private key is not set');
        }

        const actions = Object.keys(ACTION_MAP);

        console.log('Used actions:', actions);

        // Configure Edwin wallets and providers
        const edwinConfig: EdwinConfig = {
            evmPrivateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
            solanaPrivateKey: process.env.SOLANA_PRIVATE_KEY,
            actions: actions,
        };

        // Initialize Edwin SDK
        const edwin = new Edwin(edwinConfig);

        const tools = await getEdwinTools({ edwin });
        const memory = new MemorySaver();
        const config = { configurable: { thread_id: 'Edwin SDK Usage' } };

        const agent = createReactAgent({
            llm,
            tools,
            checkpointSaver: memory,
            messageModifier: `
            - You are an agent that can interact on-chain evm and solana using the tools of Edwin SDK
            - If the tool requires fund, you can response to require fund depositing
            - If there is any errors, ask the user to try it again
            - If the user asks you to do something that you can't do, you must say so and encourage them to implement it themselves using the Edwin SDK and visit https://edwin.finance/ for more information
            - Be concise and helpful with your responses`,
        });

        return { agent, config };
    } catch (error) {
        console.error('Failed to initialize agent:', error);
        throw error;
    }
}

async function runChatMode(agent: any, config: any) {
    console.log("Starting chat mode... Type 'exit' to end.");

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const question = (prompt: string): Promise<string> => new Promise(resolve => rl.question(prompt, resolve));

    try {
        while (true) {
            const userInput = await question('\nPrompt: ');

            if (userInput.toLowerCase() === 'exit') {
                break;
            }

            const stream = await agent.stream({ messages: [new HumanMessage(userInput)] }, config);

            for await (const chunk of stream) {
                if ('agent' in chunk) {
                    console.log(chunk.agent.messages[0].content);
                } else if ('tools' in chunk) {
                    console.log(chunk.tools.messages[0].content);
                }
                console.log('-------------------');
            }
        }
    } catch (error) {
        if (error instanceof Error) {
            console.error('Error:', error.message);
        }
        process.exit(1);
    } finally {
        rl.close();
    }
}

async function main() {
    try {
        console.log('Starting Agent...');
        const { agent, config } = await initializeAgent();

        await runChatMode(agent, config);
    } catch (error) {
        if (error instanceof Error) {
            console.error('Error:', error.message);
        }
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

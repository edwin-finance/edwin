import { describe, it } from 'vitest';
import edwinLogger from '../src/utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

describe('Logger Test', () => {
    describe('Logger', () => {
        it('should log info message', async () => {
            edwinLogger.info('Hello, world!');
        });

        it('should log debug message', async () => {
            edwinLogger.debug('Hello, world!');
        });

        it('should log error message', async () => {
            edwinLogger.error('Hello, world!');
        });

        it('should log warning message', async () => {
            edwinLogger.warn('Hello, world!');
        });
    });
});

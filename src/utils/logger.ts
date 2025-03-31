import winston from 'winston';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Configure transports based on environment
const transports: winston.transport[] = [];

// Add console transport only if we're not in MCP mode
if (process.env.EDWIN_MCP_MODE !== 'true') {
    transports.push(
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp(),
                winston.format.printf(({ timestamp, level, message }) => {
                    return `${timestamp} [${level.toUpperCase()}] ${message}`;
                })
            ),
        })
    );
}

// Add file transport if file logging is enabled or we're in MCP mode
if (process.env.EDWIN_FILE_LOGGING === 'true' || process.env.EDWIN_MCP_MODE === 'true') {
    try {
        // Get home directory
        const homeDir = os.homedir();
        if (!homeDir || homeDir === '/') {
            throw new Error('Could not determine home directory for logs');
        }

        // Set up log paths
        const baseDir = path.join(homeDir, '.edwin');
        const logsDir = path.join(baseDir, 'logs');
        const logFile = path.join(logsDir, 'edwin.log');

        // Create directories
        fs.mkdirSync(baseDir, { recursive: true, mode: 0o755 });
        fs.mkdirSync(logsDir, { recursive: true, mode: 0o755 });

        // Add file transport
        transports.push(
            new winston.transports.File({
                filename: logFile,
                format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
                maxsize: 5242880, // 5MB
                maxFiles: 5,
                tailable: true,
            })
        );
    } catch (error) {
        // In MCP mode, we can't even log this error to console, so we'll have to throw
        if (process.env.EDWIN_MCP_MODE === 'true') {
            throw new Error(`Failed to set up required file logging for MCP mode: ${error}`);
        }
        // Otherwise, we'll fall back to console logging
        console.warn('Failed to set up file logging:', error);
    }
}

// Create the logger
const edwinLogger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'debug',
    exitOnError: false,
    levels: winston.config.npm.levels,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}] ${message}`;
        })
    ),
    transports,
});

export default edwinLogger;

import { HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import 'dotenv/config';

const config: HardhatUserConfig = {
    solidity: {
        version: '0.8.20', // Updated to match OpenZeppelin contracts
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
        // Skip compilation to avoid network issues
        compilers: [],
    },
    networks: {
        hardhat: {
            // Enable forking from Base network for AAVE integration tests
            forking: {
                url: process.env.BASE_FORK_URL || 'https://mainnet.base.org',
                blockNumber: 5000000, // Use a specific block number for deterministic tests
            },
        },
    },
    paths: {
        sources: './contracts',
        tests: './tests',
        cache: './cache',
        artifacts: './artifacts',
    },
    mocha: {
        timeout: 60000, // Increased timeout for network requests
    },
};

export default config;

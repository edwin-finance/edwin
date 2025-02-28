import { HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import 'dotenv/config';

const config: HardhatUserConfig = {
    // Skip compilation for mock tests
    solidity: {
        compilers: [],
    },
    networks: {
        hardhat: {
            // Using local development network for now
            // We'll mock the AAVE interactions in our tests
        },
    },
    paths: {
        sources: './contracts',
        tests: './tests',
        cache: './cache',
        artifacts: './artifacts',
    },
    // Skip compilation for mock tests
    mocha: {
        timeout: 40000,
    },
};

export default config;

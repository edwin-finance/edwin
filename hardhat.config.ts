import { HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';
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
};

export default config;

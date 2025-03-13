// Export all setup functions for easy importing
export { setupHyperLiquidMocks } from './hyperliquid.setup';
export { setupJupiterMocks } from './jupiter.setup';
export { setupAaveMocks } from './aave.setup';
export { setupCookieMocks } from './cookie.setup';
export { setupMeteoraMocks } from './meteora.setup';
export { setupStoryProtocolMocks } from './storyprotocol.setup';

/**
 * Setup all mocks for comprehensive testing
 * This can be used in the main test setup file
 */
export function setupAllMocks() {
    // Import and run all setup functions
    const { 
        setupHyperLiquidMocks, 
        setupJupiterMocks, 
        setupAaveMocks, 
        setupCookieMocks, 
        setupMeteoraMocks,
        setupStoryProtocolMocks
    } = require('./index');
    
    setupHyperLiquidMocks();
    setupJupiterMocks();
    setupAaveMocks();
    setupCookieMocks();
    setupMeteoraMocks();
    setupStoryProtocolMocks();
}

// Import mock setup functions
import { setupJupiterMocks } from './jupiter.setup';
import { setupCookieMocks } from './cookie.setup';
import { setupHyperLiquidMocks } from './hyperliquid.setup';
import { setupAaveMocks } from './aave.setup';
import { setupMeteoraMocks } from './meteora.setup.fixed';
import { setupStoryProtocolMocks } from './storyprotocol.setup';

/**
 * Sets up all mocks for tests
 * This allows tests to run without actual blockchain interactions
 * and simulates successful API responses
 */
export function setupAllMocks() {
    setupJupiterMocks();
    setupCookieMocks();
    setupHyperLiquidMocks();
    setupAaveMocks();
    setupMeteoraMocks();
    setupStoryProtocolMocks();
}

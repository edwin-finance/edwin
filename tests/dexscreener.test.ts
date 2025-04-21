import { describe, it, expect, beforeEach } from 'vitest';
import { DexScreenerService } from '../src/plugins/dexscreener/dexscreenerService';

// Edwin token address on Solana
const EDWIN_TOKEN_ADDRESS = 'GPrg1CgbBvAJS2SCuf9gF7NmQYsWudfyfWy5SUzypump';
const CHAIN_ID = 'solana';
const TIMEOUT = 10000; // 10 seconds

describe('DexScreener Integration Tests', () => {
  let dexscreenerService: DexScreenerService;

  beforeEach(() => {
    dexscreenerService = new DexScreenerService();
  });

  describe('Search Pairs', () => {
    it('should search for pairs matching a query', async () => {
      const result = await dexscreenerService.searchPairs({
        query: 'SOL/USDC',
      });

      expect(result).toBeDefined();
      expect(result.pairs).toBeDefined();
      expect(Array.isArray(result.pairs)).toBe(true);
      
      if (result.pairs.length > 0) {
        const pair = result.pairs[0];
        expect(pair.chainId).toBeDefined();
        expect(pair.baseToken).toBeDefined();
        expect(pair.quoteToken).toBeDefined();
      }
    }, TIMEOUT);
  });

  describe('Get Pair', () => {
    it('should get pair information by chain and pair address', async () => {
      // First get a valid pair address by searching
      const searchResult = await dexscreenerService.searchPairs({
        query: 'SOL/USDC',
      });

      // Only run this test if we found pairs
      if (searchResult.pairs && searchResult.pairs.length > 0) {
        const pairToTest = searchResult.pairs[0];
        
        const result = await dexscreenerService.getPair({
          chainId: pairToTest.chainId,
          pairId: pairToTest.pairAddress,
        });

        expect(result).toBeDefined();
        expect(result.pairs).toBeDefined();
        expect(Array.isArray(result.pairs)).toBe(true);
        
        if (result.pairs.length > 0) {
          const pair = result.pairs[0];
          expect(pair.pairAddress).toBe(pairToTest.pairAddress);
          expect(pair.chainId).toBe(pairToTest.chainId);
        }
      } else {
        // Skip if no pairs found
        console.log('No pairs found for SOL/USDC, skipping getPair test');
      }
    }, TIMEOUT);
  });

  describe('Get Token Pairs', () => {
    it('should get the pools of a given token address', async () => {
      const result = await dexscreenerService.getTokenPairs({
        chainId: CHAIN_ID,
        tokenAddress: EDWIN_TOKEN_ADDRESS,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      // If there are results, validate their structure
      if (result.length > 0) {
        const pair = result[0];
        expect(pair.chainId).toBe(CHAIN_ID);
        
        // Check if either baseToken or quoteToken matches EDWIN_TOKEN_ADDRESS
        const hasEdwinToken = 
          pair.baseToken.address.toLowerCase() === EDWIN_TOKEN_ADDRESS.toLowerCase() ||
          pair.quoteToken.address.toLowerCase() === EDWIN_TOKEN_ADDRESS.toLowerCase();
        
        expect(hasEdwinToken).toBe(true);
      }
    }, TIMEOUT);
  });

  describe('Get Tokens', () => {
    it('should get token information by token address', async () => {
      const result = await dexscreenerService.getTokens({
        chainId: CHAIN_ID,
        tokenAddresses: EDWIN_TOKEN_ADDRESS,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      // If there are results, validate their structure
      if (result.length > 0) {
        const pair = result[0];
        expect(pair.chainId).toBe(CHAIN_ID);
        
        // Check if either baseToken or quoteToken matches EDWIN_TOKEN_ADDRESS
        const hasEdwinToken = 
          pair.baseToken.address.toLowerCase() === EDWIN_TOKEN_ADDRESS.toLowerCase() ||
          pair.quoteToken.address.toLowerCase() === EDWIN_TOKEN_ADDRESS.toLowerCase();
        
        expect(hasEdwinToken).toBe(true);
      }
    }, TIMEOUT);
  });

  describe('Get Latest Token Profiles', () => {
    it('should get the latest token profiles', async () => {
      const result = await dexscreenerService.getLatestTokenProfiles();

      expect(result).toBeDefined();
      
      // Validate structure if available
      if (Object.keys(result).length > 0) {
        expect(result.chainId).toBeDefined();
        expect(result.tokenAddress).toBeDefined();
        expect(result.description).toBeDefined();
      }
    }, TIMEOUT);
  });

  describe('Get Latest Boosted Tokens', () => {
    it('should get the latest boosted tokens', async () => {
      const result = await dexscreenerService.getLatestBoostedTokens();

      expect(result).toBeDefined();
      
      // Validate structure if available
      if (Object.keys(result).length > 0) {
        expect(result.chainId).toBeDefined();
        expect(result.tokenAddress).toBeDefined();
        expect(result.amount).toBeDefined();
        expect(result.totalAmount).toBeDefined();
      }
    }, TIMEOUT);
  });

  describe('Get Top Boosted Tokens', () => {
    it('should get the tokens with most active boosts', async () => {
      const result = await dexscreenerService.getTopBoostedTokens();

      expect(result).toBeDefined();
      
      // Validate structure if available
      if (Object.keys(result).length > 0) {
        expect(result.chainId).toBeDefined();
        expect(result.tokenAddress).toBeDefined();
        expect(result.amount).toBeDefined();
        expect(result.totalAmount).toBeDefined();
      }
    }, TIMEOUT);
  });

  describe('Get Token Orders', () => {
    it('should check orders paid for a token', async () => {
      try {
        const result = await dexscreenerService.getTokenOrders(CHAIN_ID, EDWIN_TOKEN_ADDRESS);

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        
        // If there are results, validate their structure
        if (result.length > 0) {
          const order = result[0];
          expect(order.type).toBeDefined();
          expect(order.status).toBeDefined();
          expect(order.paymentTimestamp).toBeDefined();
        }
      } catch (error) {
        // This endpoint might return 404 if no orders exist
        // In that case, we'll consider the test passing
        if (error instanceof Error && error.message.includes('404')) {
          console.log('No orders found for Edwin token, test passes');
        } else {
          throw error;
        }
      }
    }, TIMEOUT);
  });

  describe('Error Handling', () => {
    it('should handle errors for invalid token addresses', async () => {
      await expect(
        dexscreenerService.getTokenPairs({
          chainId: CHAIN_ID,
          tokenAddress: 'invalid-address',
        })
      ).rejects.toThrow();
    }, TIMEOUT);

    it('should handle errors for invalid chain IDs', async () => {
      await expect(
        dexscreenerService.getTokenPairs({
          chainId: 'invalid-chain',
          tokenAddress: EDWIN_TOKEN_ADDRESS,
        })
      ).rejects.toThrow();
    }, TIMEOUT);
  });
}); 
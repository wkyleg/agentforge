import { defineScenario } from '../core/scenario.js';
import type { Scenario } from '../core/types.js';
import { HolderAgent, MomentumAgent, RandomTraderAgent } from './toyAgents.js';
import { ToyPack } from './toyPack.js';

/**
 * Create a default toy scenario for testing
 *
 * Features:
 * - 3 assets with different volatilities
 * - Mix of random traders, momentum followers, and holders
 * - 100 ticks of simulation
 */
export function createToyScenario(
  options: {
    seed?: number;
    ticks?: number;
    traderCount?: number;
    momentumCount?: number;
    holderCount?: number;
  } = {}
): Scenario {
  const { seed = 1337, ticks = 100, traderCount = 5, momentumCount = 3, holderCount = 2 } = options;

  const pack = new ToyPack({
    assets: [
      { name: 'ALPHA', initialPrice: 100, volatility: 0.03 },
      { name: 'BETA', initialPrice: 50, volatility: 0.06 },
      { name: 'GAMMA', initialPrice: 25, volatility: 0.1 },
    ],
    initialCash: 10000,
  });

  return defineScenario({
    name: 'toy-market',
    seed,
    ticks,
    tickSeconds: 3600, // 1 hour per tick
    pack,
    agents: [
      {
        type: RandomTraderAgent,
        count: traderCount,
        params: {
          buyWeight: 0.35,
          sellWeight: 0.25,
          holdWeight: 0.4,
          maxTradePercent: 0.08,
        },
      },
      {
        type: MomentumAgent,
        count: momentumCount,
        params: {
          threshold: 1.5,
          tradePercent: 0.15,
        },
      },
      {
        type: HolderAgent,
        count: holderCount,
      },
    ],
    metrics: {
      sampleEveryTicks: 1,
    },
    assertions: [
      // Ensure some trading occurred
      { type: 'gt', metric: 'totalVolume', value: 0 },
    ],
  });
}

/**
 * Default toy scenario instance
 */
export const toyScenario = createToyScenario();

/**
 * Export scenario as default for dynamic loading
 */
export default toyScenario;

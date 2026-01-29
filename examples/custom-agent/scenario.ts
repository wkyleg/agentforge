/**
 * Custom agent example
 *
 * This example demonstrates how to create custom agents with:
 * - Memory (persistent state between ticks)
 * - Cooldowns (prevent action spam)
 * - Precondition checks
 * - Custom logic based on world state
 *
 * Run with: npx tsx examples/custom-agent/scenario.ts
 */

import {
  type Action,
  BaseAgent,
  type TickContext,
  defineScenario,
  runScenario,
} from '../../src/index.js';
import { ToyPack } from '../../src/toy/index.js';

/**
 * A custom agent that tracks price trends and trades accordingly
 */
class TrendFollowerAgent extends BaseAgent {
  async initialize(_ctx: TickContext): Promise<void> {
    // Initialize price history in memory
    this.remember('priceHistory', [] as number[]);
    this.remember('lastAction', 'none');
  }

  async step(ctx: TickContext): Promise<Action | null> {
    const world = ctx.world;
    const currentPrice = (world.assets as { TOKEN?: { price: number } })?.TOKEN?.price ?? 100;

    // Get price history from memory
    const history = this.recall<number[]>('priceHistory', []);

    // Add current price to history
    history.push(currentPrice);
    if (history.length > 10) {
      history.shift(); // Keep only last 10 prices
    }
    this.remember('priceHistory', history);

    // Need at least 3 data points to analyze trend
    if (history.length < 3) {
      return null;
    }

    // Calculate simple trend (average of last 3 vs current)
    const recentAvg = history.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const trend = currentPrice / recentAvg;

    // Check cooldown - don't trade too frequently
    if (this.isOnCooldown('trade', ctx.tick)) {
      ctx.logger.debug(
        { remaining: this.getCooldownRemaining('trade', ctx.tick) },
        'Trade on cooldown'
      );
      return null;
    }

    // Decide action based on trend
    let action: Action | null = null;

    if (trend > 1.02) {
      // Price is rising - buy
      action = {
        id: this.generateActionId('buy', ctx.tick),
        name: 'buy',
        params: {
          asset: 'TOKEN',
          amount: this.getParam('tradeSize', 50) * ctx.rng.nextFloat() * 2,
        },
      };
      this.remember('lastAction', 'buy');
    } else if (trend < 0.98) {
      // Price is falling - sell
      action = {
        id: this.generateActionId('sell', ctx.tick),
        name: 'sell',
        params: {
          asset: 'TOKEN',
          amount: this.getParam('tradeSize', 50) * ctx.rng.nextFloat() * 2,
        },
      };
      this.remember('lastAction', 'sell');
    }

    if (action) {
      // Set cooldown after trading
      const cooldownTicks = this.getParam('cooldownTicks', 3);
      this.setCooldown('trade', cooldownTicks, ctx.tick);
    }

    return action;
  }
}

/**
 * A contrarian agent that does the opposite of the trend
 */
class ContrarianAgent extends BaseAgent {
  async step(ctx: TickContext): Promise<Action | null> {
    const world = ctx.world;
    const currentPrice = (world.assets as { TOKEN?: { price: number } })?.TOKEN?.price ?? 100;
    const prevPrice = this.recall<number>('prevPrice', currentPrice);

    // Store current price for next tick
    this.remember('prevPrice', currentPrice);

    // Only trade with some probability
    if (!ctx.rng.chance(0.4)) {
      return null;
    }

    const priceChange = (currentPrice - prevPrice) / prevPrice;

    // Contrarian: buy when falling, sell when rising
    if (priceChange < -0.01) {
      return {
        id: this.generateActionId('buy', ctx.tick),
        name: 'buy',
        params: {
          asset: 'TOKEN',
          amount: 100 * Math.abs(priceChange) * 10,
        },
      };
    }
    if (priceChange > 0.01) {
      return {
        id: this.generateActionId('sell', ctx.tick),
        name: 'sell',
        params: {
          asset: 'TOKEN',
          amount: 100 * priceChange * 10,
        },
      };
    }

    return null;
  }
}

/**
 * A scheduled agent that only trades at specific ticks
 */
class ScheduledTraderAgent extends BaseAgent {
  async step(ctx: TickContext): Promise<Action | null> {
    const tradingTicks = this.getParam<number[]>('tradingTicks', [10, 20, 30, 40, 50]);

    // Only trade on scheduled ticks
    if (!tradingTicks.includes(ctx.tick)) {
      return null;
    }

    // Alternate between buy and sell
    const actionName = ctx.tick % 20 === 10 ? 'buy' : 'sell';

    return {
      id: this.generateActionId(actionName, ctx.tick),
      name: actionName,
      params: {
        asset: 'TOKEN',
        amount: this.getParam('amount', 200),
      },
    };
  }
}

// Define scenario with custom agents
const scenario = defineScenario({
  name: 'custom-agents',
  seed: 12345,
  ticks: 60,
  tickSeconds: 3600,

  pack: new ToyPack({
    assets: [{ name: 'TOKEN', initialPrice: 100, volatility: 0.04 }],
    initialCash: 10000,
  }),

  agents: [
    // Trend followers with different parameters
    {
      type: TrendFollowerAgent,
      count: 3,
      params: { tradeSize: 50, cooldownTicks: 3 },
    },
    {
      type: TrendFollowerAgent,
      count: 2,
      params: { tradeSize: 100, cooldownTicks: 5 },
    },

    // Contrarians to create market dynamics
    { type: ContrarianAgent, count: 2 },

    // Scheduled trader for predictable volume
    {
      type: ScheduledTraderAgent,
      count: 1,
      params: { tradingTicks: [10, 20, 30, 40, 50], amount: 300 },
    },
  ],

  metrics: {
    sampleEveryTicks: 1,
  },

  assertions: [{ type: 'gt', metric: 'totalVolume', value: 1000 }],
});

async function main() {
  console.log('Running custom agent simulation...\n');

  const result = await runScenario(scenario, {
    outDir: 'examples/custom-agent/results',
    verbose: false,
  });

  console.log('\n=== Results ===');
  console.log(`Status: ${result.success ? 'PASSED' : 'FAILED'}`);
  console.log(`Total Volume: ${result.finalMetrics.totalVolume}`);
  console.log(`Final Token Price: ${result.finalMetrics.price_TOKEN}`);

  process.exit(result.success ? 0 : 1);
}

main().catch(console.error);

export default scenario;

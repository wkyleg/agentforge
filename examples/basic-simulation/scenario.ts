/**
 * Basic simulation example
 *
 * This example demonstrates a minimal simulation setup using the built-in
 * toy market pack and standard agent types.
 *
 * Run with: npx tsx examples/basic-simulation/scenario.ts
 * Or via CLI: npx forge-sim run examples/basic-simulation/scenario.ts
 */

import { defineScenario, runScenario } from '../../src/index.js';
import { HolderAgent, MomentumAgent, RandomTraderAgent, ToyPack } from '../../src/toy/index.js';

// Define the simulation scenario
const scenario = defineScenario({
  // Scenario identifier - used in artifact filenames
  name: 'basic-simulation',

  // Random seed for reproducibility
  // Same seed = identical results every time
  seed: 42,

  // Number of simulation steps
  ticks: 50,

  // Simulated time per tick (1 hour)
  tickSeconds: 3600,

  // The "pack" provides the market simulation
  pack: new ToyPack({
    // Define tradeable assets
    assets: [
      { name: 'TOKEN', initialPrice: 100, volatility: 0.03 },
      { name: 'STABLE', initialPrice: 1, volatility: 0.001 },
    ],
    // Starting cash for each agent
    initialCash: 10000,
  }),

  // Agent configurations
  agents: [
    // 5 random traders - buy/sell randomly
    { type: RandomTraderAgent, count: 5 },

    // 3 momentum traders - follow price trends
    { type: MomentumAgent, count: 3, params: { lookbackTicks: 5 } },

    // 2 holders - rarely trade
    { type: HolderAgent, count: 2 },
  ],

  // Metrics collection configuration
  metrics: {
    sampleEveryTicks: 1, // Record metrics every tick
    track: ['totalVolume', 'price_TOKEN', 'price_STABLE', 'totalAgentValue'],
  },

  // Optional assertions to validate after simulation
  assertions: [
    // Total volume should be greater than 0
    { type: 'gt', metric: 'totalVolume', value: 0 },
    // Price shouldn't crash to zero
    { type: 'gt', metric: 'price_TOKEN', value: 0 },
  ],
});

// Run the simulation
async function main() {
  console.log('Running basic simulation...\n');

  const result = await runScenario(scenario, {
    outDir: 'examples/basic-simulation/results',
    verbose: false,
  });

  // Print summary
  console.log('\n=== Simulation Complete ===\n');
  console.log(`Status: ${result.success ? 'PASSED' : 'FAILED'}`);
  console.log(`Duration: ${result.durationMs}ms`);
  console.log(`Ticks: ${result.ticks}`);
  console.log(`Output: ${result.outputDir}`);

  console.log('\n--- Final Metrics ---');
  for (const [key, value] of Object.entries(result.finalMetrics)) {
    console.log(`  ${key}: ${value}`);
  }

  console.log('\n--- Agent Stats ---');
  for (const stat of result.agentStats) {
    const rate =
      stat.actionsAttempted > 0
        ? Math.round((stat.actionsSucceeded / stat.actionsAttempted) * 100)
        : 100;
    console.log(`  ${stat.id}: ${stat.actionsSucceeded}/${stat.actionsAttempted} (${rate}%)`);
  }

  if (result.failedAssertions.length > 0) {
    console.log('\n--- Failed Assertions ---');
    for (const failure of result.failedAssertions) {
      console.log(`  ❌ ${failure.message}`);
    }
  }

  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error('Simulation failed:', error);
  process.exit(2);
});

export default scenario;

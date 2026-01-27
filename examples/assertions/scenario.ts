/**
 * Assertions example
 *
 * This example demonstrates how to use assertions to validate
 * simulation outcomes. Assertions are checked after the simulation
 * completes and determine the success/failure status.
 *
 * Run with: npx tsx examples/assertions/scenario.ts
 */

import { defineScenario, runScenario } from '../../src/index.js';
import { MomentumAgent, RandomTraderAgent, ToyPack } from '../../src/toy/index.js';

// Define a scenario with various assertion types
const scenario = defineScenario({
  name: 'assertion-demo',
  seed: 9999,
  ticks: 100,
  tickSeconds: 3600,

  pack: new ToyPack({
    assets: [{ name: 'TOKEN', initialPrice: 100, volatility: 0.02 }],
    initialCash: 10000,
  }),

  agents: [
    { type: RandomTraderAgent, count: 8 },
    { type: MomentumAgent, count: 4 },
  ],

  metrics: {
    sampleEveryTicks: 1,
    // Track specific metrics for assertions
    track: ['totalVolume', 'totalAgentValue', 'price_TOKEN', 'tick', 'actionsExecuted'],
  },

  // Assertions to validate simulation outcomes
  assertions: [
    // Greater than (gt): metric must be strictly greater than value
    {
      type: 'gt',
      metric: 'totalVolume',
      value: 0,
    },

    // Greater than or equal (gte): metric must be >= value
    {
      type: 'gte',
      metric: 'tick',
      value: 99, // Final tick should be at least 99
    },

    // Less than (lt): metric must be strictly less than value
    {
      type: 'lt',
      metric: 'price_TOKEN',
      value: 500, // Price shouldn't explode
    },

    // Less than or equal (lte): metric must be <= value
    {
      type: 'lte',
      metric: 'totalVolume',
      value: 1000000, // Reasonable upper bound
    },

    // Equal (eq): metric must exactly equal value
    // Note: Use with caution - floats may have precision issues
    // {
    //   type: 'eq',
    //   metric: 'someMetric',
    //   value: 42,
    // },

    // Price should stay positive (market didn't crash to zero)
    {
      type: 'gt',
      metric: 'price_TOKEN',
      value: 0,
    },

    // Total agent value should remain positive
    {
      type: 'gt',
      metric: 'totalAgentValue',
      value: 0,
    },
  ],
});

async function main() {
  console.log('Running assertions example...\n');
  console.log('This scenario defines multiple assertions that are checked');
  console.log('after the simulation completes.\n');

  const result = await runScenario(scenario, {
    outDir: 'examples/assertions/results',
    verbose: false,
  });

  console.log('\n=== Assertion Results ===\n');

  if (result.failedAssertions.length === 0) {
    console.log('✅ All assertions passed!\n');

    console.log('Validated conditions:');
    for (const assertion of scenario.assertions ?? []) {
      const actualValue = result.finalMetrics[assertion.metric];
      console.log(`  ✅ ${assertion.metric} ${assertion.type} ${assertion.value}`);
      console.log(`     Actual value: ${actualValue}`);
    }
  } else {
    console.log('❌ Some assertions failed:\n');

    for (const failure of result.failedAssertions) {
      console.log(`  ❌ ${failure.message}`);
      console.log(
        `     Assertion: ${failure.assertion.metric} ${failure.assertion.type} ${failure.assertion.value}`
      );
      console.log(`     Actual: ${failure.actualValue}`);
    }

    console.log('\nPassing assertions:');
    const failedMetrics = new Set(result.failedAssertions.map((f) => f.assertion.metric));
    for (const assertion of scenario.assertions ?? []) {
      if (!failedMetrics.has(assertion.metric)) {
        console.log(`  ✅ ${assertion.metric} ${assertion.type} ${assertion.value}`);
      }
    }
  }

  console.log('\n--- Final Metrics ---');
  for (const [key, value] of Object.entries(result.finalMetrics)) {
    console.log(`  ${key}: ${value}`);
  }

  console.log(`\nSimulation ${result.success ? 'PASSED' : 'FAILED'}`);

  process.exit(result.success ? 0 : 1);
}

main().catch(console.error);

export default scenario;

/**
 * Metrics tracking example
 *
 * This example demonstrates how metrics are collected and exported
 * during simulations. Shows how to:
 * - Configure metrics sampling
 * - Track specific metrics
 * - Access metrics programmatically
 * - Analyze results from CSV output
 *
 * Run with: npx tsx examples/metrics-tracking/scenario.ts
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  MetricsCollector,
  SimulationEngine,
  createLogger,
  defineScenario,
} from '../../src/index.js';
import { MomentumAgent, RandomTraderAgent, ToyPack } from '../../src/toy/index.js';

// Define scenario with detailed metrics configuration
const scenario = defineScenario({
  name: 'metrics-tracking',
  seed: 55555,
  ticks: 30,
  tickSeconds: 3600,

  pack: new ToyPack({
    assets: [
      { name: 'TOKEN', initialPrice: 100, volatility: 0.03 },
      { name: 'COIN', initialPrice: 50, volatility: 0.05 },
    ],
    initialCash: 10000,
  }),

  agents: [
    { type: RandomTraderAgent, count: 5 },
    { type: MomentumAgent, count: 3 },
  ],

  // Metrics configuration
  metrics: {
    // Sample every tick for detailed time-series
    sampleEveryTicks: 1,

    // Optionally track only specific metrics
    // If not specified, all metrics from pack are tracked
    track: [
      'tick',
      'timestamp',
      'price_TOKEN',
      'price_COIN',
      'totalVolume',
      'totalAgentValue',
      'actionsExecuted',
    ],
  },
});

async function main() {
  console.log('Running metrics tracking example...\n');

  const outDir = 'examples/metrics-tracking/results';
  const logger = createLogger({ level: 'warn' }); // Quiet logging

  const engine = new SimulationEngine({ logger });
  const result = await engine.run(scenario, {
    outDir,
    ci: true,
  });

  console.log('=== Simulation Complete ===\n');
  console.log(`Ticks executed: ${result.ticks}`);
  console.log(`Duration: ${result.durationMs}ms`);

  // Read and analyze the metrics CSV
  const metricsPath = join(result.outputDir, 'metrics.csv');

  try {
    const csvContent = await readFile(metricsPath, 'utf-8');
    const lines = csvContent.trim().split('\n');
    const headers = lines[0]?.split(',') ?? [];

    console.log('\n=== Metrics CSV Analysis ===\n');
    console.log(`Columns: ${headers.join(', ')}`);
    console.log(`Data rows: ${lines.length - 1}`);

    // Parse data
    const data: Record<string, number[]> = {};
    for (const header of headers) {
      data[header] = [];
    }

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i]?.split(',') ?? [];
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        const value = values[j];
        if (header && value) {
          data[header].push(Number.parseFloat(value));
        }
      }
    }

    // Calculate statistics for key metrics
    console.log('\n=== Metric Statistics ===\n');

    const metricsToAnalyze = ['price_TOKEN', 'price_COIN', 'totalVolume', 'totalAgentValue'];

    for (const metric of metricsToAnalyze) {
      const values = data[metric];
      if (!values || values.length === 0) continue;

      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const first = values[0];
      const last = values[values.length - 1];
      const change = first && last ? ((last - first) / first) * 100 : 0;

      console.log(`${metric}:`);
      console.log(`  First: ${first?.toFixed(2)}`);
      console.log(`  Last:  ${last?.toFixed(2)}`);
      console.log(`  Min:   ${min.toFixed(2)}`);
      console.log(`  Max:   ${max.toFixed(2)}`);
      console.log(`  Avg:   ${avg.toFixed(2)}`);
      console.log(`  Change: ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`);
      console.log();
    }

    // Show price trajectory
    const tokenPrices = data.price_TOKEN;
    if (tokenPrices && tokenPrices.length > 0) {
      console.log('=== TOKEN Price Trajectory ===\n');

      const width = 50;
      const minPrice = Math.min(...tokenPrices);
      const maxPrice = Math.max(...tokenPrices);
      const range = maxPrice - minPrice;

      for (let i = 0; i < tokenPrices.length; i += Math.ceil(tokenPrices.length / 15)) {
        const price = tokenPrices[i];
        if (price === undefined) continue;
        const normalized = range > 0 ? (price - minPrice) / range : 0.5;
        const bar = '█'.repeat(Math.round(normalized * width));
        console.log(`Tick ${String(i).padStart(2)}: ${bar} ${price.toFixed(2)}`);
      }
    }
  } catch {
    console.log('Could not read metrics CSV');
  }

  // Show final metrics from result
  console.log('\n=== Final Metrics (from result) ===\n');
  for (const [key, value] of Object.entries(result.finalMetrics)) {
    const formatted = typeof value === 'number' ? value.toFixed(4) : value;
    console.log(`  ${key}: ${formatted}`);
  }

  console.log('\n=== Output Files ===\n');
  console.log(`Directory: ${result.outputDir}`);
  console.log('Files:');
  console.log('  - summary.json       Complete run summary');
  console.log('  - metrics.csv        Time-series data');
  console.log('  - actions.ndjson     All agent actions');
  console.log('  - config_resolved.json  Configuration used');
  console.log('  - run.log            Structured logs');

  process.exit(result.success ? 0 : 1);
}

main().catch(console.error);

export default scenario;

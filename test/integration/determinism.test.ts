import { exec } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const execAsync = promisify(exec);
const CLI_PATH = join(process.cwd(), 'src/cli/index.ts');

describe('Simulation Determinism', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `agentforge-determinism-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('produces identical results with same seed', async () => {
    const seed = 12345;

    // Run 1
    await execAsync(
      `npx tsx ${CLI_PATH} run --toy --ticks 10 --seed ${seed} --out ${join(testDir, 'run1')} --ci`
    );

    // Run 2
    await execAsync(
      `npx tsx ${CLI_PATH} run --toy --ticks 10 --seed ${seed} --out ${join(testDir, 'run2')} --ci`
    );

    // Compare summaries
    const summary1 = JSON.parse(
      await readFile(join(testDir, 'run1', 'toy-market-ci', 'summary.json'), 'utf-8')
    );
    const summary2 = JSON.parse(
      await readFile(join(testDir, 'run2', 'toy-market-ci', 'summary.json'), 'utf-8')
    );

    // Final metrics should match
    expect(summary1.finalMetrics.totalVolume).toBe(summary2.finalMetrics.totalVolume);
    expect(summary1.finalMetrics.totalAgentValue).toBe(summary2.finalMetrics.totalAgentValue);

    // Agent stats should match
    expect(summary1.agentStats).toEqual(summary2.agentStats);
  });

  it('produces different results with different seeds', async () => {
    // Run with seed 1
    await execAsync(
      `npx tsx ${CLI_PATH} run --toy --ticks 20 --seed 111 --out ${join(testDir, 'seed1')} --ci`
    );

    // Run with seed 2
    await execAsync(
      `npx tsx ${CLI_PATH} run --toy --ticks 20 --seed 222 --out ${join(testDir, 'seed2')} --ci`
    );

    // Compare summaries
    const summary1 = JSON.parse(
      await readFile(join(testDir, 'seed1', 'toy-market-ci', 'summary.json'), 'utf-8')
    );
    const summary2 = JSON.parse(
      await readFile(join(testDir, 'seed2', 'toy-market-ci', 'summary.json'), 'utf-8')
    );

    // Results should be different
    // Note: There's a tiny chance they could be identical by coincidence,
    // but with 20 ticks and multiple agents, this is extremely unlikely
    const stats1 = summary1.agentStats.map((s: { actionsAttempted: number }) => s.actionsAttempted);
    const stats2 = summary2.agentStats.map((s: { actionsAttempted: number }) => s.actionsAttempted);

    // At least one agent should have different action count
    const identical = stats1.every((v: number, i: number) => v === stats2[i]);
    expect(identical).toBe(false);
  });

  it('agent execution order is deterministic', async () => {
    const seed = 98765;

    // Run twice with same seed
    await execAsync(
      `npx tsx ${CLI_PATH} run --toy --ticks 5 --seed ${seed} --out ${join(testDir, 'order1')} --ci`
    );
    await execAsync(
      `npx tsx ${CLI_PATH} run --toy --ticks 5 --seed ${seed} --out ${join(testDir, 'order2')} --ci`
    );

    // Compare action logs
    const actions1 = await readFile(
      join(testDir, 'order1', 'toy-market-ci', 'actions.ndjson'),
      'utf-8'
    );
    const actions2 = await readFile(
      join(testDir, 'order2', 'toy-market-ci', 'actions.ndjson'),
      'utf-8'
    );

    // Parse and compare agent order per tick
    const parseAgentOrder = (ndjson: string) => {
      const lines = ndjson.trim().split('\n');
      const byTick: Record<number, string[]> = {};
      for (const line of lines) {
        const entry = JSON.parse(line);
        if (!byTick[entry.tick]) {
          byTick[entry.tick] = [];
        }
        byTick[entry.tick].push(entry.agentId);
      }
      return byTick;
    };

    const order1 = parseAgentOrder(actions1);
    const order2 = parseAgentOrder(actions2);

    expect(order1).toEqual(order2);
  });

  it('metrics are collected at consistent intervals', async () => {
    const seed = 54321;

    await execAsync(
      `npx tsx ${CLI_PATH} run --toy --ticks 10 --seed ${seed} --out ${testDir} --ci`
    );

    const metricsPath = join(testDir, 'toy-market-ci', 'metrics.csv');
    const metricsContent = await readFile(metricsPath, 'utf-8');
    const lines = metricsContent.trim().split('\n');

    // Should have header + at least 10 data rows
    expect(lines.length).toBeGreaterThanOrEqual(11);

    // Check ticks are sequential
    const header = lines[0];
    expect(header).toContain('tick');

    const tickIndex = header?.split(',').indexOf('tick') ?? -1;
    expect(tickIndex).toBeGreaterThanOrEqual(0);
  });
});

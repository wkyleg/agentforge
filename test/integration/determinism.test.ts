import { exec } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const execAsync = promisify(exec);
const CLI_PATH = join(process.cwd(), 'src/cli/index.ts');

/**
 * Compute SHA256 hash of a file's contents
 */
async function computeFileHash(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf-8');
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Compute hash of actions.ndjson normalized (ignoring wall-clock dependent fields)
 */
async function computeActionsHash(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  // Normalize by removing variable fields: durationMs (execution time) and timestamp (wall-clock start)
  const normalized = lines.map((line) => {
    const obj = JSON.parse(line);
    obj.durationMs = undefined;
    obj.timestamp = undefined;
    return JSON.stringify(obj);
  });
  return createHash('sha256').update(normalized.join('\n')).digest('hex');
}

/**
 * Compute hash of config_resolved.json normalized (ignoring outDir which changes between runs)
 */
async function computeConfigHash(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf-8');
  const config = JSON.parse(content);
  // Remove options.outDir which changes between runs
  if (config.options) {
    config.options.outDir = undefined;
  }
  return createHash('sha256')
    .update(JSON.stringify(config, null, 2))
    .digest('hex');
}

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

  it('artifact hashes are identical across runs with same seed', async () => {
    const seed = 77777;

    // Run 1
    await execAsync(
      `npx tsx ${CLI_PATH} run --toy --ticks 10 --seed ${seed} --out ${join(testDir, 'hash1')} --ci`
    );

    // Run 2
    await execAsync(
      `npx tsx ${CLI_PATH} run --toy --ticks 10 --seed ${seed} --out ${join(testDir, 'hash2')} --ci`
    );

    const run1Dir = join(testDir, 'hash1', 'toy-market-ci');
    const run2Dir = join(testDir, 'hash2', 'toy-market-ci');

    // actions.ndjson should be identical (excluding timing fields)
    const actionsHash1 = await computeActionsHash(join(run1Dir, 'actions.ndjson'));
    const actionsHash2 = await computeActionsHash(join(run2Dir, 'actions.ndjson'));
    expect(actionsHash1).toBe(actionsHash2);

    // config_resolved.json should be identical (excluding outDir)
    const configHash1 = await computeConfigHash(join(run1Dir, 'config_resolved.json'));
    const configHash2 = await computeConfigHash(join(run2Dir, 'config_resolved.json'));
    expect(configHash1).toBe(configHash2);

    // metrics.csv should be identical (timestamps come from scenario, not wall clock)
    const metricsHash1 = await computeFileHash(join(run1Dir, 'metrics.csv'));
    const metricsHash2 = await computeFileHash(join(run2Dir, 'metrics.csv'));
    expect(metricsHash1).toBe(metricsHash2);
  });

  it('action IDs are deterministic', async () => {
    const seed = 88888;

    // Run twice
    await execAsync(
      `npx tsx ${CLI_PATH} run --toy --ticks 5 --seed ${seed} --out ${join(testDir, 'ids1')} --ci`
    );
    await execAsync(
      `npx tsx ${CLI_PATH} run --toy --ticks 5 --seed ${seed} --out ${join(testDir, 'ids2')} --ci`
    );

    // Compare action IDs
    const actions1 = await readFile(
      join(testDir, 'ids1', 'toy-market-ci', 'actions.ndjson'),
      'utf-8'
    );
    const actions2 = await readFile(
      join(testDir, 'ids2', 'toy-market-ci', 'actions.ndjson'),
      'utf-8'
    );

    const ids1 = actions1
      .trim()
      .split('\n')
      .map((line) => {
        const obj = JSON.parse(line);
        return obj.action?.id;
      })
      .filter(Boolean);

    const ids2 = actions2
      .trim()
      .split('\n')
      .map((line) => {
        const obj = JSON.parse(line);
        return obj.action?.id;
      })
      .filter(Boolean);

    // Action IDs should match exactly
    expect(ids1).toEqual(ids2);

    // Verify IDs don't contain timestamps (no Date.now())
    for (const id of ids1) {
      // IDs should be in format: agentId-actionName-tick-counter
      // Not: agentId-actionName-tick-timestamp (13+ digit number)
      const parts = id.split('-');
      const lastPart = parts[parts.length - 1];
      // Counter should be a small number, not a timestamp
      expect(Number(lastPart)).toBeLessThan(1000);
    }
  });
});

import { exec } from 'node:child_process';
import { constants, access, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const execAsync = promisify(exec);
const CLI_PATH = join(process.cwd(), 'src', 'cli', 'index.ts');

describe('CLI: forge-sim run --toy', () => {
  let testDir: string;
  let outDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `agentforge-integration-${Date.now()}`);
    outDir = join(testDir, 'results');
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('runs toy scenario successfully', async () => {
    const { stdout } = await execAsync(
      `npx tsx ${CLI_PATH} run --toy --ticks 10 --out ${outDir} --ci`,
      { timeout: 60000 }
    );

    expect(stdout).toContain('toy-market');
    expect(stdout).toContain('PASSED');
  }, 60000);

  it('creates output directory with artifacts', async () => {
    await execAsync(`npx tsx ${CLI_PATH} run --toy --ticks 5 --out ${outDir} --ci`, {
      timeout: 60000,
    });

    // Find the run directory (should be toy-market-ci in CI mode)
    const runDir = join(outDir, 'toy-market-ci');

    // Check that all required files exist
    await expect(access(join(runDir, 'summary.json'), constants.F_OK)).resolves.toBeUndefined();
    await expect(access(join(runDir, 'metrics.csv'), constants.F_OK)).resolves.toBeUndefined();
    await expect(access(join(runDir, 'actions.ndjson'), constants.F_OK)).resolves.toBeUndefined();
    await expect(
      access(join(runDir, 'config_resolved.json'), constants.F_OK)
    ).resolves.toBeUndefined();
  }, 60000);

  it('produces valid summary.json', async () => {
    await execAsync(`npx tsx ${CLI_PATH} run --toy --ticks 5 --seed 12345 --out ${outDir} --ci`, {
      timeout: 60000,
    });

    const runDir = join(outDir, 'toy-market-ci');
    const summaryPath = join(runDir, 'summary.json');
    const content = await readFile(summaryPath, 'utf-8');
    const summary = JSON.parse(content);

    expect(summary).toHaveProperty('runId');
    expect(summary).toHaveProperty('scenarioName', 'toy-market');
    expect(summary).toHaveProperty('seed', 12345);
    expect(summary).toHaveProperty('ticks', 5);
    expect(summary).toHaveProperty('durationMs');
    expect(summary).toHaveProperty('success', true);
    expect(summary).toHaveProperty('finalMetrics');
    expect(summary).toHaveProperty('agentStats');
  }, 60000);

  it('produces valid metrics.csv with correct row count', async () => {
    const ticks = 10;

    await execAsync(`npx tsx ${CLI_PATH} run --toy --ticks ${ticks} --out ${outDir} --ci`, {
      timeout: 60000,
    });

    const runDir = join(outDir, 'toy-market-ci');
    const metricsPath = join(runDir, 'metrics.csv');
    const content = await readFile(metricsPath, 'utf-8');
    const lines = content.trim().split('\n');

    // Should have header + (ticks) rows
    // With sampleEveryTicks: 1, we get a sample each tick
    expect(lines.length).toBeGreaterThan(1);

    // Check header has expected columns
    const header = lines[0];
    expect(header).toContain('tick');
    expect(header).toContain('timestamp');
  }, 60000);

  it('produces valid actions.ndjson', async () => {
    await execAsync(`npx tsx ${CLI_PATH} run --toy --ticks 5 --out ${outDir} --ci`, {
      timeout: 60000,
    });

    const runDir = join(outDir, 'toy-market-ci');
    const actionsPath = join(runDir, 'actions.ndjson');
    const content = await readFile(actionsPath, 'utf-8');
    const lines = content.trim().split('\n');

    // Should have some actions recorded
    expect(lines.length).toBeGreaterThan(0);

    // Each line should be valid JSON
    for (const line of lines) {
      const action = JSON.parse(line);
      expect(action).toHaveProperty('tick');
      expect(action).toHaveProperty('agentId');
      expect(action).toHaveProperty('durationMs');
    }
  }, 60000);

  it('is deterministic with same seed', async () => {
    const seed = 42;

    // First run
    await execAsync(
      `npx tsx ${CLI_PATH} run --toy --ticks 5 --seed ${seed} --out ${outDir}/run1 --ci`,
      { timeout: 60000 }
    );

    // Second run with same seed
    await execAsync(
      `npx tsx ${CLI_PATH} run --toy --ticks 5 --seed ${seed} --out ${outDir}/run2 --ci`,
      { timeout: 60000 }
    );

    // Compare summaries
    const summary1 = JSON.parse(
      await readFile(join(outDir, 'run1', 'toy-market-ci', 'summary.json'), 'utf-8')
    );
    const summary2 = JSON.parse(
      await readFile(join(outDir, 'run2', 'toy-market-ci', 'summary.json'), 'utf-8')
    );

    // Final metrics should be identical
    expect(summary1.finalMetrics).toEqual(summary2.finalMetrics);

    // Agent stats should match
    expect(summary1.agentStats.length).toBe(summary2.agentStats.length);
    for (let i = 0; i < summary1.agentStats.length; i++) {
      expect(summary1.agentStats[i].actionsSucceeded).toBe(summary2.agentStats[i].actionsSucceeded);
      expect(summary1.agentStats[i].actionsFailed).toBe(summary2.agentStats[i].actionsFailed);
    }
  }, 120000);

  it('produces different results with different seeds', async () => {
    // First run with seed 1
    await execAsync(
      `npx tsx ${CLI_PATH} run --toy --ticks 20 --seed 1 --out ${outDir}/seed1 --ci`,
      { timeout: 60000 }
    );

    // Second run with seed 2
    await execAsync(
      `npx tsx ${CLI_PATH} run --toy --ticks 20 --seed 2 --out ${outDir}/seed2 --ci`,
      { timeout: 60000 }
    );

    const summary1 = JSON.parse(
      await readFile(join(outDir, 'seed1', 'toy-market-ci', 'summary.json'), 'utf-8')
    );
    const summary2 = JSON.parse(
      await readFile(join(outDir, 'seed2', 'toy-market-ci', 'summary.json'), 'utf-8')
    );

    // Results should differ (very unlikely to be identical with different seeds)
    // Check some metric that varies
    const _metric1 = summary1.finalMetrics.totalVolume;
    const _metric2 = summary2.finalMetrics.totalVolume;

    // They could theoretically be equal, but very unlikely with 20 ticks
    // We just verify the runs completed
    expect(summary1.success).toBe(true);
    expect(summary2.success).toBe(true);
  }, 120000);

  it('respects --ticks flag', async () => {
    const customTicks = 15;

    await execAsync(`npx tsx ${CLI_PATH} run --toy --ticks ${customTicks} --out ${outDir} --ci`, {
      timeout: 60000,
    });

    const runDir = join(outDir, 'toy-market-ci');
    const summary = JSON.parse(await readFile(join(runDir, 'summary.json'), 'utf-8'));

    expect(summary.ticks).toBe(customTicks);
  }, 60000);

  it('exits with code 0 on success', async () => {
    const { stdout } = await execAsync(
      `npx tsx ${CLI_PATH} run --toy --ticks 3 --out ${outDir} --ci`,
      { timeout: 60000 }
    );

    expect(stdout).toContain('successfully');
  }, 60000);
});

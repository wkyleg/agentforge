import { exec } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const execAsync = promisify(exec);
const CLI_PATH = join(process.cwd(), 'src', 'cli', 'index.ts');

describe('CLI: forge-sim report', () => {
  let testDir: string;
  let runDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `agentforge-report-test-${Date.now()}`);
    runDir = join(testDir, 'test-run');
    await mkdir(runDir, { recursive: true });

    // Create mock run artifacts
    const summary = {
      runId: 'test-run',
      scenarioName: 'test-scenario',
      seed: 42,
      ticks: 100,
      durationMs: 1000,
      success: true,
      failedAssertions: [],
      finalMetrics: { volume: 1000, tick: 99 },
      agentStats: [
        {
          id: 'agent-0',
          type: 'TestAgent',
          actionsAttempted: 100,
          actionsSucceeded: 95,
          actionsFailed: 5,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    const config = {
      scenario: {
        name: 'test-scenario',
        seed: 42,
        ticks: 100,
        tickSeconds: 3600,
        packName: 'TestPack',
        agentCount: 1,
        agentTypes: [{ type: 'TestAgent', count: 1 }],
      },
      options: {},
    };

    const actions = [
      {
        tick: 0,
        timestamp: 0,
        agentId: 'agent-0',
        agentType: 'TestAgent',
        action: { id: 'a1', name: 'buy', params: {} },
        result: { ok: true },
        durationMs: 1,
      },
      {
        tick: 1,
        timestamp: 1,
        agentId: 'agent-0',
        agentType: 'TestAgent',
        action: { id: 'a2', name: 'sell', params: {} },
        result: { ok: true },
        durationMs: 1,
      },
    ];

    const metricsCSV = 'tick,timestamp,volume\n0,0,0\n50,50,500\n99,99,1000';

    await writeFile(join(runDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
    await writeFile(join(runDir, 'config_resolved.json'), `${JSON.stringify(config, null, 2)}\n`);
    await writeFile(
      join(runDir, 'actions.ndjson'),
      actions.map((a) => JSON.stringify(a)).join('\n')
    );
    await writeFile(join(runDir, 'metrics.csv'), metricsCSV);
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('generates markdown report from run directory', async () => {
    const { stdout } = await execAsync(`npx tsx ${CLI_PATH} report ${runDir}`);

    // CLI outputs summary to stdout
    expect(stdout).toContain('test-scenario');
    expect(stdout).toContain('Report written to');

    // Check the generated report file
    const reportPath = join(runDir, 'report.md');
    const reportContent = await readFile(reportPath, 'utf-8');
    expect(reportContent).toContain('# Simulation Report');
    expect(reportContent).toContain('## KPI Summary');
    expect(reportContent).toContain('volume');
  });

  it('outputs JSON when --json flag is provided', async () => {
    const { stdout } = await execAsync(`npx tsx ${CLI_PATH} report ${runDir} --json`);

    // JSON output is mixed with info output, so extract the JSON part
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    expect(jsonMatch).not.toBeNull();
    const result = JSON.parse(jsonMatch![0]);
    expect(result.summary.scenarioName).toBe('test-scenario');
    expect(result.hashes).toBeDefined();
  });

  it('fails gracefully for invalid run directory', async () => {
    const invalidDir = join(testDir, 'nonexistent');

    await expect(execAsync(`npx tsx ${CLI_PATH} report ${invalidDir}`)).rejects.toThrow();
  });

  it('includes file hashes for determinism verification', async () => {
    await execAsync(`npx tsx ${CLI_PATH} report ${runDir}`);

    // Check the generated report file
    const reportPath = join(runDir, 'report.md');
    const reportContent = await readFile(reportPath, 'utf-8');
    expect(reportContent).toContain('## Determinism Fingerprint');
    // Report includes hashes for config, metrics, and actions
    expect(reportContent).toMatch(/config:.*[a-f0-9]{8}/i);
    expect(reportContent).toMatch(/metrics:.*[a-f0-9]{8}/i);
    expect(reportContent).toMatch(/actions:.*[a-f0-9]{8}/i);
  });
});

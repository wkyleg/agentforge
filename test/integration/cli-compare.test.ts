import { exec } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const execAsync = promisify(exec);
const CLI_PATH = join(process.cwd(), 'src', 'cli', 'index.ts');

describe('CLI: forge-sim compare', () => {
  let testDir: string;
  let runDirA: string;
  let runDirB: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `agentforge-compare-test-${Date.now()}`);
    runDirA = join(testDir, 'run-a');
    runDirB = join(testDir, 'run-b');
    await mkdir(runDirA, { recursive: true });
    await mkdir(runDirB, { recursive: true });

    // Create mock artifacts for run A
    const summaryA = {
      runId: 'run-a',
      scenarioName: 'test-scenario',
      seed: 42,
      ticks: 100,
      durationMs: 1000,
      success: true,
      failedAssertions: [],
      finalMetrics: { volume: 1000, price: 50 },
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

    // Create mock artifacts for run B (with different metrics)
    const summaryB = {
      runId: 'run-b',
      scenarioName: 'test-scenario',
      seed: 42,
      ticks: 100,
      durationMs: 1100,
      success: true,
      failedAssertions: [],
      finalMetrics: { volume: 1200, price: 60 }, // 20% more volume, 20% more price
      agentStats: [
        {
          id: 'agent-0',
          type: 'TestAgent',
          actionsAttempted: 100,
          actionsSucceeded: 98,
          actionsFailed: 2,
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

    const actionsA = [
      {
        tick: 0,
        agentId: 'agent-0',
        agentType: 'TestAgent',
        action: { id: 'a1', name: 'buy', params: {} },
        result: { ok: true },
        durationMs: 1,
      },
    ];

    const actionsB = [
      {
        tick: 0,
        agentId: 'agent-0',
        agentType: 'TestAgent',
        action: { id: 'a1', name: 'buy', params: {} },
        result: { ok: true },
        durationMs: 1,
      },
    ];

    const metricsCSV = 'tick,timestamp,volume\n0,0,0\n99,99,1000';

    // Write run A artifacts
    await writeFile(join(runDirA, 'summary.json'), `${JSON.stringify(summaryA, null, 2)}\n`);
    await writeFile(join(runDirA, 'config_resolved.json'), `${JSON.stringify(config, null, 2)}\n`);
    await writeFile(
      join(runDirA, 'actions.ndjson'),
      actionsA.map((a) => JSON.stringify(a)).join('\n')
    );
    await writeFile(join(runDirA, 'metrics.csv'), metricsCSV);

    // Write run B artifacts
    await writeFile(join(runDirB, 'summary.json'), `${JSON.stringify(summaryB, null, 2)}\n`);
    await writeFile(join(runDirB, 'config_resolved.json'), `${JSON.stringify(config, null, 2)}\n`);
    await writeFile(
      join(runDirB, 'actions.ndjson'),
      actionsB.map((a) => JSON.stringify(a)).join('\n')
    );
    await writeFile(join(runDirB, 'metrics.csv'), metricsCSV);
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('generates comparison report from two run directories', async () => {
    const outputPath = join(testDir, 'compare.md');
    const { stdout } = await execAsync(
      `npx tsx ${CLI_PATH} compare ${runDirA} ${runDirB} -o ${outputPath}`
    );

    // CLI outputs summary to stdout
    expect(stdout).toContain('Comparing runs');
    expect(stdout).toContain('Comparison report written to');

    // Check the generated report file
    const reportContent = await readFile(outputPath, 'utf-8');
    expect(reportContent).toContain('# Run Comparison Report');
    expect(reportContent).toContain('## KPI Comparison');
    expect(reportContent).toContain('volume');
  });

  it('shows KPI deltas and percentage changes', async () => {
    const { stdout } = await execAsync(`npx tsx ${CLI_PATH} compare ${runDirA} ${runDirB}`);

    // Volume increased from 1000 to 1200 = +20%
    expect(stdout).toContain('+20.0%');
    // Price increased from 50 to 60 = +20%
    expect(stdout).toContain('price');
  });

  it('outputs JSON when --json flag is provided', async () => {
    const { stdout } = await execAsync(`npx tsx ${CLI_PATH} compare ${runDirA} ${runDirB} --json`);

    // JSON output is mixed with info output, so extract the JSON part
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    expect(jsonMatch).not.toBeNull();
    const result = JSON.parse(jsonMatch![0]);
    expect(result.runA.scenario).toBe('test-scenario');
    expect(result.runB.scenario).toBe('test-scenario');
    expect(result.kpiDiffs).toBeDefined();
    expect(Array.isArray(result.kpiDiffs)).toBe(true);
  });

  it('detects metadata differences', async () => {
    const outputPath = join(testDir, 'compare.md');
    await execAsync(`npx tsx ${CLI_PATH} compare ${runDirA} ${runDirB} -o ${outputPath}`);

    // Check the generated report file
    const reportContent = await readFile(outputPath, 'utf-8');
    expect(reportContent).toContain('## Metadata');
  });

  it('includes determinism check section', async () => {
    const outputPath = join(testDir, 'compare.md');
    await execAsync(`npx tsx ${CLI_PATH} compare ${runDirA} ${runDirB} -o ${outputPath}`);

    // Check the generated report file
    const reportContent = await readFile(outputPath, 'utf-8');
    expect(reportContent).toContain('## Determinism Check');
  });

  it('shows significant changes when threshold exceeded', async () => {
    // With --threshold 5, a 20% change should be reported
    const { stdout } = await execAsync(
      `npx tsx ${CLI_PATH} compare ${runDirA} ${runDirB} --threshold 5`
    );

    expect(stdout).toContain('Significant Changes');
    expect(stdout).toContain('+20.0%');
  });

  it('shows no significant changes when threshold not exceeded', async () => {
    // With --threshold 25, a 20% change should not be significant
    const { stdout } = await execAsync(
      `npx tsx ${CLI_PATH} compare ${runDirA} ${runDirB} --threshold 25`
    );
    expect(stdout).toContain('No significant changes detected');
  });
});

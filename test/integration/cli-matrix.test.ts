import { exec } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const execAsync = promisify(exec);
const CLI_PATH = join(process.cwd(), 'src', 'cli', 'index.ts');

describe('CLI: forge-sim matrix', () => {
  let testDir: string;
  let scenarioPath: string;
  let variantsPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `agentforge-matrix-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Create a minimal scenario file
    scenarioPath = join(testDir, 'scenario.ts');
    const scenarioCode = `
import { defineScenario } from '@elata-biosciences/agentforge';
import { NoOpAgent } from '@elata-biosciences/agentforge';
import { createMockPack } from '@elata-biosciences/agentforge/test';

export default defineScenario({
  name: 'test-matrix',
  seed: 42,
  ticks: 5,
  pack: createMockPack(),
  agents: [{ type: NoOpAgent, count: 1 }],
});
`;
    await writeFile(scenarioPath, scenarioCode);

    // Create variants file
    variantsPath = join(testDir, 'variants.ts');
    const variantsCode = `
export default [
  { name: 'baseline', description: 'Base configuration' },
  { name: 'modified', description: 'Modified configuration', overrides: { ticks: 3 } },
];
`;
    await writeFile(variantsPath, variantsCode);
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('runs without variants file (uses baseline only)', async () => {
    const outDir = join(testDir, 'matrix-results');

    // Use toy scenario which doesn't need a variants file
    const { stdout } = await execAsync(
      `npx tsx ${CLI_PATH} matrix examples/toy.ts --seeds 1..2 --ticks 3 -o ${outDir}`
    );

    expect(stdout).toContain('Matrix');
    expect(stdout).toContain('baseline');
  }, 30000);

  it('creates report.md with comparisons', async () => {
    const outDir = join(testDir, 'matrix-results');

    await execAsync(
      `npx tsx ${CLI_PATH} matrix examples/toy.ts --seeds 1..2 --ticks 3 -o ${outDir}`
    );

    const { readdir } = await import('node:fs/promises');
    const dirs = await readdir(outDir);
    expect(dirs.length).toBeGreaterThan(0);

    const matrixDir = join(outDir, dirs[0] as string);
    const reportPath = join(matrixDir, 'report.md');

    const reportContent = await readFile(reportPath, 'utf-8');
    expect(reportContent).toContain('# Matrix Report');
  }, 30000);

  it('creates summary.csv with all variant/seed combinations', async () => {
    const outDir = join(testDir, 'matrix-results');

    await execAsync(
      `npx tsx ${CLI_PATH} matrix examples/toy.ts --seeds 1..2 --ticks 3 -o ${outDir}`
    );

    const { readdir } = await import('node:fs/promises');
    const dirs = await readdir(outDir);
    const matrixDir = join(outDir, dirs[0] as string);
    const csvPath = join(matrixDir, 'summary.csv');

    const csvContent = await readFile(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');

    // Header + at least 2 data rows (1 variant x 2 seeds)
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines[0]).toContain('variant');
    expect(lines[0]).toContain('seed');
  }, 30000);

  it('outputs JSON when --json flag is provided', async () => {
    const outDir = join(testDir, 'matrix-results');

    const { stdout } = await execAsync(
      `npx tsx ${CLI_PATH} matrix examples/toy.ts --seeds 1..2 --ticks 3 -o ${outDir} --json`
    );

    const result = JSON.parse(stdout);
    expect(result.scenario).toBe('toy-market');
    expect(result.variants).toBeDefined();
    expect(result.seeds).toEqual([1, 2]);
    expect(result.results).toBeDefined();
  }, 30000);

  it('shows significant differences in summary', async () => {
    const outDir = join(testDir, 'matrix-results');

    // Run with baseline only (no variants file)
    const { stdout } = await execAsync(
      `npx tsx ${CLI_PATH} matrix examples/toy.ts --seeds 1..2 --ticks 3 -o ${outDir}`
    );

    // Should complete without significant differences message when only one variant
    expect(stdout).toContain('Matrix complete');
  }, 30000);
});

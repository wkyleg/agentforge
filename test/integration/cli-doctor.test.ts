import { exec } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execAsync = promisify(exec);
const CLI_PATH = join(process.cwd(), 'src', 'cli', 'index.ts');

describe('CLI: forge-sim doctor', () => {
  it('exits with code 0 when environment is valid', async () => {
    const { stdout } = await execAsync(`npx tsx ${CLI_PATH} doctor`);

    // Should contain Node.js check
    expect(stdout).toContain('Node.js');

    // Should indicate success for required components
    expect(stdout).toMatch(/✓.*Node\.js/);
  });

  it('outputs JSON when --json flag is provided', async () => {
    const { stdout } = await execAsync(`npx tsx ${CLI_PATH} doctor --json`);

    // Find the JSON array in output (may have other output before it)
    const jsonMatch = stdout.match(/\[[\s\S]*\]/);
    expect(jsonMatch).not.toBeNull();

    const results = JSON.parse(jsonMatch?.[0]);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);

    // Each result should have expected structure
    for (const result of results) {
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('message');
      expect(['ok', 'warn', 'error']).toContain(result.status);
    }
  });

  it('checks Node.js version', async () => {
    const { stdout } = await execAsync(`npx tsx ${CLI_PATH} doctor --json`);

    const jsonMatch = stdout.match(/\[[\s\S]*\]/);
    const results = JSON.parse(jsonMatch?.[0]);

    const nodeCheck = results.find((r: { name: string }) => r.name === 'Node.js');
    expect(nodeCheck).toBeDefined();
    expect(nodeCheck.status).toBe('ok');
    expect(nodeCheck.version).toBeDefined();
  });

  it('checks for package manager', async () => {
    const { stdout } = await execAsync(`npx tsx ${CLI_PATH} doctor --json`);

    const jsonMatch = stdout.match(/\[[\s\S]*\]/);
    const results = JSON.parse(jsonMatch?.[0]);

    // Should find either pnpm or npm
    const pmCheck = results.find((r: { name: string }) => r.name === 'pnpm' || r.name === 'npm');
    expect(pmCheck).toBeDefined();
    expect(pmCheck.status).toBe('ok');
  });

  it('checks filesystem access', async () => {
    const { stdout } = await execAsync(`npx tsx ${CLI_PATH} doctor --json`);

    const jsonMatch = stdout.match(/\[[\s\S]*\]/);
    const results = JSON.parse(jsonMatch?.[0]);

    const fsCheck = results.find((r: { name: string }) => r.name === 'Temp directory');
    expect(fsCheck).toBeDefined();
    expect(fsCheck.status).toBe('ok');
  });

  it('treats missing Foundry as warning (optional)', async () => {
    const { stdout } = await execAsync(`npx tsx ${CLI_PATH} doctor --json`);

    const jsonMatch = stdout.match(/\[[\s\S]*\]/);
    const results = JSON.parse(jsonMatch?.[0]);

    const foundryCheck = results.find((r: { name: string }) => r.name === 'Foundry');
    expect(foundryCheck).toBeDefined();
    // Should be 'ok' if installed, 'warn' if not
    expect(['ok', 'warn']).toContain(foundryCheck.status);
  });
});

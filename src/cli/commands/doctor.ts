import { exec } from 'node:child_process';
import { constants } from 'node:fs';
import { access, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Command } from 'commander';
import { output } from '../ui/output.js';

const execAsync = promisify(exec);

interface CheckResult {
  name: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
  version?: string;
}

/**
 * Doctor command - diagnose environment
 */
export const doctorCommand = new Command('doctor')
  .description('Check environment and dependencies')
  .option('--json', 'Output results as JSON')
  .action(async (options) => {
    const results: CheckResult[] = [];
    const jsonMode = options.json === true;

    if (!jsonMode) {
      output.header('AgentForge Environment Check');
      output.newline();
    }

    // Check Node.js version
    results.push(await checkNodeVersion(jsonMode));

    // Check npm/pnpm
    results.push(await checkPackageManager(jsonMode));

    // Check Foundry (optional)
    results.push(await checkFoundry(jsonMode));

    // Check Anvil (optional)
    results.push(await checkAnvil(jsonMode));

    // Check filesystem write access
    results.push(await checkFilesystem(jsonMode));

    if (jsonMode) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      output.newline();

      // Print summary
      const errors = results.filter((r) => r.status === 'error');
      const warnings = results.filter((r) => r.status === 'warn');

      if (errors.length === 0) {
        output.success('All required checks passed!');
        if (warnings.length > 0) {
          output.warn(`${warnings.length} optional component(s) not found`);
        }
      } else {
        output.error(`${errors.length} required check(s) failed`);
      }
    }

    // Exit with appropriate code
    const hasRequiredErrors = results.some((r) => r.status === 'error' && !isOptional(r.name));
    process.exit(hasRequiredErrors ? 1 : 0);
  });

async function checkNodeVersion(silent = false): Promise<CheckResult> {
  const version = process.version;
  const major = Number.parseInt(version.slice(1).split('.')[0] ?? '0', 10);

  if (major >= 18) {
    if (!silent) output.check('Node.js', 'ok', `${version} (>= 18.0.0 required)`);
    return { name: 'Node.js', status: 'ok', message: 'Version OK', version };
  }

  if (!silent) output.check('Node.js', 'error', `${version} (>= 18.0.0 required)`);
  return {
    name: 'Node.js',
    status: 'error',
    message: 'Version too old, need >= 18.0.0',
    version,
  };
}

async function checkPackageManager(silent = false): Promise<CheckResult> {
  // Check for pnpm first
  try {
    const { stdout } = await execAsync('pnpm --version');
    const version = stdout.trim();
    if (!silent) output.check('pnpm', 'ok', `v${version}`);
    return { name: 'pnpm', status: 'ok', message: 'Found', version };
  } catch {
    // pnpm not found, check npm
  }

  try {
    const { stdout } = await execAsync('npm --version');
    const version = stdout.trim();
    if (!silent) output.check('npm', 'ok', `v${version}`);
    return { name: 'npm', status: 'ok', message: 'Found', version };
  } catch {
    if (!silent) output.check('Package manager', 'error', 'Neither pnpm nor npm found');
    return {
      name: 'Package manager',
      status: 'error',
      message: 'Neither pnpm nor npm found',
    };
  }
}

async function checkFoundry(silent = false): Promise<CheckResult> {
  try {
    const { stdout } = await execAsync('forge --version');
    const version = stdout.trim().split('\n')[0] ?? 'unknown';
    if (!silent) output.check('Foundry (forge)', 'ok', version);
    return { name: 'Foundry', status: 'ok', message: 'Found', version };
  } catch {
    if (!silent) output.check('Foundry (forge)', 'warn', 'Not found (optional for Phase 1)');
    return {
      name: 'Foundry',
      status: 'warn',
      message: 'Not found (optional)',
    };
  }
}

async function checkAnvil(silent = false): Promise<CheckResult> {
  try {
    const { stdout } = await execAsync('anvil --version');
    const version = stdout.trim().split('\n')[0] ?? 'unknown';
    if (!silent) output.check('Anvil', 'ok', version);
    return { name: 'Anvil', status: 'ok', message: 'Found', version };
  } catch {
    if (!silent) output.check('Anvil', 'warn', 'Not found (optional for Phase 1)');
    return {
      name: 'Anvil',
      status: 'warn',
      message: 'Not found (optional)',
    };
  }
}

async function checkFilesystem(silent = false): Promise<CheckResult> {
  const testFile = join(tmpdir(), `agentforge-test-${Date.now()}.tmp`);

  try {
    await writeFile(testFile, 'test');
    await access(testFile, constants.R_OK | constants.W_OK);
    await unlink(testFile);

    if (!silent) output.check('Filesystem', 'ok', 'Write access OK');
    return { name: 'Filesystem', status: 'ok', message: 'Write access OK' };
  } catch {
    if (!silent) output.check('Filesystem', 'error', 'Cannot write to temp directory');
    return {
      name: 'Filesystem',
      status: 'error',
      message: 'Cannot write to temp directory',
    };
  }
}

function isOptional(name: string): boolean {
  return name === 'Foundry' || name === 'Anvil';
}

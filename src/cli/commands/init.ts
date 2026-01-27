import { constants, access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Command } from 'commander';
import { output } from '../ui/output.js';

/**
 * Init command - scaffold simulation folders
 */
export const initCommand = new Command('init')
  .description('Initialize simulation folder structure')
  .argument('[path]', 'Target directory (default: current directory)')
  .option('-f, --force', 'Overwrite existing files')
  .action(async (targetPath, options) => {
    const targetDir = resolve(targetPath ?? process.cwd());
    const simDir = join(targetDir, 'sim');

    output.header('Initializing AgentForge');
    output.info(`Target: ${targetDir}`);
    output.newline();

    try {
      // Create directory structure
      const directories = ['scenarios', 'agents', 'packs', 'metrics', 'results', 'generated'];

      for (const dir of directories) {
        const dirPath = join(simDir, dir);
        await mkdir(dirPath, { recursive: true });
        output.created(`sim/${dir}/`);
      }

      // Create README
      const readmePath = join(simDir, 'README.md');
      if (options.force || !(await fileExists(readmePath))) {
        await writeFile(readmePath, getReadmeContent());
        output.created('sim/README.md');
      } else {
        output.skipped('sim/README.md (already exists)');
      }

      // Create example scenario
      const examplePath = join(simDir, 'scenarios', 'example.ts');
      if (options.force || !(await fileExists(examplePath))) {
        await writeFile(examplePath, getExampleScenarioContent());
        output.created('sim/scenarios/example.ts');
      } else {
        output.skipped('sim/scenarios/example.ts (already exists)');
      }

      // Update .gitignore
      await updateGitignore(targetDir);

      output.newline();
      output.success('AgentForge initialized successfully!');
      output.newline();
      output.info('Next steps:');
      output.step('1', 'Edit sim/scenarios/example.ts to customize your scenario');
      output.step('2', 'Run: forge-sim run sim/scenarios/example.ts');
      output.step('3', 'Or run the toy scenario: forge-sim run --toy');
    } catch (error) {
      output.error(`Failed to initialize: ${error instanceof Error ? error.message : error}`);
      process.exit(2);
    }
  });

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function updateGitignore(targetDir: string): Promise<void> {
  const gitignorePath = join(targetDir, '.gitignore');
  const linesToAdd = ['sim/results/', 'sim/generated/'];

  try {
    let content = '';
    try {
      content = await readFile(gitignorePath, 'utf-8');
    } catch {
      // File doesn't exist, we'll create it
    }

    const existingLines = content.split('\n');
    const newLines: string[] = [];

    for (const line of linesToAdd) {
      if (!existingLines.some((l) => l.trim() === line)) {
        newLines.push(line);
      }
    }

    if (newLines.length > 0) {
      const addition = `\n# AgentForge simulation outputs\n${newLines.join('\n')}\n`;
      await writeFile(gitignorePath, content + addition);
      output.updated('.gitignore');
    } else {
      output.skipped('.gitignore (already configured)');
    }
  } catch (error) {
    output.warn(`Could not update .gitignore: ${error instanceof Error ? error.message : error}`);
  }
}

function getReadmeContent(): string {
  return `# Simulation Directory

This directory contains AgentForge simulation configurations.

## Structure

- \`scenarios/\` - Simulation scenario definitions
- \`agents/\` - Custom agent implementations
- \`packs/\` - Protocol-specific packs
- \`metrics/\` - Metric definitions
- \`results/\` - Simulation output (gitignored)
- \`generated/\` - Generated types (gitignored)

## Quick Start

1. Run the example scenario:
   \`\`\`bash
   forge-sim run sim/scenarios/example.ts
   \`\`\`

2. Or run the built-in toy scenario:
   \`\`\`bash
   forge-sim run --toy
   \`\`\`

## Results

Each simulation run produces:
- \`summary.json\` - Run metadata and final metrics
- \`metrics.csv\` - Time-series data
- \`actions.ndjson\` - All agent actions
- \`config_resolved.json\` - Resolved configuration

## Documentation

See https://github.com/wkyleg/agentforge for full documentation.
`;
}

function getExampleScenarioContent(): string {
  return `/**
 * Example simulation scenario
 *
 * This scenario demonstrates the basic structure of an AgentForge simulation.
 * Customize it for your protocol.
 */

import { defineScenario } from 'agentforge';
import {
  ToyPack,
  RandomTraderAgent,
  MomentumAgent,
  HolderAgent,
} from 'agentforge/toy';

export default defineScenario({
  name: 'example',
  seed: 42,
  ticks: 50,
  tickSeconds: 3600, // 1 hour per tick

  pack: new ToyPack({
    assets: [
      { name: 'TOKEN', initialPrice: 100, volatility: 0.05 },
    ],
    initialCash: 10000,
  }),

  agents: [
    {
      type: RandomTraderAgent,
      count: 5,
      params: {
        buyWeight: 0.3,
        sellWeight: 0.3,
        holdWeight: 0.4,
      },
    },
    {
      type: MomentumAgent,
      count: 2,
      params: {
        threshold: 2,
        tradePercent: 0.1,
      },
    },
    {
      type: HolderAgent,
      count: 3,
    },
  ],

  metrics: {
    sampleEveryTicks: 1,
  },

  assertions: [
    { type: 'gt', metric: 'totalVolume', value: 0 },
  ],
});
`;
}

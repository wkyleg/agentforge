#!/usr/bin/env node

import { createRequire } from 'node:module';
import { Command } from 'commander';
import { compareCommand } from './commands/compare.js';
import { doctorCommand } from './commands/doctor.js';
import { initCommand } from './commands/init.js';
import { matrixCommand } from './commands/matrix.js';
import { reportCommand } from './commands/report.js';
import { runCommand } from './commands/run.js';
import { sweepCommand } from './commands/sweep.js';
import { createTypesCommand } from './commands/types.js';

// Read version dynamically from package.json
const require = createRequire(import.meta.url);
const { version: VERSION } = require('../../package.json');

const program = new Command();

program
  .name('forge-sim')
  .description('AgentForge - Type-safe agent-based simulation for Foundry/EVM protocols')
  .version(VERSION);

// Add commands
program.addCommand(doctorCommand);
program.addCommand(initCommand);
program.addCommand(runCommand);
program.addCommand(reportCommand);
program.addCommand(compareCommand);
program.addCommand(sweepCommand);
program.addCommand(matrixCommand);
program.addCommand(createTypesCommand());

// Parse arguments
program.parse();

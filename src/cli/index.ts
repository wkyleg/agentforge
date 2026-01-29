#!/usr/bin/env node

import { createRequire } from 'node:module';
import { Command } from 'commander';
import { doctorCommand } from './commands/doctor.js';
import { initCommand } from './commands/init.js';
import { runCommand } from './commands/run.js';
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
program.addCommand(createTypesCommand());

// Parse arguments
program.parse();

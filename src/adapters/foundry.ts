/**
 * Foundry adapter - integrates with Foundry build tools
 *
 * Phase 2 will implement:
 * - Project detection (foundry.toml)
 * - Running forge build
 * - Parsing artifacts from out/
 * - Running forge script --broadcast
 * - Parsing broadcast/ for deployed addresses
 * - Type generation from ABIs
 */

import { exec } from 'node:child_process';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * Foundry project configuration
 */
export interface FoundryConfig {
  /** Project root directory */
  root: string;
  /** Source directory */
  src: string;
  /** Output directory */
  out: string;
  /** Lib directory */
  libs: string[];
  /** Remappings */
  remappings: string[];
}

/**
 * Contract artifact from forge build
 */
export interface ContractArtifact {
  /** Contract name */
  name: string;
  /** Source file path */
  sourcePath: string;
  /** ABI */
  abi: unknown[];
  /** Bytecode */
  bytecode: string;
  /** Deployed bytecode */
  deployedBytecode: string;
}

/**
 * Broadcast transaction record
 */
export interface BroadcastTransaction {
  /** Transaction hash */
  hash: string;
  /** Transaction type (CREATE, CALL) */
  transactionType: string;
  /** Contract name (for CREATE) */
  contractName?: string;
  /** Contract address (for CREATE) */
  contractAddress?: string;
  /** Function called (for CALL) */
  function?: string;
  /** Arguments */
  arguments?: unknown[];
}

/**
 * Check if we're in a Foundry project
 */
export async function isFoundryProject(dir: string = process.cwd()): Promise<boolean> {
  try {
    await access(join(dir, 'foundry.toml'), constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find the Foundry project root by walking up directories
 */
export async function findFoundryRoot(startDir: string = process.cwd()): Promise<string | null> {
  let currentDir = startDir;

  while (currentDir !== dirname(currentDir)) {
    if (await isFoundryProject(currentDir)) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }

  return null;
}

/**
 * Check if Foundry is installed
 */
export async function isFoundryInstalled(): Promise<boolean> {
  try {
    await execAsync('forge --version');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get Foundry version
 */
export async function getFoundryVersion(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('forge --version');
    return stdout.trim().split('\n')[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Parse foundry.toml configuration
 *
 * @stub Phase 2 implementation
 */
export async function parseFoundryConfig(_projectRoot: string): Promise<FoundryConfig> {
  // Phase 2: Implement TOML parsing
  throw new Error('Foundry config parsing not implemented in Phase 1');
}

/**
 * Run forge build
 *
 * @stub Phase 2 implementation
 */
export async function forgeBuild(_projectRoot: string): Promise<void> {
  // Phase 2: Implement build execution
  throw new Error('Forge build not implemented in Phase 1');
}

/**
 * Load contract artifact from out/ directory
 *
 * @stub Phase 2 implementation
 */
export async function loadArtifact(
  _projectRoot: string,
  _contractName: string
): Promise<ContractArtifact> {
  // Phase 2: Implement artifact loading
  throw new Error('Artifact loading not implemented in Phase 1');
}

/**
 * List all contract artifacts
 *
 * @stub Phase 2 implementation
 */
export async function listArtifacts(_projectRoot: string): Promise<string[]> {
  // Phase 2: Implement artifact listing
  throw new Error('Artifact listing not implemented in Phase 1');
}

/**
 * Run forge script with broadcast
 *
 * @stub Phase 2 implementation
 */
export async function forgeScript(
  _projectRoot: string,
  _scriptPath: string,
  _options?: {
    rpcUrl?: string;
    broadcast?: boolean;
    verify?: boolean;
  }
): Promise<void> {
  // Phase 2: Implement script execution
  throw new Error('Forge script not implemented in Phase 1');
}

/**
 * Parse broadcast file for deployed addresses
 *
 * @stub Phase 2 implementation
 */
export async function parseBroadcast(
  _projectRoot: string,
  _chainId: number,
  _scriptName: string
): Promise<BroadcastTransaction[]> {
  // Phase 2: Implement broadcast parsing
  throw new Error('Broadcast parsing not implemented in Phase 1');
}

/**
 * Extract deployed contract addresses from broadcast
 *
 * @stub Phase 2 implementation
 */
export async function getDeployedAddresses(
  _projectRoot: string,
  _chainId: number,
  _scriptName: string
): Promise<Map<string, string>> {
  // Phase 2: Implement address extraction
  throw new Error('Address extraction not implemented in Phase 1');
}

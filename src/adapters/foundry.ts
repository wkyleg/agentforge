/**
 * Foundry adapter - integrates with Foundry build tools
 *
 * Provides:
 * - Project detection (foundry.toml)
 * - Running forge build
 * - Parsing artifacts from out/
 * - Running forge script --broadcast
 * - Parsing broadcast/ for deployed addresses
 * - Type generation from ABIs
 */

import { exec } from 'node:child_process';
import { constants } from 'node:fs';
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * Foundry project configuration (parsed from foundry.toml)
 */
export interface FoundryConfig {
  /** Project root directory */
  root: string;
  /** Source directory (default: src) */
  src: string;
  /** Output directory (default: out) */
  out: string;
  /** Test directory (default: test) */
  test: string;
  /** Script directory (default: script) */
  script: string;
  /** Lib directories */
  libs: string[];
  /** Remappings */
  remappings: string[];
  /** Solidity version */
  solidityVersion?: string;
  /** Optimizer settings */
  optimizer?: {
    enabled: boolean;
    runs: number;
  };
  /** EVM version */
  evmVersion?: string;
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
  /** Bytecode (creation code) */
  bytecode: string;
  /** Deployed bytecode (runtime code) */
  deployedBytecode: string;
  /** Method identifiers (selector -> signature) */
  methodIdentifiers: Record<string, string> | undefined;
  /** Storage layout (if available) */
  storageLayout:
    | {
        storage: Array<{
          label: string;
          offset: number;
          slot: string;
          type: string;
        }>;
        types: Record<string, unknown>;
      }
    | undefined;
}

/**
 * Broadcast transaction record
 */
export interface BroadcastTransaction {
  /** Transaction hash */
  hash: string;
  /** Transaction type (CREATE, CREATE2, CALL) */
  transactionType: string;
  /** Contract name (for CREATE/CREATE2) */
  contractName: string | undefined;
  /** Contract address (for CREATE/CREATE2) */
  contractAddress: string | undefined;
  /** Function signature (for CALL) */
  function: string | undefined;
  /** Arguments */
  arguments: unknown[] | undefined;
  /** Gas used */
  gas: string | undefined;
  /** Value sent */
  value: string | undefined;
}

/**
 * Broadcast file structure
 */
interface BroadcastFile {
  transactions: Array<{
    hash: string;
    transactionType: string;
    contractName?: string;
    contractAddress?: string;
    function?: string;
    arguments?: unknown[];
    transaction: {
      gas?: string;
      value?: string;
    };
  }>;
  receipts?: Array<{
    transactionHash: string;
    contractAddress?: string;
    status: string;
  }>;
  timestamp?: number;
  chain?: number;
}

/**
 * Default Foundry configuration values
 */
export const DEFAULT_FOUNDRY_CONFIG: Omit<FoundryConfig, 'root'> = {
  src: 'src',
  out: 'out',
  test: 'test',
  script: 'script',
  libs: ['lib'],
  remappings: [],
};

/**
 * Check if we're in a Foundry project
 * @param dir - Directory to check (defaults to cwd)
 * @returns True if foundry.toml exists in the directory
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
 * @param startDir - Directory to start searching from
 * @returns Path to project root or null if not found
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
 * @returns True if forge is available in PATH
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
 * @returns The Foundry version string or null if not installed
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
 * Uses a simple parser since TOML libraries add dependencies
 * @param projectRoot - Path to the Foundry project root
 * @returns Parsed Foundry configuration
 */
export async function parseFoundryConfig(projectRoot: string): Promise<FoundryConfig> {
  const configPath = join(projectRoot, 'foundry.toml');

  let content: string;
  try {
    content = await readFile(configPath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read foundry.toml: ${(error as Error).message}`);
  }

  const config: FoundryConfig = {
    root: projectRoot,
    ...DEFAULT_FOUNDRY_CONFIG,
  };

  // Simple TOML parsing for common keys
  const lines = content.split('\n');
  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') {
      continue;
    }

    // Section header
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch?.[1]) {
      currentSection = sectionMatch[1];
      continue;
    }

    // Key-value pair
    const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (kvMatch && currentSection === 'profile.default') {
      const [, key, rawValue] = kvMatch;
      const value = parseTomlValue(rawValue ?? '');

      switch (key) {
        case 'src':
          if (typeof value === 'string') config.src = value;
          break;
        case 'out':
          if (typeof value === 'string') config.out = value;
          break;
        case 'test':
          if (typeof value === 'string') config.test = value;
          break;
        case 'script':
          if (typeof value === 'string') config.script = value;
          break;
        case 'libs':
          if (Array.isArray(value)) config.libs = value as string[];
          break;
        case 'remappings':
          if (Array.isArray(value)) config.remappings = value as string[];
          break;
        case 'solc_version':
        case 'solc':
          if (typeof value === 'string') config.solidityVersion = value;
          break;
        case 'evm_version':
          if (typeof value === 'string') config.evmVersion = value;
          break;
        case 'optimizer':
          if (typeof value === 'boolean') {
            config.optimizer = { enabled: value, runs: 200 };
          }
          break;
        case 'optimizer_runs':
          if (typeof value === 'number' && config.optimizer) {
            config.optimizer.runs = value;
          }
          break;
      }
    }
  }

  // Also try to read remappings.txt
  try {
    const remappingsPath = join(projectRoot, 'remappings.txt');
    const remappingsContent = await readFile(remappingsPath, 'utf-8');
    const remappings = remappingsContent
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    if (remappings.length > 0) {
      config.remappings = [...config.remappings, ...remappings];
    }
  } catch {
    // remappings.txt is optional
  }

  return config;
}

/**
 * Parse a simple TOML value
 */
function parseTomlValue(raw: string): string | number | boolean | string[] {
  const trimmed = raw.trim();

  // String (quoted)
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }

  // Boolean
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Array
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1);
    return inner
      .split(',')
      .map((item) => {
        const v = parseTomlValue(item.trim());
        return typeof v === 'string' ? v : String(v);
      })
      .filter((v) => v !== '');
  }

  // Number
  const num = Number(trimmed);
  if (!Number.isNaN(num)) return num;

  // Default to string
  return trimmed;
}

/**
 * Run forge build
 * @param projectRoot - Path to the Foundry project root
 * @param options - Build options
 * @returns Build result with success status and output
 */
export async function forgeBuild(
  projectRoot: string,
  options?: {
    /** Build only specific contracts */
    contracts?: string[];
    /** Extra arguments to pass to forge */
    extraArgs?: string[];
    /** Silent mode */
    silent?: boolean;
  }
): Promise<{ success: boolean; output: string }> {
  const args = ['forge', 'build'];

  if (options?.contracts && options.contracts.length > 0) {
    // Forge doesn't have a direct way to build specific contracts,
    // but we can use --match-path
    for (const contract of options.contracts) {
      args.push('--match-path', `*${contract}*`);
    }
  }

  if (options?.extraArgs) {
    args.push(...options.extraArgs);
  }

  try {
    const { stdout, stderr } = await execAsync(args.join(' '), {
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large projects
    });

    return {
      success: true,
      output: stdout + stderr,
    };
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; message: string };
    return {
      success: false,
      output: `${execError.stdout ?? ''}\n${execError.stderr ?? ''}\n${execError.message}`,
    };
  }
}

/**
 * Load contract artifact from out/ directory
 * @param projectRoot - Path to the Foundry project root
 * @param contractName - Name of the contract to load
 * @returns The contract artifact with ABI and bytecode
 * @throws Error if artifact not found
 */
export async function loadArtifact(
  projectRoot: string,
  contractName: string
): Promise<ContractArtifact> {
  const config = await parseFoundryConfig(projectRoot);
  const outDir = join(projectRoot, config.out);

  // Find the artifact file - it could be in a subdirectory
  const artifactPath = await findArtifactFile(outDir, contractName);

  if (!artifactPath) {
    throw new Error(
      `Artifact not found for contract "${contractName}". Run \`forge build\` first.`
    );
  }

  const content = await readFile(artifactPath, 'utf-8');
  const artifact = JSON.parse(content) as {
    abi?: unknown[];
    bytecode?: { object?: string };
    deployedBytecode?: { object?: string };
    methodIdentifiers?: Record<string, string>;
    storageLayout?: ContractArtifact['storageLayout'];
    ast?: { absolutePath?: string };
  };

  // Extract source path from AST or use file path
  const sourcePath =
    artifact.ast?.absolutePath ?? artifactPath.replace(outDir, '').replace(/\.json$/, '.sol');

  return {
    name: contractName,
    sourcePath,
    abi: artifact.abi ?? [],
    bytecode: artifact.bytecode?.object ?? '',
    deployedBytecode: artifact.deployedBytecode?.object ?? '',
    methodIdentifiers: artifact.methodIdentifiers,
    storageLayout: artifact.storageLayout,
  };
}

/**
 * Find artifact file in out directory
 */
async function findArtifactFile(outDir: string, contractName: string): Promise<string | null> {
  // First, try direct path: out/ContractName.sol/ContractName.json
  const directPath = join(outDir, `${contractName}.sol`, `${contractName}.json`);
  try {
    await access(directPath, constants.R_OK);
    return directPath;
  } catch {
    // Not found at direct path, search recursively
  }

  // Search recursively
  async function searchDir(dir: string): Promise<string | null> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          const found = await searchDir(fullPath);
          if (found) return found;
        } else if (
          entry.isFile() &&
          entry.name === `${contractName}.json` &&
          !entry.name.includes('.dbg.')
        ) {
          return fullPath;
        }
      }
    } catch {
      // Directory might not exist
    }

    return null;
  }

  return searchDir(outDir);
}

/**
 * List all contract artifacts in the out directory
 * @param projectRoot - Path to the Foundry project root
 * @returns Array of contract names with artifacts
 */
export async function listArtifacts(projectRoot: string): Promise<string[]> {
  const config = await parseFoundryConfig(projectRoot);
  const outDir = join(projectRoot, config.out);

  const artifacts: string[] = [];

  async function searchDir(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          await searchDir(fullPath);
        } else if (
          entry.isFile() &&
          entry.name.endsWith('.json') &&
          !entry.name.includes('.dbg.')
        ) {
          // Extract contract name from filename
          const contractName = entry.name.replace('.json', '');
          artifacts.push(contractName);
        }
      }
    } catch {
      // Directory might not exist
    }
  }

  await searchDir(outDir);

  // Remove duplicates (same contract in multiple directories)
  return [...new Set(artifacts)];
}

/**
 * Options for running forge script
 */
export interface ForgeScriptOptions {
  /** RPC URL to use */
  rpcUrl?: string;
  /** Broadcast transactions to the network */
  broadcast?: boolean;
  /** Verify contracts on Etherscan/Sourcify */
  verify?: boolean;
  /** Private key for signing (or use --unlocked) */
  privateKey?: string;
  /** Sender address (with --unlocked) */
  sender?: string;
  /** Use unlocked accounts (for Anvil) */
  unlocked?: boolean;
  /** Chain ID (for fork deployments) */
  chainId?: number;
  /** Fork URL */
  forkUrl?: string;
  /** Additional arguments */
  extraArgs?: string[];
  /** Silent mode */
  silent?: boolean;
  /** Gas limit */
  gasLimit?: bigint;
  /** Gas price */
  gasPrice?: bigint;
  /** Legacy transaction format */
  legacy?: boolean;
  /** Slow mode (wait for confirmations) */
  slow?: boolean;
  /** Resume from failed broadcast */
  resume?: boolean;
}

/**
 * Run forge script
 * @param projectRoot - Path to the Foundry project root
 * @param scriptPath - Path to the script file (relative to project)
 * @param options - Script execution options
 * @returns Execution result with success status and output
 */
export async function forgeScript(
  projectRoot: string,
  scriptPath: string,
  options?: ForgeScriptOptions
): Promise<{ success: boolean; output: string }> {
  const args = ['forge', 'script', scriptPath];

  if (options?.rpcUrl) {
    args.push('--rpc-url', options.rpcUrl);
  }

  if (options?.forkUrl) {
    args.push('--fork-url', options.forkUrl);
  }

  if (options?.broadcast) {
    args.push('--broadcast');
  }

  if (options?.verify) {
    args.push('--verify');
  }

  if (options?.privateKey) {
    args.push('--private-key', options.privateKey);
  }

  if (options?.sender) {
    args.push('--sender', options.sender);
  }

  if (options?.unlocked) {
    args.push('--unlocked');
  }

  if (options?.chainId !== undefined) {
    args.push('--chain-id', options.chainId.toString());
  }

  if (options?.gasLimit !== undefined) {
    args.push('--gas-limit', options.gasLimit.toString());
  }

  if (options?.gasPrice !== undefined) {
    args.push('--with-gas-price', options.gasPrice.toString());
  }

  if (options?.legacy) {
    args.push('--legacy');
  }

  if (options?.slow) {
    args.push('--slow');
  }

  if (options?.resume) {
    args.push('--resume');
  }

  if (options?.extraArgs) {
    args.push(...options.extraArgs);
  }

  // Build environment with PRIVATE_KEY if provided
  // Many forge scripts use vm.envUint("PRIVATE_KEY") to get the deployer key
  const env = { ...process.env };
  if (options?.privateKey) {
    env.PRIVATE_KEY = options.privateKey;
  }

  try {
    const { stdout, stderr } = await execAsync(args.join(' '), {
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024,
      env,
    });

    return {
      success: true,
      output: stdout + stderr,
    };
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; message: string };
    return {
      success: false,
      output: `${execError.stdout ?? ''}\n${execError.stderr ?? ''}\n${execError.message}`,
    };
  }
}

/**
 * Parse broadcast file for deployed addresses and transactions
 * @param projectRoot - Path to the Foundry project root
 * @param chainId - Chain ID the script was run on
 * @param scriptName - Name of the script (without .s.sol)
 * @returns Array of broadcast transactions
 * @throws Error if broadcast file not found
 */
export async function parseBroadcast(
  projectRoot: string,
  chainId: number,
  scriptName: string
): Promise<BroadcastTransaction[]> {
  // Find broadcast file: broadcast/ScriptName.s.sol/chainId/run-latest.json
  const broadcastDir = join(projectRoot, 'broadcast');
  const scriptDir = join(broadcastDir, `${scriptName}.s.sol`, chainId.toString());

  // Try run-latest.json first
  let broadcastPath = join(scriptDir, 'run-latest.json');

  try {
    await access(broadcastPath, constants.R_OK);
  } catch {
    // Try without .s.sol suffix
    const altScriptDir = join(broadcastDir, scriptName, chainId.toString());
    broadcastPath = join(altScriptDir, 'run-latest.json');

    try {
      await access(broadcastPath, constants.R_OK);
    } catch {
      throw new Error(
        `Broadcast file not found for script "${scriptName}" on chain ${chainId}. ` +
          `Expected at: ${scriptDir}/run-latest.json`
      );
    }
  }

  const content = await readFile(broadcastPath, 'utf-8');
  const broadcast = JSON.parse(content) as BroadcastFile;

  return broadcast.transactions.map((tx) => ({
    hash: tx.hash,
    transactionType: tx.transactionType,
    contractName: tx.contractName,
    contractAddress: tx.contractAddress,
    function: tx.function,
    arguments: tx.arguments,
    gas: tx.transaction?.gas,
    value: tx.transaction?.value,
  }));
}

/**
 * Extract deployed contract addresses from broadcast
 * @param projectRoot - Path to the Foundry project root
 * @param chainId - Chain ID the script was run on
 * @param scriptName - Name of the script (without .s.sol)
 * @returns Map of contract name to deployed address
 */
export async function getDeployedAddresses(
  projectRoot: string,
  chainId: number,
  scriptName: string
): Promise<Map<string, string>> {
  const transactions = await parseBroadcast(projectRoot, chainId, scriptName);
  const addresses = new Map<string, string>();

  for (const tx of transactions) {
    if (
      (tx.transactionType === 'CREATE' || tx.transactionType === 'CREATE2') &&
      tx.contractName &&
      tx.contractAddress
    ) {
      addresses.set(tx.contractName, tx.contractAddress);
    }
  }

  return addresses;
}

/**
 * Get all deployed addresses from all run files in broadcast directory
 * @param projectRoot - Path to the Foundry project root
 * @param chainId - Chain ID to filter broadcasts
 * @returns Map of contract name to deployed address
 */
export async function getAllDeployedAddresses(
  projectRoot: string,
  chainId: number
): Promise<Map<string, string>> {
  const broadcastDir = join(projectRoot, 'broadcast');
  const addresses = new Map<string, string>();

  async function searchBroadcasts(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          // Check if this is the chain ID directory
          if (entry.name === chainId.toString()) {
            // Look for run-latest.json in this directory
            const runLatest = join(fullPath, 'run-latest.json');
            try {
              const content = await readFile(runLatest, 'utf-8');
              const broadcast = JSON.parse(content) as BroadcastFile;

              for (const tx of broadcast.transactions) {
                if (
                  (tx.transactionType === 'CREATE' || tx.transactionType === 'CREATE2') &&
                  tx.contractName &&
                  tx.contractAddress
                ) {
                  addresses.set(tx.contractName, tx.contractAddress);
                }
              }
            } catch {
              // File not found or parse error, continue
            }
          } else {
            await searchBroadcasts(fullPath);
          }
        }
      }
    } catch {
      // Directory might not exist
    }
  }

  await searchBroadcasts(broadcastDir);
  return addresses;
}

/**
 * Load multiple artifacts at once
 * @param projectRoot - Path to the Foundry project root
 * @param contractNames - Names of contracts to load
 * @returns Map of contract name to artifact
 */
export async function loadArtifacts(
  projectRoot: string,
  contractNames: string[]
): Promise<Map<string, ContractArtifact>> {
  const artifacts = new Map<string, ContractArtifact>();

  await Promise.all(
    contractNames.map(async (name) => {
      try {
        const artifact = await loadArtifact(projectRoot, name);
        artifacts.set(name, artifact);
      } catch (error) {
        // Skip contracts that don't exist
        console.warn(`Warning: Could not load artifact for ${name}: ${(error as Error).message}`);
      }
    })
  );

  return artifacts;
}

/**
 * Clean build artifacts
 * @param projectRoot - Path to the Foundry project root
 */
export async function forgeClean(projectRoot: string): Promise<void> {
  await execAsync('forge clean', { cwd: projectRoot });
}

/**
 * Run forge test
 * @param projectRoot - Path to the Foundry project root
 * @param options - Test options
 * @returns Test result with success status and output
 */
export async function forgeTest(
  projectRoot: string,
  options?: {
    match?: string;
    matchContract?: string;
    matchTest?: string;
    verbosity?: number;
    gas?: boolean;
    fuzz?: { runs?: number; seed?: number };
  }
): Promise<{ success: boolean; output: string }> {
  const args = ['forge', 'test'];

  if (options?.match) {
    args.push('--match', options.match);
  }

  if (options?.matchContract) {
    args.push('--match-contract', options.matchContract);
  }

  if (options?.matchTest) {
    args.push('--match-test', options.matchTest);
  }

  if (options?.verbosity) {
    args.push(`-${'v'.repeat(options.verbosity)}`);
  }

  if (options?.gas) {
    args.push('--gas-report');
  }

  if (options?.fuzz?.runs) {
    args.push('--fuzz-runs', options.fuzz.runs.toString());
  }

  if (options?.fuzz?.seed) {
    args.push('--fuzz-seed', options.fuzz.seed.toString());
  }

  try {
    const { stdout, stderr } = await execAsync(args.join(' '), {
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024,
    });

    return {
      success: true,
      output: stdout + stderr,
    };
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; message: string };
    return {
      success: false,
      output: `${execError.stdout ?? ''}\n${execError.stderr ?? ''}\n${execError.message}`,
    };
  }
}

/**
 * Generate TypeScript types from contract ABIs
 * @param projectRoot - Path to the Foundry project root
 * @param contractNames - Names of contracts to generate types for
 * @param outputDir - Directory to write generated type files
 */
export async function generateTypes(
  projectRoot: string,
  contractNames: string[],
  outputDir: string
): Promise<void> {
  const { mkdir, writeFile: fsWriteFile } = await import('node:fs/promises');

  await mkdir(outputDir, { recursive: true });

  for (const name of contractNames) {
    try {
      const artifact = await loadArtifact(projectRoot, name);

      const content = `// Generated by AgentForge - DO NOT EDIT
// Source: ${artifact.sourcePath}

export const ${name}Abi = ${JSON.stringify(artifact.abi, null, 2)} as const;

export type ${name}Abi = typeof ${name}Abi;
`;

      await fsWriteFile(join(outputDir, `${name}.ts`), content);
    } catch (error) {
      console.warn(`Warning: Could not generate types for ${name}: ${(error as Error).message}`);
    }
  }

  // Generate index file
  const exports = contractNames.map((name) => `export * from './${name}.js';`);
  const indexContent = `// Generated by AgentForge - DO NOT EDIT

${exports.join('\n')}
`;

  await fsWriteFile(join(outputDir, 'index.ts'), indexContent);
}

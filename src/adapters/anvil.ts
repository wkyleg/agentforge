/**
 * Anvil adapter - manages local Ethereum development node
 *
 * Phase 2 will implement:
 * - Spawning Anvil as a subprocess
 * - Time manipulation (evm_increaseTime, evm_mine)
 * - State snapshots (evm_snapshot, evm_revert)
 * - Balance manipulation (anvil_setBalance)
 * - Account impersonation (anvil_impersonateAccount)
 */

import { type ChildProcess, exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * Anvil configuration options
 */
export interface AnvilConfig {
  /** Port to run on (default: 8545) */
  port?: number;
  /** Chain ID (default: 31337) */
  chainId?: number;
  /** Block time in seconds (0 = instant mining) */
  blockTime?: number;
  /** Fork URL for mainnet forking */
  forkUrl?: string;
  /** Fork block number */
  forkBlockNumber?: number;
  /** Number of accounts to generate */
  accounts?: number;
  /** Initial balance per account */
  balance?: bigint;
  /** Mnemonic for account generation */
  mnemonic?: string;
  /** Enable auto-impersonation */
  autoImpersonate?: boolean;
}

/**
 * Anvil instance state
 */
export interface AnvilInstance {
  /** Process handle */
  process: ChildProcess | null;
  /** RPC URL */
  url: string;
  /** Chain ID */
  chainId: number;
  /** Generated accounts */
  accounts: string[];
  /** Whether instance is running */
  running: boolean;
}

/**
 * Default Anvil configuration
 */
export const DEFAULT_ANVIL_CONFIG: Required<
  Omit<AnvilConfig, 'forkUrl' | 'forkBlockNumber' | 'mnemonic'>
> = {
  port: 8545,
  chainId: 31337,
  blockTime: 0,
  accounts: 10,
  balance: 10000n * 10n ** 18n, // 10000 ETH
  autoImpersonate: false,
};

/**
 * Check if Anvil is installed
 */
export async function isAnvilInstalled(): Promise<boolean> {
  try {
    await execAsync('anvil --version');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get Anvil version
 */
export async function getAnvilVersion(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('anvil --version');
    return stdout.trim().split('\n')[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Spawn an Anvil instance
 *
 * @stub Phase 2 implementation
 */
export async function spawnAnvil(_config: AnvilConfig = {}): Promise<AnvilInstance> {
  // Phase 2: Implement actual spawning
  throw new Error('Anvil spawning not implemented in Phase 1');
}

/**
 * Stop an Anvil instance
 *
 * @stub Phase 2 implementation
 */
export async function stopAnvil(_instance: AnvilInstance): Promise<void> {
  // Phase 2: Implement graceful shutdown
  throw new Error('Anvil stopping not implemented in Phase 1');
}

/**
 * Anvil RPC helper methods
 *
 * @stub Phase 2 implementation
 */
export const anvilRpc = {
  /**
   * Increase EVM time
   */
  async increaseTime(_url: string, _seconds: number): Promise<void> {
    throw new Error('Not implemented in Phase 1');
  },

  /**
   * Mine a block
   */
  async mine(_url: string, _blocks?: number): Promise<void> {
    throw new Error('Not implemented in Phase 1');
  },

  /**
   * Take a state snapshot
   */
  async snapshot(_url: string): Promise<string> {
    throw new Error('Not implemented in Phase 1');
  },

  /**
   * Revert to a snapshot
   */
  async revert(_url: string, _snapshotId: string): Promise<void> {
    throw new Error('Not implemented in Phase 1');
  },

  /**
   * Set account balance
   */
  async setBalance(_url: string, _address: string, _balance: bigint): Promise<void> {
    throw new Error('Not implemented in Phase 1');
  },

  /**
   * Impersonate an account
   */
  async impersonateAccount(_url: string, _address: string): Promise<void> {
    throw new Error('Not implemented in Phase 1');
  },

  /**
   * Stop impersonating an account
   */
  async stopImpersonatingAccount(_url: string, _address: string): Promise<void> {
    throw new Error('Not implemented in Phase 1');
  },
};

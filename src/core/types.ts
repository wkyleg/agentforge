import type { Logger } from 'pino';
import type { Rng } from './rng.js';

/**
 * Represents an action that an agent wants to take
 */
export interface Action {
  /** Unique identifier for this action instance */
  id: string;
  /** Action type name (e.g., 'buy', 'sell', 'stake') */
  name: string;
  /** Action-specific parameters */
  params: Record<string, unknown>;
  /** Optional metadata about the action */
  metadata?: Record<string, unknown>;
}

/**
 * Result of executing an action
 */
export interface ActionResult {
  /** Whether the action succeeded */
  ok: boolean;
  /** Error message if action failed */
  error?: string;
  /** Events emitted during action execution */
  events?: ActionEvent[];
  /** Balance changes resulting from the action */
  balanceDeltas?: Record<string, bigint>;
  /** Gas used (for on-chain actions) */
  gasUsed?: bigint;
  /** Transaction hash (for on-chain actions) */
  txHash?: string;
}

/**
 * An event emitted during action execution
 * Used to track contract events, state changes, or other side effects
 */
export interface ActionEvent {
  /** Event name (e.g., 'Transfer', 'Approval') */
  name: string;
  /** Event arguments/parameters */
  args: Record<string, unknown>;
}

/**
 * Context provided to agents during each tick
 */
export interface TickContext {
  /** Current tick number (0-indexed) */
  tick: number;
  /** Simulated timestamp for this tick */
  timestamp: number;
  /** Seeded RNG bound to this tick */
  rng: Rng;
  /** Structured logger */
  logger: Logger;
  /** The pack providing world state and action execution */
  pack: Pack;
  /** Read-only world state snapshot */
  world: WorldState;
}

/**
 * World state provided by a pack
 */
export interface WorldState {
  /** Current simulated timestamp */
  timestamp: number;
  /** Protocol-specific state */
  [key: string]: unknown;
}

/**
 * Hex address type (0x-prefixed string)
 */
export type Address = `0x${string}`;

/**
 * Configuration for funding agents with tokens
 * Projects implement this to define how agents receive initial balances
 *
 * This interface is protocol-agnostic - each project defines their own
 * token address and funding method based on their protocol's requirements.
 *
 * @example
 * // Transfer from treasury (most common)
 * const funding: FundingConfig = {
 *   tokenAddress: '0x...',
 *   amountPerAgent: parseEther('10000'),
 *   method: 'transfer',
 *   treasuryAddress: '0x...',
 * };
 *
 * @example
 * // Mint tokens (if protocol allows)
 * const funding: FundingConfig = {
 *   tokenAddress: '0x...',
 *   amountPerAgent: parseEther('10000'),
 *   method: 'mint',
 * };
 *
 * @example
 * // Custom funding logic
 * const funding: FundingConfig = {
 *   amountPerAgent: parseEther('10000'),
 *   method: 'custom',
 *   customFunder: async (toAddress, amount, wallet) => {
 *     // Custom implementation
 *   },
 * };
 */
export interface FundingConfig {
  /** Token address to fund agents with (project-specific) */
  tokenAddress?: Address;

  /** Amount per agent (in token's smallest unit, e.g., wei) */
  amountPerAgent: bigint;

  /** Funding method: 'transfer' from treasury, 'mint' if allowed, or 'custom' */
  method: 'transfer' | 'mint' | 'custom';

  /** For 'transfer': address holding tokens to distribute */
  treasuryAddress?: Address;

  /**
   * For 'custom': project provides implementation
   * @param toAddress - Address to fund
   * @param amount - Amount to fund
   * @param deployerWallet - Wallet client for the deployer (for signing transactions)
   */
  customFunder?: (
    toAddress: Address,
    amount: bigint,
    deployerWallet: unknown
  ) => Promise<void>;
}

/**
 * A Pack provides protocol-specific bindings
 */
export interface Pack {
  /** Pack name */
  name: string;

  /** Initialize the pack (deploy contracts, set up state) */
  initialize(): Promise<void>;

  /** Called at the start of each tick to update state */
  onTick?(tick: number, timestamp: number): void;

  /** Set the current agent context for world state queries */
  setCurrentAgent?(agentId: string): void;

  /** Get current world state */
  getWorldState(): WorldState;

  /** Execute an action and return the result */
  executeAction(action: Action, agentId: string): Promise<ActionResult>;

  /** Get metrics for the current state */
  getMetrics(): Record<string, number | bigint | string>;

  /** Clean up resources */
  cleanup(): Promise<void>;

  /**
   * Register an agent and optionally fund them
   * Returns the agent's wallet address
   *
   * Projects implement this to:
   * 1. Create a wallet for the agent (from HD derivation or Anvil accounts)
   * 2. Fund the agent with native currency (ETH) if needed
   * 3. Fund the agent with protocol tokens using fundAgent()
   *
   * @param agentId - Unique identifier for the agent
   * @returns The agent's wallet address
   */
  registerAgent?(agentId: string): Promise<Address>;

  /**
   * Fund an agent with project-specific tokens
   * Projects implement this based on their FundingConfig
   *
   * This method is protocol-agnostic - each project defines what "funding" means
   * for their protocol (e.g., ELTA for Elata, DAI for MakerDAO, etc.)
   *
   * @param agentId - Unique identifier for the agent
   * @param config - Funding configuration (token, amount, method)
   */
  fundAgent?(agentId: string, config: FundingConfig): Promise<void>;
}

/**
 * Scenario configuration
 */
export interface Scenario {
  /** Scenario name */
  name: string;
  /** Random seed for deterministic runs */
  seed: number;
  /** Number of ticks to simulate */
  ticks: number;
  /** Simulated seconds per tick */
  tickSeconds: number;
  /** Pack to use for the simulation */
  pack: Pack;
  /** Agents participating in the simulation */
  agents: AgentConfig[];
  /** Metrics configuration */
  metrics?: MetricsConfig;
  /** Optional assertions to validate at the end */
  assertions?: Assertion[];
}

/**
 * Agent configuration within a scenario
 */
export interface AgentConfig {
  /** Agent class/constructor */
  type: new (
    id: string,
    params?: Record<string, unknown>
  ) => import('./agent.js').BaseAgent;
  /** Number of agents of this type to create */
  count: number;
  /** Parameters to pass to agent constructor */
  params?: Record<string, unknown>;
}

/**
 * Metrics collection configuration
 */
export interface MetricsConfig {
  /** Sample metrics every N ticks */
  sampleEveryTicks: number;
  /** Specific metrics to track */
  track?: string[];
}

/**
 * An assertion to validate at the end of a run
 */
export interface Assertion {
  /** Assertion type */
  type: 'gte' | 'lte' | 'eq' | 'gt' | 'lt' | 'neq';
  /** Metric name to check */
  metric: string;
  /** Expected value */
  value: number | string;
  /** Optional custom message for the assertion */
  message?: string;
}

/**
 * Options for running a scenario
 */
export interface RunOptions {
  /** Override seed from scenario */
  seed?: number;
  /** Override ticks from scenario */
  ticks?: number;
  /** Override tick seconds from scenario */
  tickSeconds?: number;
  /** Output directory for artifacts */
  outDir?: string;
  /** CI mode (no colors, strict exit codes) */
  ci?: boolean;
  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Result of a simulation run
 */
export interface RunResult {
  /** Run identifier */
  runId: string;
  /** Scenario name */
  scenarioName: string;
  /** Seed used */
  seed: number;
  /** Number of ticks executed */
  ticks: number;
  /** Total duration in milliseconds */
  durationMs: number;
  /** Whether all assertions passed */
  success: boolean;
  /** Failed assertions */
  failedAssertions: FailedAssertion[];
  /** Final metrics snapshot */
  finalMetrics: Record<string, number | bigint | string>;
  /** Per-agent statistics */
  agentStats: AgentStats[];
  /** Path to output directory */
  outputDir: string;
}

/**
 * A failed assertion
 */
export interface FailedAssertion {
  assertion: Assertion;
  actualValue: number | string;
  message: string;
}

/**
 * Statistics for a single agent
 */
export interface AgentStats {
  id: string;
  type: string;
  actionsAttempted: number;
  actionsSucceeded: number;
  actionsFailed: number;
}

/**
 * Recorded action for logging
 */
export interface RecordedAction {
  tick: number;
  timestamp: number;
  agentId: string;
  agentType: string;
  action: Action | null;
  result: ActionResult | null;
  durationMs: number;
}

/**
 * Metrics sample at a point in time
 */
export interface MetricsSample {
  tick: number;
  timestamp: number;
  metrics: Record<string, number | bigint | string>;
}

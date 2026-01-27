import type { Action, AgentStats, TickContext } from './types.js';

/**
 * Agent memory for persistent state between ticks
 */
export interface AgentMemory {
  /** Arbitrary key-value storage */
  [key: string]: unknown;
}

/**
 * Extended agent statistics including memory and cooldowns
 */
export interface ExtendedAgentStats extends AgentStats {
  /** Current memory state (keys only for privacy) */
  memoryKeys: string[];
  /** Active cooldowns */
  activeCooldowns: Array<{ action: string; until: number }>;
}

/**
 * Base class for all simulation agents
 *
 * Agents are autonomous entities that participate in a simulation.
 * Each tick, an agent observes the world state and decides on an action.
 */
export abstract class BaseAgent {
  /** Unique identifier for this agent */
  readonly id: string;

  /** Agent type name (class name by default) */
  readonly type: string;

  /** Agent-specific parameters */
  protected params: Record<string, unknown>;

  /** Persistent memory across ticks */
  protected memory: AgentMemory = {};

  /** Action cooldowns: action name -> tick when available */
  protected cooldowns: Map<string, number> = new Map();

  /** Internal statistics */
  private _actionsAttempted = 0;
  private _actionsSucceeded = 0;
  private _actionsFailed = 0;

  /** Last tick the agent was executed */
  private _lastTick = -1;

  constructor(id: string, params: Record<string, unknown> = {}) {
    this.id = id;
    this.type = this.constructor.name;
    this.params = params;
  }

  /**
   * Called each tick to determine the agent's action
   *
   * @param ctx - The tick context with world state, RNG, and logger
   * @returns The action to take, or null to skip this tick
   */
  abstract step(ctx: TickContext): Promise<Action | null>;

  /**
   * Called when the agent is initialized at the start of a simulation
   * Override to perform setup logic
   */
  async initialize(_ctx: TickContext): Promise<void> {
    // Default: no-op
  }

  /**
   * Called when the simulation ends
   * Override to perform cleanup logic
   */
  async cleanup(): Promise<void> {
    // Default: no-op
  }

  /**
   * Record a successful action
   * @internal
   */
  recordSuccess(): void {
    this._actionsAttempted++;
    this._actionsSucceeded++;
  }

  /**
   * Record a failed action
   * @internal
   */
  recordFailure(): void {
    this._actionsAttempted++;
    this._actionsFailed++;
  }

  /**
   * Record a skipped tick (no action)
   * @internal
   */
  recordSkip(): void {
    // No action taken, don't count as attempted
  }

  /**
   * Get agent statistics
   */
  getStats(): AgentStats {
    return {
      id: this.id,
      type: this.type,
      actionsAttempted: this._actionsAttempted,
      actionsSucceeded: this._actionsSucceeded,
      actionsFailed: this._actionsFailed,
    };
  }

  /**
   * Get extended agent statistics including memory and cooldowns
   */
  getExtendedStats(): ExtendedAgentStats {
    return {
      ...this.getStats(),
      memoryKeys: Object.keys(this.memory),
      activeCooldowns: Array.from(this.cooldowns.entries()).map(([action, until]) => ({
        action,
        until,
      })),
    };
  }

  /**
   * Get a parameter value with type safety
   */
  protected getParam<T>(key: string, defaultValue: T): T {
    const value = this.params[key];
    if (value === undefined) {
      return defaultValue;
    }
    return value as T;
  }

  /**
   * Generate a unique action ID
   */
  protected generateActionId(actionName: string, tick: number): string {
    return `${this.id}-${actionName}-${tick}-${Date.now()}`;
  }

  // Memory management

  /**
   * Store a value in agent memory
   */
  protected remember<T>(key: string, value: T): void {
    this.memory[key] = value;
  }

  /**
   * Retrieve a value from agent memory
   */
  protected recall<T>(key: string, defaultValue?: T): T | undefined {
    const value = this.memory[key];
    if (value === undefined) {
      return defaultValue;
    }
    return value as T;
  }

  /**
   * Check if a key exists in memory
   */
  protected hasMemory(key: string): boolean {
    return key in this.memory;
  }

  /**
   * Remove a value from memory
   */
  protected forget(key: string): void {
    delete this.memory[key];
  }

  /**
   * Clear all memory
   */
  protected clearMemory(): void {
    this.memory = {};
  }

  // Cooldown management

  /**
   * Set a cooldown for an action
   * @param actionName - The action to put on cooldown
   * @param ticks - Number of ticks until the action is available
   * @param currentTick - The current tick number
   */
  protected setCooldown(actionName: string, ticks: number, currentTick: number): void {
    this.cooldowns.set(actionName, currentTick + ticks);
  }

  /**
   * Check if an action is on cooldown
   * @param actionName - The action to check
   * @param currentTick - The current tick number
   * @returns true if the action is on cooldown
   */
  protected isOnCooldown(actionName: string, currentTick: number): boolean {
    const cooldownUntil = this.cooldowns.get(actionName);
    return cooldownUntil !== undefined && currentTick < cooldownUntil;
  }

  /**
   * Get remaining cooldown ticks for an action
   * @param actionName - The action to check
   * @param currentTick - The current tick number
   * @returns Number of ticks remaining, or 0 if not on cooldown
   */
  protected getCooldownRemaining(actionName: string, currentTick: number): number {
    const cooldownUntil = this.cooldowns.get(actionName);
    if (cooldownUntil === undefined || currentTick >= cooldownUntil) {
      return 0;
    }
    return cooldownUntil - currentTick;
  }

  /**
   * Clear a specific cooldown
   */
  protected clearCooldown(actionName: string): void {
    this.cooldowns.delete(actionName);
  }

  /**
   * Clear all cooldowns
   */
  protected clearAllCooldowns(): void {
    this.cooldowns.clear();
  }

  /**
   * Get all available actions (not on cooldown)
   * @param actions - List of action names to check
   * @param currentTick - The current tick number
   * @returns Actions that are available (not on cooldown)
   */
  protected getAvailableActions(actions: string[], currentTick: number): string[] {
    return actions.filter((action) => !this.isOnCooldown(action, currentTick));
  }

  // Tick tracking

  /**
   * Get the last tick this agent was executed
   */
  getLastTick(): number {
    return this._lastTick;
  }

  /**
   * Update the last tick (called by engine)
   * @internal
   */
  setLastTick(tick: number): void {
    this._lastTick = tick;
  }

  /**
   * Get number of ticks since last execution
   */
  protected getTicksSinceLastExecution(currentTick: number): number {
    if (this._lastTick < 0) {
      return currentTick;
    }
    return currentTick - this._lastTick;
  }
}

/**
 * A simple agent that does nothing (useful for testing)
 */
export class NoOpAgent extends BaseAgent {
  async step(_ctx: TickContext): Promise<Action | null> {
    return null;
  }
}

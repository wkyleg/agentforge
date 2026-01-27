import type { Action, ActionResult, Pack, WorldState } from '../../src/core/types.js';

/**
 * Configuration options for MockPack
 */
export interface MockPackConfig {
  /** Pack name */
  name?: string;
  /** Initial world state */
  initialState?: Record<string, unknown>;
  /** Initial metrics */
  initialMetrics?: Record<string, number | bigint | string>;
  /** Custom action handler */
  actionHandler?: (action: Action, agentId: string) => Promise<ActionResult>;
  /** Whether to fail initialization */
  failInitialize?: boolean;
  /** Whether to fail cleanup */
  failCleanup?: boolean;
}

/**
 * Mock Pack implementation for testing
 */
export class MockPack implements Pack {
  readonly name: string;

  private state: Record<string, unknown>;
  private metrics: Record<string, number | bigint | string>;
  private currentAgentId: string | null = null;
  private actionHandler?: (action: Action, agentId: string) => Promise<ActionResult>;
  private failInitialize: boolean;
  private failCleanup: boolean;
  private tick = 0;
  private timestamp = 0;

  /** Track all actions executed */
  readonly executedActions: Array<{ action: Action; agentId: string }> = [];

  /** Track all tick advances */
  readonly tickHistory: Array<{ tick: number; timestamp: number }> = [];

  /** Track initialization/cleanup calls */
  initializeCalled = false;
  cleanupCalled = false;

  constructor(config: MockPackConfig = {}) {
    this.name = config.name ?? 'mock-pack';
    this.state = { ...config.initialState };
    this.metrics = { ...config.initialMetrics };
    this.actionHandler = config.actionHandler;
    this.failInitialize = config.failInitialize ?? false;
    this.failCleanup = config.failCleanup ?? false;
  }

  async initialize(): Promise<void> {
    if (this.failInitialize) {
      throw new Error('MockPack initialization failed');
    }
    this.initializeCalled = true;
  }

  onTick(tick: number, timestamp: number): void {
    this.tick = tick;
    this.timestamp = timestamp;
    this.tickHistory.push({ tick, timestamp });
  }

  setCurrentAgent(agentId: string): void {
    this.currentAgentId = agentId;
  }

  getWorldState(): WorldState {
    return {
      timestamp: this.timestamp,
      tick: this.tick,
      currentAgent: this.currentAgentId,
      ...this.state,
    };
  }

  async executeAction(action: Action, agentId: string): Promise<ActionResult> {
    this.executedActions.push({ action, agentId });

    if (this.actionHandler) {
      return this.actionHandler(action, agentId);
    }

    // Default: always succeed
    return {
      ok: true,
      events: [{ name: action.name, args: action.params }],
    };
  }

  getMetrics(): Record<string, number | bigint | string> {
    return {
      tick: this.tick,
      timestamp: this.timestamp,
      actionsExecuted: this.executedActions.length,
      ...this.metrics,
    };
  }

  async cleanup(): Promise<void> {
    if (this.failCleanup) {
      throw new Error('MockPack cleanup failed');
    }
    this.cleanupCalled = true;
  }

  // Test helpers

  /**
   * Update the internal state
   */
  setState(newState: Record<string, unknown>): void {
    this.state = { ...this.state, ...newState };
  }

  /**
   * Update the internal metrics
   */
  setMetrics(newMetrics: Record<string, number | bigint | string>): void {
    this.metrics = { ...this.metrics, ...newMetrics };
  }

  /**
   * Reset the mock to initial state
   */
  reset(config: MockPackConfig = {}): void {
    this.state = { ...config.initialState };
    this.metrics = { ...config.initialMetrics };
    this.currentAgentId = null;
    this.tick = 0;
    this.timestamp = 0;
    this.executedActions.length = 0;
    this.tickHistory.length = 0;
    this.initializeCalled = false;
    this.cleanupCalled = false;
  }
}

/**
 * Create a mock pack with default configuration
 */
export function createMockPack(config: MockPackConfig = {}): MockPack {
  return new MockPack(config);
}

/**
 * Create a mock pack that fails all actions
 */
export function createFailingPack(errorMessage = 'Action failed'): MockPack {
  return new MockPack({
    name: 'failing-pack',
    actionHandler: async () => ({
      ok: false,
      error: errorMessage,
    }),
  });
}

/**
 * Create a mock pack with configurable action results
 */
export function createConfigurablePack(actionResults: Map<string, ActionResult>): MockPack {
  return new MockPack({
    name: 'configurable-pack',
    actionHandler: async (action) => {
      const result = actionResults.get(action.name);
      return result ?? { ok: true };
    },
  });
}

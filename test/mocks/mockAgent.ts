import { BaseAgent } from '../../src/core/agent.js';
import type { Action, TickContext } from '../../src/core/types.js';

/**
 * Configuration for MockAgent behavior
 */
export interface MockAgentConfig {
  /** Action to return each tick (null = skip) */
  action?: Action | null;
  /** Function to generate action based on tick */
  actionFn?: (ctx: TickContext) => Action | null;
  /** Probability of returning an action (0-1) */
  actionProbability?: number;
  /** Whether to throw on step */
  throwOnStep?: boolean;
  /** Error message when throwing */
  throwMessage?: string;
  /** Whether to throw on initialize */
  throwOnInitialize?: boolean;
  /** Whether to throw on cleanup */
  throwOnCleanup?: boolean;
}

/**
 * Mock agent for testing
 */
export class MockAgent extends BaseAgent {
  private config: MockAgentConfig;

  /** Track all contexts received */
  readonly stepContexts: TickContext[] = [];

  /** Track initialize calls */
  initializeCalled = false;
  initializeContext: TickContext | null = null;

  /** Track cleanup calls */
  cleanupCalled = false;

  constructor(id: string, params: Record<string, unknown> = {}) {
    super(id, params);
    this.config = {
      action: null,
      ...params,
    };
  }

  async step(ctx: TickContext): Promise<Action | null> {
    this.stepContexts.push(ctx);

    if (this.config.throwOnStep) {
      throw new Error(this.config.throwMessage ?? 'MockAgent step error');
    }

    if (this.config.actionFn) {
      return this.config.actionFn(ctx);
    }

    if (this.config.actionProbability !== undefined) {
      if (ctx.rng.nextFloat() < this.config.actionProbability) {
        return this.createDefaultAction(ctx);
      }
      return null;
    }

    return this.config.action ?? null;
  }

  async initialize(ctx: TickContext): Promise<void> {
    if (this.config.throwOnInitialize) {
      throw new Error('MockAgent initialize error');
    }
    this.initializeCalled = true;
    this.initializeContext = ctx;
  }

  async cleanup(): Promise<void> {
    if (this.config.throwOnCleanup) {
      throw new Error('MockAgent cleanup error');
    }
    this.cleanupCalled = true;
  }

  /**
   * Configure the mock agent behavior
   */
  configure(config: Partial<MockAgentConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Reset the mock agent tracking
   */
  reset(): void {
    this.stepContexts.length = 0;
    this.initializeCalled = false;
    this.initializeContext = null;
    this.cleanupCalled = false;
  }

  private createDefaultAction(ctx: TickContext): Action {
    return {
      id: this.generateActionId('mock-action', ctx.tick),
      name: 'mock-action',
      params: { tick: ctx.tick },
    };
  }
}

/**
 * Create a mock agent that always returns an action
 */
export function createActiveAgent(id: string, actionName = 'test-action'): MockAgent {
  const agent = new MockAgent(id);
  agent.configure({
    actionFn: (ctx) => ({
      id: `${id}-${actionName}-${ctx.tick}`,
      name: actionName,
      params: { tick: ctx.tick },
    }),
  });
  return agent;
}

/**
 * Create a mock agent that never returns an action
 */
export function createPassiveAgent(id: string): MockAgent {
  const agent = new MockAgent(id);
  agent.configure({ action: null });
  return agent;
}

/**
 * Create a mock agent with specified action probability
 */
export function createStochasticAgent(id: string, probability: number): MockAgent {
  const agent = new MockAgent(id);
  agent.configure({ actionProbability: probability });
  return agent;
}

/**
 * Create a mock agent that throws on step
 */
export function createThrowingAgent(id: string, message = 'Agent error'): MockAgent {
  const agent = new MockAgent(id);
  agent.configure({ throwOnStep: true, throwMessage: message });
  return agent;
}

/**
 * Create multiple mock agents
 */
export function createMockAgents(count: number, prefix = 'agent'): MockAgent[] {
  return Array.from({ length: count }, (_, i) => new MockAgent(`${prefix}-${i}`));
}

/**
 * Agent that tracks execution order for testing scheduling
 */
export class OrderTrackingAgent extends BaseAgent {
  static executionOrder: string[] = [];

  async step(_ctx: TickContext): Promise<Action | null> {
    OrderTrackingAgent.executionOrder.push(this.id);
    return null;
  }

  static reset(): void {
    OrderTrackingAgent.executionOrder = [];
  }
}

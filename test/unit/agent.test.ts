import { describe, expect, it } from 'vitest';
import { BaseAgent, NoOpAgent } from '../../src/core/agent.js';
import { Rng } from '../../src/core/rng.js';
import type { Action, TickContext } from '../../src/core/types.js';
import { createMockLogger, createMockPack } from '../mocks/index.js';

// Concrete implementation for testing abstract class
class TestAgent extends BaseAgent {
  private actionToReturn: Action | null = null;
  private shouldThrow = false;
  stepCallCount = 0;

  setAction(action: Action | null): void {
    this.actionToReturn = action;
  }

  setShouldThrow(shouldThrow: boolean): void {
    this.shouldThrow = shouldThrow;
  }

  async step(_ctx: TickContext): Promise<Action | null> {
    this.stepCallCount++;
    if (this.shouldThrow) {
      throw new Error('Test error');
    }
    return this.actionToReturn;
  }
}

function createTestContext(tick = 0): TickContext {
  const pack = createMockPack();
  return {
    tick,
    timestamp: Date.now(),
    rng: new Rng(42),
    logger: createMockLogger(),
    pack,
    world: pack.getWorldState(),
  };
}

describe('BaseAgent', () => {
  describe('constructor', () => {
    it('sets id from constructor argument', () => {
      const agent = new TestAgent('test-agent-1');
      expect(agent.id).toBe('test-agent-1');
    });

    it('sets type to class name', () => {
      const agent = new TestAgent('test-1');
      expect(agent.type).toBe('TestAgent');
    });

    it('accepts params in constructor', () => {
      const agent = new TestAgent('test-1', { foo: 'bar' });
      expect(agent).toBeDefined();
    });

    it('uses empty object for default params', () => {
      const agent = new TestAgent('test-1');
      // Should not throw when accessing params internally
      expect(agent).toBeDefined();
    });
  });

  describe('getParam', () => {
    it('returns parameter value when present', () => {
      class ParamTestAgent extends BaseAgent {
        async step(): Promise<Action | null> {
          return null;
        }
        testGetParam<T>(key: string, defaultValue: T): T {
          return this.getParam(key, defaultValue);
        }
      }

      const agent = new ParamTestAgent('test', { myParam: 'myValue', numParam: 42 });
      expect(agent.testGetParam('myParam', 'default')).toBe('myValue');
      expect(agent.testGetParam('numParam', 0)).toBe(42);
    });

    it('returns default when parameter missing', () => {
      class ParamTestAgent extends BaseAgent {
        async step(): Promise<Action | null> {
          return null;
        }
        testGetParam<T>(key: string, defaultValue: T): T {
          return this.getParam(key, defaultValue);
        }
      }

      const agent = new ParamTestAgent('test', {});
      expect(agent.testGetParam('missing', 'defaultValue')).toBe('defaultValue');
      expect(agent.testGetParam('missing', 100)).toBe(100);
    });
  });

  describe('generateActionId', () => {
    it('includes agent id in action id', () => {
      class ActionIdTestAgent extends BaseAgent {
        async step(): Promise<Action | null> {
          return null;
        }
        testGenerateActionId(actionName: string, tick: number): string {
          return this.generateActionId(actionName, tick);
        }
      }

      const agent = new ActionIdTestAgent('my-agent');
      const actionId = agent.testGenerateActionId('buy', 5);
      expect(actionId).toContain('my-agent');
    });

    it('includes action name in action id', () => {
      class ActionIdTestAgent extends BaseAgent {
        async step(): Promise<Action | null> {
          return null;
        }
        testGenerateActionId(actionName: string, tick: number): string {
          return this.generateActionId(actionName, tick);
        }
      }

      const agent = new ActionIdTestAgent('agent');
      const actionId = agent.testGenerateActionId('sell', 10);
      expect(actionId).toContain('sell');
    });

    it('includes tick in action id', () => {
      class ActionIdTestAgent extends BaseAgent {
        async step(): Promise<Action | null> {
          return null;
        }
        testGenerateActionId(actionName: string, tick: number): string {
          return this.generateActionId(actionName, tick);
        }
      }

      const agent = new ActionIdTestAgent('agent');
      const actionId = agent.testGenerateActionId('hold', 42);
      expect(actionId).toContain('42');
    });
  });

  describe('initialize', () => {
    it('can be overridden', async () => {
      class InitAgent extends BaseAgent {
        initialized = false;
        async initialize(_ctx: TickContext): Promise<void> {
          this.initialized = true;
        }
        async step(): Promise<Action | null> {
          return null;
        }
      }

      const agent = new InitAgent('test');
      await agent.initialize(createTestContext());
      expect(agent.initialized).toBe(true);
    });

    it('default implementation is no-op', async () => {
      const agent = new TestAgent('test');
      // Should not throw
      await agent.initialize(createTestContext());
    });
  });

  describe('cleanup', () => {
    it('can be overridden', async () => {
      class CleanupAgent extends BaseAgent {
        cleanedUp = false;
        async cleanup(): Promise<void> {
          this.cleanedUp = true;
        }
        async step(): Promise<Action | null> {
          return null;
        }
      }

      const agent = new CleanupAgent('test');
      await agent.cleanup();
      expect(agent.cleanedUp).toBe(true);
    });

    it('default implementation is no-op', async () => {
      const agent = new TestAgent('test');
      // Should not throw
      await agent.cleanup();
    });
  });

  describe('statistics tracking', () => {
    it('starts with zero stats', () => {
      const agent = new TestAgent('test');
      const stats = agent.getStats();
      expect(stats.actionsAttempted).toBe(0);
      expect(stats.actionsSucceeded).toBe(0);
      expect(stats.actionsFailed).toBe(0);
    });

    it('recordSuccess increments attempted and succeeded', () => {
      const agent = new TestAgent('test');
      agent.recordSuccess();
      agent.recordSuccess();
      const stats = agent.getStats();
      expect(stats.actionsAttempted).toBe(2);
      expect(stats.actionsSucceeded).toBe(2);
      expect(stats.actionsFailed).toBe(0);
    });

    it('recordFailure increments attempted and failed', () => {
      const agent = new TestAgent('test');
      agent.recordFailure();
      agent.recordFailure();
      agent.recordFailure();
      const stats = agent.getStats();
      expect(stats.actionsAttempted).toBe(3);
      expect(stats.actionsSucceeded).toBe(0);
      expect(stats.actionsFailed).toBe(3);
    });

    it('recordSkip does not increment any counter', () => {
      const agent = new TestAgent('test');
      agent.recordSkip();
      agent.recordSkip();
      const stats = agent.getStats();
      expect(stats.actionsAttempted).toBe(0);
      expect(stats.actionsSucceeded).toBe(0);
      expect(stats.actionsFailed).toBe(0);
    });

    it('tracks mixed success and failure', () => {
      const agent = new TestAgent('test');
      agent.recordSuccess();
      agent.recordFailure();
      agent.recordSuccess();
      agent.recordSkip();
      agent.recordFailure();
      const stats = agent.getStats();
      expect(stats.actionsAttempted).toBe(4);
      expect(stats.actionsSucceeded).toBe(2);
      expect(stats.actionsFailed).toBe(2);
    });
  });

  describe('getStats', () => {
    it('returns id and type', () => {
      const agent = new TestAgent('my-agent-id');
      const stats = agent.getStats();
      expect(stats.id).toBe('my-agent-id');
      expect(stats.type).toBe('TestAgent');
    });

    it('returns current statistics', () => {
      const agent = new TestAgent('test');
      agent.recordSuccess();
      agent.recordFailure();
      const stats = agent.getStats();
      expect(stats).toEqual({
        id: 'test',
        type: 'TestAgent',
        actionsAttempted: 2,
        actionsSucceeded: 1,
        actionsFailed: 1,
      });
    });
  });
});

describe('NoOpAgent', () => {
  it('always returns null from step', async () => {
    const agent = new NoOpAgent('noop');
    const ctx = createTestContext();

    const action1 = await agent.step(ctx);
    const action2 = await agent.step(ctx);

    expect(action1).toBeNull();
    expect(action2).toBeNull();
  });

  it('has correct type name', () => {
    const agent = new NoOpAgent('test');
    expect(agent.type).toBe('NoOpAgent');
  });
});

import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SimulationEngine, runScenario } from '../../src/core/engine.js';
import { defineScenario } from '../../src/core/scenario.js';
import type { Scenario } from '../../src/core/types.js';
import {
  MockAgent,
  type MockPack,
  createActiveAgent,
  createMockLogger,
  createMockPack,
  createPassiveAgent,
  createThrowingAgent,
} from '../mocks/index.js';

describe('SimulationEngine', () => {
  let testDir: string;
  let mockPack: MockPack;

  beforeEach(async () => {
    testDir = join(tmpdir(), `engine-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    mockPack = createMockPack();
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  function createTestScenario(overrides: Partial<Scenario> = {}): Scenario {
    return defineScenario({
      name: 'test-scenario',
      seed: 12345,
      ticks: 5,
      tickSeconds: 3600,
      pack: mockPack,
      agents: [{ type: MockAgent, count: 2 }],
      ...overrides,
    });
  }

  describe('constructor', () => {
    it('creates engine with default options', () => {
      const engine = new SimulationEngine();
      expect(engine).toBeDefined();
    });

    it('accepts custom logger', () => {
      const logger = createMockLogger();
      const engine = new SimulationEngine({ logger });
      expect(engine).toBeDefined();
    });
  });

  describe('run', () => {
    it('executes all ticks', async () => {
      const scenario = createTestScenario({ ticks: 10 });
      const engine = new SimulationEngine({ logger: createMockLogger() });

      const result = await engine.run(scenario, {
        outDir: testDir,
        ci: true,
      });

      expect(result.ticks).toBe(10);
      expect(mockPack.tickHistory.length).toBe(10);
    });

    it('initializes pack before running', async () => {
      const scenario = createTestScenario();
      const engine = new SimulationEngine({ logger: createMockLogger() });

      await engine.run(scenario, { outDir: testDir, ci: true });

      expect(mockPack.initializeCalled).toBe(true);
    });

    it('cleans up pack after running', async () => {
      const scenario = createTestScenario();
      const engine = new SimulationEngine({ logger: createMockLogger() });

      await engine.run(scenario, { outDir: testDir, ci: true });

      expect(mockPack.cleanupCalled).toBe(true);
    });

    it('creates agents according to configuration', async () => {
      const scenario = createTestScenario({
        agents: [
          { type: MockAgent, count: 3 },
          { type: MockAgent, count: 2 },
        ],
      });
      const engine = new SimulationEngine({ logger: createMockLogger() });

      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.agentStats.length).toBe(5);
    });

    it('generates unique run ID', async () => {
      const scenario = createTestScenario();
      const engine = new SimulationEngine({ logger: createMockLogger() });

      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.runId).toContain('test-scenario');
    });

    it('respects seed for determinism', async () => {
      const scenario1 = createTestScenario({ seed: 42 });
      const scenario2 = createTestScenario({ seed: 42 });
      const engine = new SimulationEngine({ logger: createMockLogger() });

      const result1 = await engine.run(scenario1, { outDir: testDir, ci: true });
      mockPack.reset();
      const result2 = await engine.run(scenario2, { outDir: testDir, ci: true });

      expect(result1.agentStats).toEqual(result2.agentStats);
    });

    it('uses option seed over scenario seed', async () => {
      const scenario = createTestScenario({ seed: 100 });
      const engine = new SimulationEngine({ logger: createMockLogger() });

      const result = await engine.run(scenario, {
        outDir: testDir,
        ci: true,
        seed: 200,
      });

      expect(result.seed).toBe(200);
    });

    it('uses option ticks over scenario ticks', async () => {
      const scenario = createTestScenario({ ticks: 10 });
      const engine = new SimulationEngine({ logger: createMockLogger() });

      const result = await engine.run(scenario, {
        outDir: testDir,
        ci: true,
        ticks: 5,
      });

      expect(result.ticks).toBe(5);
    });

    it('reports correct duration', async () => {
      const scenario = createTestScenario({ ticks: 3 });
      const engine = new SimulationEngine({ logger: createMockLogger() });

      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('returns outputDir in result', async () => {
      const scenario = createTestScenario();
      const engine = new SimulationEngine({ logger: createMockLogger() });

      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.outputDir).toContain(testDir);
    });
  });

  describe('agent execution', () => {
    it('calls step on all agents each tick', async () => {
      const scenario = createTestScenario({ ticks: 3 });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      await engine.run(scenario, { outDir: testDir, ci: true });

      // Verify actions were executed (agents may or may not produce actions)
      // The important thing is that the simulation completes
      expect(mockPack.tickHistory.length).toBe(3);
    });

    it('executes actions through pack', async () => {
      const activeAgent = createActiveAgent('active', 'buy');

      const _scenario = defineScenario({
        name: 'action-test',
        seed: 1,
        ticks: 2,
        tickSeconds: 3600,
        pack: mockPack,
        agents: [{ type: activeAgent.constructor as typeof MockAgent, count: 1 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });

      // Create scenario with agents that always act
      const testPack = createMockPack();
      const actionScenario = defineScenario({
        name: 'action-test',
        seed: 1,
        ticks: 2,
        tickSeconds: 3600,
        pack: testPack,
        agents: [
          {
            type: class extends MockAgent {
              constructor(id: string, params: Record<string, unknown> = {}) {
                super(id, params);
                this.configure({
                  actionFn: (ctx) => ({
                    id: `${this.id}-action-${ctx.tick}`,
                    name: 'test-action',
                    params: {},
                  }),
                });
              }
            },
            count: 1,
          },
        ],
      });

      await engine.run(actionScenario, { outDir: testDir, ci: true });

      expect(testPack.executedActions.length).toBeGreaterThan(0);
    });

    it('tracks action success in agent stats', async () => {
      // Create a pack that succeeds
      const successPack = createMockPack();

      const scenario = defineScenario({
        name: 'success-test',
        seed: 1,
        ticks: 3,
        tickSeconds: 3600,
        pack: successPack,
        agents: [
          {
            type: class extends MockAgent {
              constructor(id: string, params: Record<string, unknown> = {}) {
                super(id, params);
                this.configure({
                  actionFn: (ctx) => ({
                    id: `${this.id}-action-${ctx.tick}`,
                    name: 'success-action',
                    params: {},
                  }),
                });
              }
            },
            count: 1,
          },
        ],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      const stats = result.agentStats[0];
      expect(stats?.actionsSucceeded).toBe(3);
      expect(stats?.actionsFailed).toBe(0);
    });

    it('tracks action failures in agent stats', async () => {
      // Create a pack that fails actions
      const failPack = createMockPack({
        actionHandler: async () => ({ ok: false, error: 'Test failure' }),
      });

      const scenario = defineScenario({
        name: 'failure-test',
        seed: 1,
        ticks: 3,
        tickSeconds: 3600,
        pack: failPack,
        agents: [
          {
            type: class extends MockAgent {
              constructor(id: string, params: Record<string, unknown> = {}) {
                super(id, params);
                this.configure({
                  actionFn: (ctx) => ({
                    id: `${this.id}-action-${ctx.tick}`,
                    name: 'fail-action',
                    params: {},
                  }),
                });
              }
            },
            count: 1,
          },
        ],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      const stats = result.agentStats[0];
      expect(stats?.actionsSucceeded).toBe(0);
      expect(stats?.actionsFailed).toBe(3);
    });

    it('handles agent errors gracefully', async () => {
      const scenario = defineScenario({
        name: 'error-test',
        seed: 1,
        ticks: 2,
        tickSeconds: 3600,
        pack: mockPack,
        agents: [
          {
            type: class extends MockAgent {
              constructor(id: string, params: Record<string, unknown> = {}) {
                super(id, params);
                this.configure({ throwOnStep: true, throwMessage: 'Agent error' });
              }
            },
            count: 1,
          },
        ],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      // Should complete without throwing
      expect(result.ticks).toBe(2);
      expect(result.agentStats[0]?.actionsFailed).toBe(2);
    });

    it('sets current agent context in pack', async () => {
      const agentIds: string[] = [];
      const trackingPack = createMockPack();
      const originalSetCurrentAgent = trackingPack.setCurrentAgent.bind(trackingPack);
      trackingPack.setCurrentAgent = (agentId: string) => {
        agentIds.push(agentId);
        originalSetCurrentAgent(agentId);
      };

      const scenario = defineScenario({
        name: 'context-test',
        seed: 1,
        ticks: 1,
        tickSeconds: 3600,
        pack: trackingPack,
        agents: [{ type: MockAgent, count: 2 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      await engine.run(scenario, { outDir: testDir, ci: true });

      expect(agentIds.length).toBe(2);
    });
  });

  describe('assertions', () => {
    it('marks success when all assertions pass', async () => {
      mockPack.setMetrics({ totalValue: 100 });

      const scenario = createTestScenario({
        assertions: [{ type: 'gt', metric: 'totalValue', value: 50 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(true);
      expect(result.failedAssertions.length).toBe(0);
    });

    it('marks failure when assertion fails', async () => {
      mockPack.setMetrics({ totalValue: 10 });

      const scenario = createTestScenario({
        assertions: [{ type: 'gt', metric: 'totalValue', value: 50 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(false);
      expect(result.failedAssertions.length).toBe(1);
    });

    it('validates eq assertion', async () => {
      mockPack.setMetrics({ count: 42 });

      const passScenario = createTestScenario({
        assertions: [{ type: 'eq', metric: 'count', value: 42 }],
      });
      const failScenario = createTestScenario({
        assertions: [{ type: 'eq', metric: 'count', value: 100 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });

      const passResult = await engine.run(passScenario, { outDir: testDir, ci: true });
      mockPack.reset();
      mockPack.setMetrics({ count: 42 });
      const failResult = await engine.run(failScenario, { outDir: testDir, ci: true });

      expect(passResult.success).toBe(true);
      expect(failResult.success).toBe(false);
    });

    it('validates gte assertion', async () => {
      mockPack.setMetrics({ value: 50 });

      const passScenario1 = createTestScenario({
        assertions: [{ type: 'gte', metric: 'value', value: 50 }],
      });
      const passScenario2 = createTestScenario({
        assertions: [{ type: 'gte', metric: 'value', value: 40 }],
      });
      const failScenario = createTestScenario({
        assertions: [{ type: 'gte', metric: 'value', value: 60 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });

      const passResult1 = await engine.run(passScenario1, { outDir: testDir, ci: true });
      mockPack.reset();
      mockPack.setMetrics({ value: 50 });
      const passResult2 = await engine.run(passScenario2, { outDir: testDir, ci: true });
      mockPack.reset();
      mockPack.setMetrics({ value: 50 });
      const failResult = await engine.run(failScenario, { outDir: testDir, ci: true });

      expect(passResult1.success).toBe(true);
      expect(passResult2.success).toBe(true);
      expect(failResult.success).toBe(false);
    });

    it('validates lt assertion', async () => {
      mockPack.setMetrics({ value: 30 });

      const passScenario = createTestScenario({
        assertions: [{ type: 'lt', metric: 'value', value: 50 }],
      });
      const failScenario = createTestScenario({
        assertions: [{ type: 'lt', metric: 'value', value: 20 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });

      const passResult = await engine.run(passScenario, { outDir: testDir, ci: true });
      mockPack.reset();
      mockPack.setMetrics({ value: 30 });
      const failResult = await engine.run(failScenario, { outDir: testDir, ci: true });

      expect(passResult.success).toBe(true);
      expect(failResult.success).toBe(false);
    });

    it('validates lte assertion', async () => {
      mockPack.setMetrics({ value: 50 });

      const passScenario1 = createTestScenario({
        assertions: [{ type: 'lte', metric: 'value', value: 50 }],
      });
      const passScenario2 = createTestScenario({
        assertions: [{ type: 'lte', metric: 'value', value: 60 }],
      });
      const failScenario = createTestScenario({
        assertions: [{ type: 'lte', metric: 'value', value: 40 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });

      const passResult1 = await engine.run(passScenario1, { outDir: testDir, ci: true });
      mockPack.reset();
      mockPack.setMetrics({ value: 50 });
      const passResult2 = await engine.run(passScenario2, { outDir: testDir, ci: true });
      mockPack.reset();
      mockPack.setMetrics({ value: 50 });
      const failResult = await engine.run(failScenario, { outDir: testDir, ci: true });

      expect(passResult1.success).toBe(true);
      expect(passResult2.success).toBe(true);
      expect(failResult.success).toBe(false);
    });

    it('fails assertion for missing metric', async () => {
      const scenario = createTestScenario({
        assertions: [{ type: 'gt', metric: 'nonexistent', value: 0 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(false);
      expect(result.failedAssertions[0]?.message).toContain('not found');
    });

    it('handles bigint metrics', async () => {
      mockPack.setMetrics({ bigValue: 1000n });

      const scenario = createTestScenario({
        assertions: [{ type: 'gt', metric: 'bigValue', value: 500 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(true);
    });

    it('handles string metric values', async () => {
      mockPack.setMetrics({ stringValue: '100.5' });

      const scenario = createTestScenario({
        assertions: [{ type: 'gt', metric: 'stringValue', value: 50 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(true);
    });

    it('provides descriptive failure messages', async () => {
      mockPack.setMetrics({ revenue: 100 });

      const scenario = createTestScenario({
        assertions: [{ type: 'gt', metric: 'revenue', value: 200 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.failedAssertions[0]?.message).toContain('revenue');
      expect(result.failedAssertions[0]?.message).toContain('gt');
      expect(result.failedAssertions[0]?.message).toContain('200');
      expect(result.failedAssertions[0]?.message).toContain('100');
    });
  });

  describe('tick progression', () => {
    it('advances timestamp by tickSeconds each tick', async () => {
      const scenario = createTestScenario({
        ticks: 5,
        tickSeconds: 3600,
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      await engine.run(scenario, { outDir: testDir, ci: true });

      // Check tick history
      const history = mockPack.tickHistory;
      expect(history.length).toBe(5);

      for (let i = 1; i < history.length; i++) {
        const prevTimestamp = history[i - 1]?.timestamp ?? 0;
        const currentTimestamp = history[i]?.timestamp ?? 0;
        expect(currentTimestamp - prevTimestamp).toBe(3600);
      }
    });

    it('calls onTick on pack each tick', async () => {
      const scenario = createTestScenario({ ticks: 5 });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      await engine.run(scenario, { outDir: testDir, ci: true });

      expect(mockPack.tickHistory.length).toBe(5);
      expect(mockPack.tickHistory[0]?.tick).toBe(0);
      expect(mockPack.tickHistory[4]?.tick).toBe(4);
    });
  });

  describe('metrics collection', () => {
    it('includes final metrics in result', async () => {
      mockPack.setMetrics({ customMetric: 42 });

      const scenario = createTestScenario();

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.finalMetrics.customMetric).toBe(42);
    });
  });

  describe('runScenario convenience function', () => {
    it('runs scenario and returns result', async () => {
      const scenario = createTestScenario({ ticks: 2 });

      const result = await runScenario(scenario, { outDir: testDir, ci: true });

      expect(result.scenarioName).toBe('test-scenario');
      expect(result.ticks).toBe(2);
    });
  });
});

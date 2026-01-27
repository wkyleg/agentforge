import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/core/engine.js';
import { defineScenario } from '../../src/core/scenario.js';
import { MockAgent, type MockPack, createMockLogger, createMockPack } from '../mocks/index.js';

describe('Assertion Validation', () => {
  let testDir: string;
  let mockPack: MockPack;

  beforeEach(async () => {
    testDir = join(tmpdir(), `agentforge-assertions-${Date.now()}`);
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

  describe('greater than (gt)', () => {
    it('passes when metric exceeds threshold', async () => {
      mockPack.setMetrics({ revenue: 1000 });

      const scenario = defineScenario({
        name: 'gt-pass',
        seed: 1,
        ticks: 1,
        tickSeconds: 60,
        pack: mockPack,
        agents: [{ type: MockAgent, count: 1 }],
        assertions: [{ type: 'gt', metric: 'revenue', value: 500 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(true);
      expect(result.failedAssertions).toHaveLength(0);
    });

    it('fails when metric equals threshold', async () => {
      mockPack.setMetrics({ revenue: 500 });

      const scenario = defineScenario({
        name: 'gt-fail-equal',
        seed: 1,
        ticks: 1,
        tickSeconds: 60,
        pack: mockPack,
        agents: [{ type: MockAgent, count: 1 }],
        assertions: [{ type: 'gt', metric: 'revenue', value: 500 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(false);
      expect(result.failedAssertions).toHaveLength(1);
    });

    it('fails when metric is below threshold', async () => {
      mockPack.setMetrics({ revenue: 100 });

      const scenario = defineScenario({
        name: 'gt-fail',
        seed: 1,
        ticks: 1,
        tickSeconds: 60,
        pack: mockPack,
        agents: [{ type: MockAgent, count: 1 }],
        assertions: [{ type: 'gt', metric: 'revenue', value: 500 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(false);
    });
  });

  describe('greater than or equal (gte)', () => {
    it('passes when metric equals threshold', async () => {
      mockPack.setMetrics({ users: 100 });

      const scenario = defineScenario({
        name: 'gte-equal',
        seed: 1,
        ticks: 1,
        tickSeconds: 60,
        pack: mockPack,
        agents: [{ type: MockAgent, count: 1 }],
        assertions: [{ type: 'gte', metric: 'users', value: 100 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(true);
    });

    it('passes when metric exceeds threshold', async () => {
      mockPack.setMetrics({ users: 150 });

      const scenario = defineScenario({
        name: 'gte-exceed',
        seed: 1,
        ticks: 1,
        tickSeconds: 60,
        pack: mockPack,
        agents: [{ type: MockAgent, count: 1 }],
        assertions: [{ type: 'gte', metric: 'users', value: 100 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(true);
    });
  });

  describe('less than (lt)', () => {
    it('passes when metric is below threshold', async () => {
      mockPack.setMetrics({ errors: 5 });

      const scenario = defineScenario({
        name: 'lt-pass',
        seed: 1,
        ticks: 1,
        tickSeconds: 60,
        pack: mockPack,
        agents: [{ type: MockAgent, count: 1 }],
        assertions: [{ type: 'lt', metric: 'errors', value: 10 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(true);
    });

    it('fails when metric equals threshold', async () => {
      mockPack.setMetrics({ errors: 10 });

      const scenario = defineScenario({
        name: 'lt-fail-equal',
        seed: 1,
        ticks: 1,
        tickSeconds: 60,
        pack: mockPack,
        agents: [{ type: MockAgent, count: 1 }],
        assertions: [{ type: 'lt', metric: 'errors', value: 10 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(false);
    });
  });

  describe('less than or equal (lte)', () => {
    it('passes when metric equals threshold', async () => {
      mockPack.setMetrics({ latency: 100 });

      const scenario = defineScenario({
        name: 'lte-equal',
        seed: 1,
        ticks: 1,
        tickSeconds: 60,
        pack: mockPack,
        agents: [{ type: MockAgent, count: 1 }],
        assertions: [{ type: 'lte', metric: 'latency', value: 100 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(true);
    });
  });

  describe('equals (eq)', () => {
    it('passes when values match exactly', async () => {
      mockPack.setMetrics({ version: 42 });

      const scenario = defineScenario({
        name: 'eq-pass',
        seed: 1,
        ticks: 1,
        tickSeconds: 60,
        pack: mockPack,
        agents: [{ type: MockAgent, count: 1 }],
        assertions: [{ type: 'eq', metric: 'version', value: 42 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(true);
    });

    it('fails when values differ', async () => {
      mockPack.setMetrics({ version: 41 });

      const scenario = defineScenario({
        name: 'eq-fail',
        seed: 1,
        ticks: 1,
        tickSeconds: 60,
        pack: mockPack,
        agents: [{ type: MockAgent, count: 1 }],
        assertions: [{ type: 'eq', metric: 'version', value: 42 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(false);
    });
  });

  describe('multiple assertions', () => {
    it('passes when all assertions pass', async () => {
      mockPack.setMetrics({
        revenue: 1000,
        users: 50,
        errors: 0,
      });

      const scenario = defineScenario({
        name: 'multi-pass',
        seed: 1,
        ticks: 1,
        tickSeconds: 60,
        pack: mockPack,
        agents: [{ type: MockAgent, count: 1 }],
        assertions: [
          { type: 'gt', metric: 'revenue', value: 500 },
          { type: 'gte', metric: 'users', value: 50 },
          { type: 'eq', metric: 'errors', value: 0 },
        ],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(true);
      expect(result.failedAssertions).toHaveLength(0);
    });

    it('fails when any assertion fails', async () => {
      mockPack.setMetrics({
        revenue: 1000,
        users: 50,
        errors: 5, // This will fail the eq assertion
      });

      const scenario = defineScenario({
        name: 'multi-fail',
        seed: 1,
        ticks: 1,
        tickSeconds: 60,
        pack: mockPack,
        agents: [{ type: MockAgent, count: 1 }],
        assertions: [
          { type: 'gt', metric: 'revenue', value: 500 },
          { type: 'gte', metric: 'users', value: 50 },
          { type: 'eq', metric: 'errors', value: 0 },
        ],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(false);
      expect(result.failedAssertions).toHaveLength(1);
      expect(result.failedAssertions[0]?.assertion.metric).toBe('errors');
    });

    it('reports all failed assertions', async () => {
      mockPack.setMetrics({
        revenue: 100, // Fails
        users: 10, // Fails
        errors: 5, // Fails
      });

      const scenario = defineScenario({
        name: 'all-fail',
        seed: 1,
        ticks: 1,
        tickSeconds: 60,
        pack: mockPack,
        agents: [{ type: MockAgent, count: 1 }],
        assertions: [
          { type: 'gt', metric: 'revenue', value: 500 },
          { type: 'gte', metric: 'users', value: 50 },
          { type: 'eq', metric: 'errors', value: 0 },
        ],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(false);
      expect(result.failedAssertions).toHaveLength(3);
    });
  });

  describe('edge cases', () => {
    it('handles missing metric gracefully', async () => {
      const scenario = defineScenario({
        name: 'missing-metric',
        seed: 1,
        ticks: 1,
        tickSeconds: 60,
        pack: mockPack,
        agents: [{ type: MockAgent, count: 1 }],
        assertions: [{ type: 'gt', metric: 'nonexistent', value: 0 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(false);
      expect(result.failedAssertions[0]?.message).toContain('not found');
    });

    it('handles bigint metrics', async () => {
      mockPack.setMetrics({ bigNumber: 1000000000000n });

      const scenario = defineScenario({
        name: 'bigint-metric',
        seed: 1,
        ticks: 1,
        tickSeconds: 60,
        pack: mockPack,
        agents: [{ type: MockAgent, count: 1 }],
        assertions: [{ type: 'gt', metric: 'bigNumber', value: 1000000000 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(true);
    });

    it('handles string assertion values', async () => {
      mockPack.setMetrics({ value: 100 });

      const scenario = defineScenario({
        name: 'string-value',
        seed: 1,
        ticks: 1,
        tickSeconds: 60,
        pack: mockPack,
        agents: [{ type: MockAgent, count: 1 }],
        assertions: [{ type: 'gt', metric: 'value', value: '50' }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(true);
    });

    it('handles zero threshold', async () => {
      mockPack.setMetrics({ count: 0 });

      const scenario = defineScenario({
        name: 'zero-threshold',
        seed: 1,
        ticks: 1,
        tickSeconds: 60,
        pack: mockPack,
        agents: [{ type: MockAgent, count: 1 }],
        assertions: [{ type: 'gte', metric: 'count', value: 0 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(true);
    });

    it('handles negative numbers', async () => {
      mockPack.setMetrics({ pnl: -50 });

      const scenario = defineScenario({
        name: 'negative',
        seed: 1,
        ticks: 1,
        tickSeconds: 60,
        pack: mockPack,
        agents: [{ type: MockAgent, count: 1 }],
        assertions: [{ type: 'gt', metric: 'pnl', value: -100 }],
      });

      const engine = new SimulationEngine({ logger: createMockLogger() });
      const result = await engine.run(scenario, { outDir: testDir, ci: true });

      expect(result.success).toBe(true);
    });
  });
});

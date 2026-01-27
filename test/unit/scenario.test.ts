import { describe, expect, it } from 'vitest';
import { NoOpAgent } from '../../src/core/agent.js';
import { defineScenario } from '../../src/core/scenario.js';
import { MockAgent, createMockPack } from '../mocks/index.js';

describe('defineScenario', () => {
  it('returns a normalized scenario with defaults', () => {
    const mockPack = createMockPack();
    const input = {
      name: 'test-scenario',
      seed: 42,
      ticks: 100,
      tickSeconds: 3600,
      pack: mockPack,
      agents: [{ type: NoOpAgent, count: 5 }],
    };

    const result = defineScenario(input);

    expect(result.name).toBe('test-scenario');
    expect(result.seed).toBe(42);
    expect(result.ticks).toBe(100);
    expect(result.tickSeconds).toBe(3600);
    expect(result.pack).toBe(mockPack);
    expect(result.agents.length).toBe(1);
    // Check defaults are added
    expect(result.metrics).toBeDefined();
    expect(result.assertions).toBeDefined();
  });

  it('preserves metrics configuration', () => {
    const scenario = defineScenario({
      name: 'test',
      seed: 1,
      ticks: 10,
      tickSeconds: 60,
      pack: createMockPack(),
      agents: [{ type: NoOpAgent, count: 1 }],
      metrics: {
        sampleEveryTicks: 5,
        track: ['revenue', 'users'],
      },
    });

    expect(scenario.metrics?.sampleEveryTicks).toBe(5);
    expect(scenario.metrics?.track).toEqual(['revenue', 'users']);
  });

  it('preserves assertions', () => {
    const scenario = defineScenario({
      name: 'test',
      seed: 1,
      ticks: 10,
      tickSeconds: 60,
      pack: createMockPack(),
      agents: [{ type: NoOpAgent, count: 1 }],
      assertions: [
        { type: 'gt', metric: 'value', value: 100 },
        { type: 'lte', metric: 'count', value: 50 },
      ],
    });

    expect(scenario.assertions?.length).toBe(2);
    expect(scenario.assertions?.[0]?.type).toBe('gt');
    expect(scenario.assertions?.[1]?.type).toBe('lte');
  });

  it('supports multiple agent types', () => {
    const scenario = defineScenario({
      name: 'multi-agent',
      seed: 1,
      ticks: 10,
      tickSeconds: 60,
      pack: createMockPack(),
      agents: [
        { type: NoOpAgent, count: 3 },
        { type: MockAgent, count: 2 },
      ],
    });

    expect(scenario.agents.length).toBe(2);
    expect(scenario.agents[0]?.count).toBe(3);
    expect(scenario.agents[1]?.count).toBe(2);
  });

  it('supports agent params', () => {
    const scenario = defineScenario({
      name: 'parameterized',
      seed: 1,
      ticks: 10,
      tickSeconds: 60,
      pack: createMockPack(),
      agents: [
        {
          type: MockAgent,
          count: 1,
          params: { strategy: 'aggressive', budget: 1000 },
        },
      ],
    });

    expect(scenario.agents[0]?.params?.strategy).toBe('aggressive');
    expect(scenario.agents[0]?.params?.budget).toBe(1000);
  });

  it('throws for empty agents array', () => {
    expect(() =>
      defineScenario({
        name: 'no-agents',
        seed: 1,
        ticks: 5,
        tickSeconds: 60,
        pack: createMockPack(),
        agents: [],
      })
    ).toThrow('At least one agent configuration is required');
  });

  it('throws for zero ticks', () => {
    expect(() =>
      defineScenario({
        name: 'zero-ticks',
        seed: 1,
        ticks: 0,
        tickSeconds: 60,
        pack: createMockPack(),
        agents: [{ type: NoOpAgent, count: 1 }],
      })
    ).toThrow('Ticks must be positive');
  });

  it('allows negative seed', () => {
    const scenario = defineScenario({
      name: 'negative-seed',
      seed: -42,
      ticks: 10,
      tickSeconds: 60,
      pack: createMockPack(),
      agents: [{ type: NoOpAgent, count: 1 }],
    });

    expect(scenario.seed).toBe(-42);
  });

  it('allows very large tick seconds', () => {
    const scenario = defineScenario({
      name: 'large-ticks',
      seed: 1,
      ticks: 10,
      tickSeconds: 86400 * 365, // 1 year in seconds
      pack: createMockPack(),
      agents: [{ type: NoOpAgent, count: 1 }],
    });

    expect(scenario.tickSeconds).toBe(86400 * 365);
  });
});

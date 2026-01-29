import { mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NoOpAgent } from '../../src/core/agent.js';
import {
  type CheckpointWriter,
  ProbeSampler,
  createCheckpointWriter,
  createProbeSampler,
} from '../../src/core/checkpoints.js';
import { createMockPack } from '../mocks/index.js';

describe('CheckpointWriter', () => {
  let testDir: string;
  let checkpointWriter: CheckpointWriter;

  beforeEach(async () => {
    testDir = join(tmpdir(), `agentforge-checkpoint-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    checkpointWriter = createCheckpointWriter({
      outDir: testDir,
      config: {
        everyTicks: 10,
        includeAgentMemory: true,
        includeProbes: true,
      },
    });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    it('creates checkpoints directory on initialize', async () => {
      await checkpointWriter.initialize();

      const { stat } = await import('node:fs/promises');
      const checkpointsDir = join(testDir, 'checkpoints');
      const stats = await stat(checkpointsDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('shouldCheckpoint', () => {
    it('returns false for tick 0', () => {
      expect(checkpointWriter.shouldCheckpoint(0)).toBe(false);
    });

    it('returns true when tick is multiple of everyTicks', () => {
      expect(checkpointWriter.shouldCheckpoint(10)).toBe(true);
      expect(checkpointWriter.shouldCheckpoint(20)).toBe(true);
      expect(checkpointWriter.shouldCheckpoint(30)).toBe(true);
    });

    it('returns false when tick is not multiple of everyTicks', () => {
      expect(checkpointWriter.shouldCheckpoint(5)).toBe(false);
      expect(checkpointWriter.shouldCheckpoint(15)).toBe(false);
      expect(checkpointWriter.shouldCheckpoint(25)).toBe(false);
    });
  });

  describe('writeCheckpoint', () => {
    it('writes checkpoint file with correct name', async () => {
      await checkpointWriter.initialize();

      const pack = createMockPack();
      const agents = [new NoOpAgent('agent-0')];

      await checkpointWriter.writeCheckpoint(10, 1000, agents, pack, { probe1: 100 });

      const checkpointPath = join(testDir, 'checkpoints', 'tick_00010.json');
      const content = await readFile(checkpointPath, 'utf-8');
      const checkpoint = JSON.parse(content);

      expect(checkpoint.tick).toBe(10);
      expect(checkpoint.timestamp).toBe(1000);
      expect(checkpoint.createdAt).toBeDefined();
    });

    it('includes world summary from pack', async () => {
      await checkpointWriter.initialize();

      const pack = createMockPack();
      const agents: NoOpAgent[] = [];

      await checkpointWriter.writeCheckpoint(10, 1000, agents, pack, {});

      const checkpointPath = join(testDir, 'checkpoints', 'tick_00010.json');
      const content = await readFile(checkpointPath, 'utf-8');
      const checkpoint = JSON.parse(content);

      expect(checkpoint.worldSummary).toBeDefined();
      expect(checkpoint.worldSummary.metrics).toBeDefined();
    });

    it('includes agent states when configured', async () => {
      await checkpointWriter.initialize();

      const pack = createMockPack();
      const agent = new NoOpAgent('agent-0');
      const agents = [agent];

      await checkpointWriter.writeCheckpoint(10, 1000, agents, pack, {});

      const checkpointPath = join(testDir, 'checkpoints', 'tick_00010.json');
      const content = await readFile(checkpointPath, 'utf-8');
      const checkpoint = JSON.parse(content);

      expect(checkpoint.agentStates).toBeDefined();
      expect(checkpoint.agentStates['agent-0']).toBeDefined();
    });

    it('includes probe values when configured', async () => {
      await checkpointWriter.initialize();

      const pack = createMockPack();
      const probeValues = { totalSupply: 1000000, tvl: 500000 };

      await checkpointWriter.writeCheckpoint(10, 1000, [], pack, probeValues);

      const checkpointPath = join(testDir, 'checkpoints', 'tick_00010.json');
      const content = await readFile(checkpointPath, 'utf-8');
      const checkpoint = JSON.parse(content);

      expect(checkpoint.probeValues).toEqual(probeValues);
    });

    it('pads tick number to 5 digits', async () => {
      await checkpointWriter.initialize();

      const pack = createMockPack();
      await checkpointWriter.writeCheckpoint(5, 500, [], pack, {});

      const checkpointPath = join(testDir, 'checkpoints', 'tick_00005.json');
      const content = await readFile(checkpointPath, 'utf-8');
      expect(content).toBeTruthy();
    });

    it('throws if not initialized', async () => {
      const pack = createMockPack();

      await expect(checkpointWriter.writeCheckpoint(10, 1000, [], pack, {})).rejects.toThrow(
        'not initialized'
      );
    });
  });

  describe('without agent memory', () => {
    it('excludes agent states when not configured', async () => {
      const writer = createCheckpointWriter({
        outDir: testDir,
        config: {
          everyTicks: 10,
          includeAgentMemory: false,
        },
      });

      await writer.initialize();

      const pack = createMockPack();
      const agent = new NoOpAgent('agent-0');

      await writer.writeCheckpoint(10, 1000, [agent], pack, {});

      const checkpointPath = join(testDir, 'checkpoints', 'tick_00010.json');
      const content = await readFile(checkpointPath, 'utf-8');
      const checkpoint = JSON.parse(content);

      expect(checkpoint.agentStates).toBeUndefined();
    });
  });
});

describe('ProbeSampler', () => {
  describe('sample', () => {
    it('samples all configured probes', async () => {
      const probes = [
        {
          name: 'computed1',
          type: 'computed' as const,
          config: {
            compute: () => 42,
          },
        },
        {
          name: 'computed2',
          type: 'computed' as const,
          config: {
            compute: () => 'hello',
          },
        },
      ];

      const sampler = createProbeSampler(probes);
      const pack = createMockPack();

      const values = await sampler.sample(pack);

      expect(values.computed1).toBe(42);
      expect(values.computed2).toBe('hello');
    });

    it('handles probe errors gracefully', async () => {
      const probes = [
        {
          name: 'failing',
          type: 'computed' as const,
          config: {
            compute: () => {
              throw new Error('Probe failed');
            },
          },
        },
        {
          name: 'working',
          type: 'computed' as const,
          config: {
            compute: () => 100,
          },
        },
      ];

      const sampler = createProbeSampler(probes);
      const pack = createMockPack();

      const values = await sampler.sample(pack);

      expect(values.failing).toBeNull();
      expect(values.working).toBe(100);
    });

    it('passes pack and current results to computed probes', async () => {
      const probes = [
        {
          name: 'first',
          type: 'computed' as const,
          config: {
            compute: () => 10,
          },
        },
        {
          name: 'derived',
          type: 'computed' as const,
          config: {
            compute: (_pack: unknown, results: Record<string, unknown>) => {
              return (results.first as number) * 2;
            },
          },
        },
      ];

      const sampler = createProbeSampler(probes);
      const pack = createMockPack();

      const values = await sampler.sample(pack);

      expect(values.first).toBe(10);
      expect(values.derived).toBe(20);
    });
  });

  describe('getValues', () => {
    it('returns last sampled values', async () => {
      const probes = [
        {
          name: 'test',
          type: 'computed' as const,
          config: {
            compute: () => 123,
          },
        },
      ];

      const sampler = createProbeSampler(probes);
      const pack = createMockPack();

      await sampler.sample(pack);
      const values = sampler.getValues();

      expect(values.test).toBe(123);
    });

    it('returns empty object before first sample', () => {
      const sampler = createProbeSampler([]);
      const values = sampler.getValues();

      expect(values).toEqual({});
    });
  });
});

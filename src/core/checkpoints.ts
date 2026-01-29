import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Logger } from 'pino';
import type { AgentMemory, BaseAgent } from './agent.js';
import type { CheckpointConfig, Pack, ProbeConfig } from './types.js';

/**
 * Checkpoint data structure
 */
export interface CheckpointData {
  /** Tick number when checkpoint was created */
  tick: number;
  /** Simulated timestamp */
  timestamp: number;
  /** Wall clock time when checkpoint was created */
  createdAt: string;
  /** Agent states (memory and cooldowns) */
  agentStates?: Record<
    string,
    {
      memory: AgentMemory;
      cooldowns: Array<{ action: string; until: number }>;
    }
  >;
  /** World state summary from pack */
  worldSummary: Record<string, unknown>;
  /** Probe values at this tick */
  probeValues?: Record<string, unknown>;
}

/**
 * Options for checkpoint writer
 */
export interface CheckpointWriterOptions {
  /** Base directory for checkpoints */
  outDir: string;
  /** Checkpoint configuration */
  config: CheckpointConfig;
  /** Logger instance */
  logger?: Logger;
}

/**
 * Writes checkpoint snapshots to disk
 */
export class CheckpointWriter {
  private readonly outDir: string;
  private readonly config: CheckpointConfig;
  private readonly logger: Logger | undefined;
  private checkpointsDir: string | null = null;

  constructor(options: CheckpointWriterOptions) {
    this.outDir = options.outDir;
    this.config = options.config;
    this.logger = options.logger;
  }

  /**
   * Initialize the checkpoints directory
   */
  async initialize(): Promise<void> {
    this.checkpointsDir = join(this.outDir, 'checkpoints');
    await mkdir(this.checkpointsDir, { recursive: true });
    this.logger?.debug({ dir: this.checkpointsDir }, 'Created checkpoints directory');
  }

  /**
   * Check if a checkpoint should be written at this tick
   */
  shouldCheckpoint(tick: number): boolean {
    return tick > 0 && tick % this.config.everyTicks === 0;
  }

  /**
   * Write a checkpoint at the current tick
   */
  async writeCheckpoint(
    tick: number,
    timestamp: number,
    agents: readonly BaseAgent[],
    pack: Pack,
    probeValues?: Record<string, unknown>
  ): Promise<void> {
    if (!this.checkpointsDir) {
      throw new Error('CheckpointWriter not initialized');
    }

    const checkpoint: CheckpointData = {
      tick,
      timestamp,
      createdAt: new Date().toISOString(),
      worldSummary: this.getWorldSummary(pack),
    };

    // Include agent states if configured
    if (this.config.includeAgentMemory) {
      checkpoint.agentStates = {};
      for (const agent of agents) {
        const extendedStats = agent.getExtendedStats();
        checkpoint.agentStates[agent.id] = {
          memory: this.getAgentMemory(agent),
          cooldowns: extendedStats.activeCooldowns,
        };
      }
    }

    // Include probe values if configured
    if (this.config.includeProbes && probeValues) {
      checkpoint.probeValues = probeValues;
    }

    // Write checkpoint file
    const paddedTick = String(tick).padStart(5, '0');
    const filename = `tick_${paddedTick}.json`;
    const filepath = join(this.checkpointsDir, filename);

    await writeFile(filepath, JSON.stringify(checkpoint, null, 2));
    this.logger?.debug({ tick, filepath }, 'Wrote checkpoint');
  }

  /**
   * Get a summary of the world state from the pack
   */
  private getWorldSummary(pack: Pack): Record<string, unknown> {
    const worldState = pack.getWorldState();
    const metrics = pack.getMetrics();

    return {
      timestamp: worldState.timestamp,
      metrics: this.serializeValues(metrics),
    };
  }

  /**
   * Get agent memory (accessing protected property via extended stats)
   */
  private getAgentMemory(agent: BaseAgent): AgentMemory {
    // We use getExtendedStats which gives us memoryKeys
    // For full memory access, we'd need to expose it differently
    // For now, return an empty object as a placeholder
    // The actual memory would need to be exposed via a new method
    const stats = agent.getExtendedStats();
    return { _keys: stats.memoryKeys } as unknown as AgentMemory;
  }

  /**
   * Serialize values for JSON output
   */
  private serializeValues(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'bigint') {
        result[key] = value.toString();
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}

/**
 * Probe sampler for custom metric collection
 */
export class ProbeSampler {
  private readonly probes: ProbeConfig[];
  private readonly logger: Logger | undefined;
  private readonly values: Map<string, unknown> = new Map();

  constructor(probes: ProbeConfig[], logger?: Logger) {
    this.probes = probes;
    this.logger = logger;
  }

  /**
   * Sample all probes at the current tick
   */
  async sample(pack: Pack): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};

    for (const probe of this.probes) {
      try {
        const value = await this.sampleProbe(probe, pack, results);
        results[probe.name] = value;
        this.values.set(probe.name, value);
      } catch (error) {
        this.logger?.warn(
          { probe: probe.name, error: error instanceof Error ? error.message : error },
          'Probe sampling failed'
        );
        results[probe.name] = null;
      }
    }

    return results;
  }

  /**
   * Get the current probe values
   */
  getValues(): Record<string, unknown> {
    return Object.fromEntries(this.values);
  }

  /**
   * Sample a single probe
   */
  private async sampleProbe(
    probe: ProbeConfig,
    pack: Pack,
    currentResults: Record<string, unknown>
  ): Promise<unknown> {
    switch (probe.type) {
      case 'call': {
        // Call probes require pack implementation support
        // For now, return from world state if available
        const config = probe.config as { target: string; method: string };
        const worldState = pack.getWorldState();
        return worldState[`${config.target}.${config.method}`] ?? null;
      }

      case 'balance': {
        // Balance probes require pack implementation support
        const config = probe.config as { addresses: string[]; token?: string };
        const metrics = pack.getMetrics();
        // Try to find balance in metrics
        const key = config.token
          ? `balance_${config.token}_${config.addresses[0]}`
          : `balance_eth_${config.addresses[0]}`;
        return metrics[key] ?? null;
      }

      case 'computed': {
        const config = probe.config as {
          compute: (pack: Pack, probeValues: Record<string, unknown>) => unknown;
        };
        return config.compute(pack, currentResults);
      }

      default:
        return null;
    }
  }
}

/**
 * Create a checkpoint writer
 */
export function createCheckpointWriter(options: CheckpointWriterOptions): CheckpointWriter {
  return new CheckpointWriter(options);
}

/**
 * Create a probe sampler
 */
export function createProbeSampler(probes: ProbeConfig[], logger?: Logger): ProbeSampler {
  return new ProbeSampler(probes, logger);
}

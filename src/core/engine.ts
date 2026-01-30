import type { Logger } from 'pino';
import type { BaseAgent } from './agent.js';
import { ArtifactsWriter, generateRunId } from './artifacts.js';
import {
  type CheckpointWriter,
  type ProbeSampler,
  createCheckpointWriter,
  createProbeSampler,
} from './checkpoints.js';
import { LogEvents, createLogger } from './logging.js';
import { MetricsCollector } from './metrics.js';
import { Rng } from './rng.js';
import { Scheduler } from './scheduler.js';
import type {
  Action,
  ActionResult,
  Assertion,
  FailedAssertion,
  RecordedAction,
  RunOptions,
  RunResult,
  Scenario,
  TickContext,
} from './types.js';

/**
 * Default run options
 */
const DEFAULT_OPTIONS: Required<Omit<RunOptions, 'seed' | 'ticks' | 'tickSeconds'>> = {
  outDir: 'sim/results',
  ci: false,
  verbose: false,
};

/**
 * The simulation engine orchestrates agent-based simulations
 *
 * It handles:
 * - Tick loop execution
 * - Agent scheduling and execution
 * - Metrics collection
 * - Artifact generation
 * - Assertion validation
 */
export class SimulationEngine {
  private readonly logger: Logger;
  private readonly scheduler: Scheduler;

  constructor(options: { logger?: Logger } = {}) {
    this.logger = options.logger ?? createLogger({ level: 'info' });
    this.scheduler = new Scheduler({ strategy: 'random' });
  }

  /**
   * Run a simulation scenario
   * @param scenario - The scenario to execute
   * @param options - Optional run configuration overrides
   * @returns The simulation result with metrics, stats, and assertion outcomes
   */
  async run(scenario: Scenario, options: RunOptions = {}): Promise<RunResult> {
    const startTime = Date.now();
    const resolvedOptions = this.resolveOptions(scenario, options);

    // Generate run ID
    const runId = generateRunId(scenario.name, resolvedOptions.ci);

    this.logger.info(
      {
        event: LogEvents.SIMULATION_START,
        scenario: scenario.name,
        runId,
        seed: resolvedOptions.seed,
        ticks: resolvedOptions.ticks,
      },
      `Starting simulation: ${scenario.name}`
    );

    // Initialize components
    const rng = new Rng(resolvedOptions.seed);
    const metricsConfig: import('./metrics.js').MetricsCollectorOptions = {
      sampleEveryTicks: scenario.metrics?.sampleEveryTicks ?? 1,
      logger: this.logger,
    };
    if (scenario.metrics?.track) {
      metricsConfig.track = scenario.metrics.track;
    }
    const metricsCollector = new MetricsCollector(metricsConfig);
    const artifactsWriter = new ArtifactsWriter({
      outDir: resolvedOptions.outDir,
      runId,
      logger: this.logger,
    });

    await artifactsWriter.initialize();

    // Initialize checkpoint writer if configured
    let checkpointWriter: CheckpointWriter | null = null;
    if (scenario.checkpoints) {
      checkpointWriter = createCheckpointWriter({
        outDir: artifactsWriter.getRunDir(),
        config: scenario.checkpoints,
        logger: this.logger,
      });
      await checkpointWriter.initialize();
    }

    // Initialize probe sampler if configured
    let probeSampler: ProbeSampler | null = null;
    if (scenario.probes && scenario.probes.length > 0) {
      probeSampler = createProbeSampler(scenario.probes, this.logger);
    }
    const probeEveryTicks = scenario.probeEveryTicks ?? scenario.metrics?.sampleEveryTicks ?? 1;

    // Initialize pack
    await scenario.pack.initialize();

    // Create agents
    const agents = this.createAgents(scenario, rng);

    // Initialize agents
    // Use deterministic timestamp for reproducibility
    // Base timestamp (Nov 2023) + seed offset ensures different seeds get different but deterministic start times
    const initialTimestamp = 1700000000 + (resolvedOptions.seed % 1000000);
    for (const agent of agents) {
      const ctx = this.createTickContext(0, initialTimestamp, rng, scenario);
      await agent.initialize(ctx);
    }

    // Run tick loop
    let currentTimestamp = initialTimestamp;
    let lastProbeValues: Record<string, unknown> = {};

    for (let tick = 0; tick < resolvedOptions.ticks; tick++) {
      await this.executeTick(
        tick,
        currentTimestamp,
        agents,
        scenario,
        rng,
        metricsCollector,
        artifactsWriter
      );

      // Sample probes at configured interval
      if (probeSampler && tick % probeEveryTicks === 0) {
        lastProbeValues = await probeSampler.sample(scenario.pack);
        this.logger.debug({ tick, probes: Object.keys(lastProbeValues) }, 'Sampled probes');
      }

      // Write checkpoint at configured interval
      if (checkpointWriter?.shouldCheckpoint(tick)) {
        await checkpointWriter.writeCheckpoint(
          tick,
          currentTimestamp,
          agents,
          scenario.pack,
          lastProbeValues
        );
      }

      currentTimestamp += resolvedOptions.tickSeconds;
    }

    // Final metrics sample
    metricsCollector.forceSample(resolvedOptions.ticks - 1, currentTimestamp, scenario.pack);

    // Cleanup agents
    for (const agent of agents) {
      await agent.cleanup();
    }

    // Validate assertions
    const finalMetrics = metricsCollector.getFinalMetrics();
    const failedAssertions = this.validateAssertions(scenario.assertions ?? [], finalMetrics);

    // Build result
    const result: RunResult = {
      runId,
      scenarioName: scenario.name,
      seed: resolvedOptions.seed,
      ticks: resolvedOptions.ticks,
      durationMs: Date.now() - startTime,
      success: failedAssertions.length === 0,
      failedAssertions,
      finalMetrics,
      agentStats: agents.map((a) => a.getStats()),
      outputDir: artifactsWriter.getRunDir(),
    };

    // Write artifacts
    await artifactsWriter.writeAll(scenario, resolvedOptions, result, metricsCollector);

    // Cleanup
    await scenario.pack.cleanup();
    await artifactsWriter.cleanup();

    this.logger.info(
      {
        event: LogEvents.SIMULATION_END,
        runId,
        durationMs: result.durationMs,
        success: result.success,
      },
      `Simulation complete: ${result.success ? 'PASSED' : 'FAILED'}`
    );

    return result;
  }

  /**
   * Resolve options with defaults and scenario values
   */
  private resolveOptions(scenario: Scenario, options: RunOptions): Required<RunOptions> {
    return {
      seed: options.seed ?? scenario.seed,
      ticks: options.ticks ?? scenario.ticks,
      tickSeconds: options.tickSeconds ?? scenario.tickSeconds,
      outDir: options.outDir ?? DEFAULT_OPTIONS.outDir,
      ci: options.ci ?? DEFAULT_OPTIONS.ci,
      verbose: options.verbose ?? DEFAULT_OPTIONS.verbose,
    };
  }

  /**
   * Create agent instances from scenario configuration
   */
  private createAgents(scenario: Scenario, _rng: Rng): BaseAgent[] {
    const agents: BaseAgent[] = [];
    let agentIndex = 0;

    for (const config of scenario.agents) {
      for (let i = 0; i < config.count; i++) {
        const id = `${config.type.name}-${agentIndex++}`;
        const agent = new config.type(id, config.params);
        agents.push(agent);
      }
    }

    this.logger.debug({ agentCount: agents.length }, 'Created agents');

    return agents;
  }

  /**
   * Execute a single tick
   */
  private async executeTick(
    tick: number,
    timestamp: number,
    agents: BaseAgent[],
    scenario: Scenario,
    rng: Rng,
    metricsCollector: MetricsCollector,
    artifactsWriter: ArtifactsWriter
  ): Promise<void> {
    this.logger.debug({ event: LogEvents.TICK_START, tick }, `Tick ${tick}`);

    // Notify pack of tick advancement
    scenario.pack.onTick?.(tick, timestamp);

    // Get tick-specific RNG
    const tickRng = rng.derive(tick);

    // Determine agent order
    const orderedAgents = this.scheduler.getOrder(agents, tick, tickRng);

    // Execute each agent
    for (const agent of orderedAgents) {
      await this.executeAgent(agent, tick, timestamp, scenario, tickRng, artifactsWriter);
    }

    // Sample metrics
    metricsCollector.sample(tick, timestamp, scenario.pack);

    this.logger.debug({ event: LogEvents.TICK_END, tick }, `Tick ${tick} complete`);
  }

  /**
   * Execute a single agent's step
   */
  private async executeAgent(
    agent: BaseAgent,
    tick: number,
    timestamp: number,
    scenario: Scenario,
    tickRng: Rng,
    artifactsWriter: ArtifactsWriter
  ): Promise<void> {
    const agentRng = tickRng.derive(tick, agent.id);

    // Set current agent context in pack
    scenario.pack.setCurrentAgent?.(agent.id);

    const ctx = this.createTickContext(tick, timestamp, agentRng, scenario);
    const stepStart = Date.now();

    let action: Action | null = null;
    let result: ActionResult | null = null;

    try {
      // Get agent's action
      action = await agent.step(ctx);

      if (action) {
        // Execute action through pack
        result = await scenario.pack.executeAction(action, agent.id);

        if (result.ok) {
          agent.recordSuccess();
          this.logger.trace(
            {
              event: LogEvents.AGENT_ACTION,
              agentId: agent.id,
              action: action.name,
              success: true,
            },
            `${agent.id} executed ${action.name}`
          );
        } else {
          agent.recordFailure();
          this.logger.trace(
            {
              event: LogEvents.AGENT_ACTION,
              agentId: agent.id,
              action: action.name,
              success: false,
              error: result.error,
            },
            `${agent.id} failed ${action.name}: ${result.error}`
          );
        }
      } else {
        agent.recordSkip();
      }
    } catch (error) {
      agent.recordFailure();
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        {
          event: LogEvents.AGENT_ERROR,
          agentId: agent.id,
          error: errorMessage,
        },
        `Agent ${agent.id} error: ${errorMessage}`
      );
      result = { ok: false, error: errorMessage };
    }

    // Record action
    const recorded: RecordedAction = {
      tick,
      timestamp,
      agentId: agent.id,
      agentType: agent.type,
      action,
      result,
      durationMs: Date.now() - stepStart,
    };
    artifactsWriter.recordAction(recorded);
  }

  /**
   * Create a tick context for an agent
   */
  private createTickContext(
    tick: number,
    timestamp: number,
    rng: Rng,
    scenario: Scenario
  ): TickContext {
    return {
      tick,
      timestamp,
      rng,
      logger: this.logger,
      pack: scenario.pack,
      world: scenario.pack.getWorldState(),
    };
  }

  /**
   * Validate assertions against final metrics
   */
  private validateAssertions(
    assertions: Assertion[],
    metrics: Record<string, number | bigint | string>
  ): FailedAssertion[] {
    const failures: FailedAssertion[] = [];

    for (const assertion of assertions) {
      const actualValue = metrics[assertion.metric];
      if (actualValue === undefined) {
        failures.push({
          assertion,
          actualValue: 'undefined',
          message: `Metric "${assertion.metric}" not found`,
        });
        continue;
      }

      const actual =
        typeof actualValue === 'bigint'
          ? Number(actualValue)
          : typeof actualValue === 'string'
            ? Number.parseFloat(actualValue)
            : actualValue;

      const expected =
        typeof assertion.value === 'string' ? Number.parseFloat(assertion.value) : assertion.value;

      let passed = false;
      switch (assertion.type) {
        case 'eq':
          passed = actual === expected;
          break;
        case 'gt':
          passed = actual > expected;
          break;
        case 'gte':
          passed = actual >= expected;
          break;
        case 'lt':
          passed = actual < expected;
          break;
        case 'lte':
          passed = actual <= expected;
          break;
      }

      if (!passed) {
        failures.push({
          assertion,
          actualValue: actual,
          message: `Expected ${assertion.metric} ${assertion.type} ${expected}, got ${actual}`,
        });
      }
    }

    return failures;
  }
}

/**
 * Convenience function to run a scenario
 * @param scenario - The scenario to execute
 * @param options - Optional run configuration overrides
 * @returns The simulation result with metrics, stats, and assertion outcomes
 */
export async function runScenario(scenario: Scenario, options?: RunOptions): Promise<RunResult> {
  const engine = new SimulationEngine();
  return engine.run(scenario, options);
}

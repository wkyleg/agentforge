import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Logger } from 'pino';
import type { MetricsCollector } from './metrics.js';
import type { RecordedAction, RunOptions, RunResult, Scenario } from './types.js';

/**
 * Options for the artifacts writer
 */
export interface ArtifactsWriterOptions {
  /** Base output directory */
  outDir: string;
  /** Run identifier */
  runId: string;
  /** Logger instance */
  logger?: Logger;
}

/**
 * Writes simulation artifacts to disk
 *
 * Output structure:
 * - summary.json: Run metadata and final KPIs
 * - metrics.csv: Time-series metrics data
 * - actions.ndjson: Newline-delimited JSON of all actions
 * - config_resolved.json: Resolved scenario configuration
 * - run.log: Structured log output (if configured)
 */
export class ArtifactsWriter {
  private readonly outDir: string;
  private readonly runId: string;
  private readonly logger: Logger | undefined;
  private readonly runDir: string;
  private readonly actions: RecordedAction[] = [];
  private logFileHandle: Awaited<ReturnType<typeof import('node:fs/promises').open>> | null = null;

  constructor(options: ArtifactsWriterOptions) {
    this.outDir = options.outDir;
    this.runId = options.runId;
    this.logger = options.logger;
    this.runDir = join(this.outDir, this.runId);
  }

  /**
   * Initialize the artifacts directory
   */
  async initialize(): Promise<void> {
    await mkdir(this.runDir, { recursive: true });
    this.logger?.debug({ runDir: this.runDir }, 'Created artifacts directory');
  }

  /**
   * Get the run directory path
   */
  getRunDir(): string {
    return this.runDir;
  }

  /**
   * Record an action for later writing
   */
  recordAction(action: RecordedAction): void {
    this.actions.push(action);
  }

  /**
   * Write all artifacts at the end of the simulation
   */
  async writeAll(
    scenario: Scenario,
    options: RunOptions,
    result: RunResult,
    metricsCollector: MetricsCollector
  ): Promise<void> {
    await Promise.all([
      this.writeSummary(result),
      this.writeMetrics(metricsCollector),
      this.writeActions(),
      this.writeConfig(scenario, options),
    ]);

    this.logger?.info({ runDir: this.runDir }, 'Wrote all artifacts');
  }

  /**
   * Write the summary.json file
   */
  async writeSummary(result: RunResult): Promise<void> {
    const summary = {
      runId: result.runId,
      scenarioName: result.scenarioName,
      seed: result.seed,
      ticks: result.ticks,
      durationMs: result.durationMs,
      success: result.success,
      failedAssertions: result.failedAssertions,
      finalMetrics: serializeMetrics(result.finalMetrics),
      agentStats: result.agentStats,
      timestamp: new Date().toISOString(),
    };

    const path = join(this.runDir, 'summary.json');
    await writeFile(path, JSON.stringify(summary, null, 2));
    this.logger?.debug({ path }, 'Wrote summary.json');
  }

  /**
   * Write the metrics.csv file
   */
  async writeMetrics(metricsCollector: MetricsCollector): Promise<void> {
    const csv = metricsCollector.toCSV();
    const path = join(this.runDir, 'metrics.csv');
    await writeFile(path, csv);
    this.logger?.debug({ path, rows: metricsCollector.getSamples().length }, 'Wrote metrics.csv');
  }

  /**
   * Write the actions.ndjson file
   */
  async writeActions(): Promise<void> {
    const lines = this.actions.map((action) => JSON.stringify(serializeAction(action)));
    const path = join(this.runDir, 'actions.ndjson');
    await writeFile(path, lines.join('\n'));
    this.logger?.debug({ path, count: this.actions.length }, 'Wrote actions.ndjson');
  }

  /**
   * Write the config_resolved.json file
   */
  async writeConfig(scenario: Scenario, options: RunOptions): Promise<void> {
    const config = {
      scenario: {
        name: scenario.name,
        seed: options.seed ?? scenario.seed,
        ticks: options.ticks ?? scenario.ticks,
        tickSeconds: options.tickSeconds ?? scenario.tickSeconds,
        packName: scenario.pack.name,
        agentCount: scenario.agents.reduce((sum, a) => sum + a.count, 0),
        agentTypes: scenario.agents.map((a) => ({
          type: a.type.name,
          count: a.count,
        })),
        metrics: scenario.metrics,
        assertions: scenario.assertions,
      },
      options: {
        outDir: options.outDir,
        ci: options.ci,
        verbose: options.verbose,
      },
    };

    const path = join(this.runDir, 'config_resolved.json');
    await writeFile(path, JSON.stringify(config, null, 2));
    this.logger?.debug({ path }, 'Wrote config_resolved.json');
  }

  /**
   * Append a log line to run.log
   */
  async appendLog(line: string): Promise<void> {
    const path = join(this.runDir, 'run.log');
    await writeFile(path, `${line}\n`, { flag: 'a' });
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.logFileHandle) {
      await this.logFileHandle.close();
      this.logFileHandle = null;
    }
  }
}

/**
 * Serialize metrics, converting bigints to strings
 */
function serializeMetrics(
  metrics: Record<string, number | bigint | string>
): Record<string, number | string> {
  const result: Record<string, number | string> = {};
  for (const [key, value] of Object.entries(metrics)) {
    result[key] = typeof value === 'bigint' ? value.toString() : value;
  }
  return result;
}

/**
 * Serialize an action for JSON output
 */
function serializeAction(action: RecordedAction): Record<string, unknown> {
  return {
    tick: action.tick,
    timestamp: action.timestamp,
    agentId: action.agentId,
    agentType: action.agentType,
    action: action.action
      ? {
          id: action.action.id,
          name: action.action.name,
          params: action.action.params,
        }
      : null,
    result: action.result
      ? {
          ok: action.result.ok,
          error: action.result.error,
          gasUsed: action.result.gasUsed?.toString(),
          txHash: action.result.txHash,
        }
      : null,
    durationMs: action.durationMs,
  };
}

/**
 * Generate a unique run ID
 */
export function generateRunId(scenarioName: string, ci = false): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  if (ci) {
    // In CI mode, use a more stable naming convention
    return `${scenarioName}-ci`;
  }

  return `${scenarioName}-${timestamp}`;
}

/**
 * Create an artifacts writer
 */
export function createArtifactsWriter(options: ArtifactsWriterOptions): ArtifactsWriter {
  return new ArtifactsWriter(options);
}

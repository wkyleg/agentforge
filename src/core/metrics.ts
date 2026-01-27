import type { Logger } from 'pino';
import type { MetricsSample, Pack } from './types.js';

/**
 * Options for metrics collection
 */
export interface MetricsCollectorOptions {
  /** Sample metrics every N ticks (default: 1) */
  sampleEveryTicks?: number;
  /** Specific metric names to track (default: all from pack) */
  track?: string[];
  /** Logger for metrics events */
  logger?: Logger;
}

/**
 * Collects and stores metrics over the course of a simulation
 */
export class MetricsCollector {
  private readonly sampleEveryTicks: number;
  private readonly trackMetrics: string[] | undefined;
  private readonly logger: Logger | undefined;
  private readonly samples: MetricsSample[] = [];
  private lastSampleTick = -1;

  constructor(options: MetricsCollectorOptions = {}) {
    this.sampleEveryTicks = options.sampleEveryTicks ?? 1;
    this.trackMetrics = options.track;
    this.logger = options.logger;
  }

  /**
   * Check if metrics should be sampled this tick
   */
  shouldSample(tick: number): boolean {
    return tick % this.sampleEveryTicks === 0;
  }

  /**
   * Collect metrics from the pack for this tick
   */
  sample(tick: number, timestamp: number, pack: Pack): void {
    if (!this.shouldSample(tick)) {
      return;
    }

    if (tick <= this.lastSampleTick) {
      return; // Already sampled this tick
    }

    const allMetrics = pack.getMetrics();

    // Filter to tracked metrics if specified
    const metrics = this.trackMetrics
      ? Object.fromEntries(
          Object.entries(allMetrics).filter(([key]) => this.trackMetrics?.includes(key))
        )
      : allMetrics;

    const sample: MetricsSample = {
      tick,
      timestamp,
      metrics,
    };

    this.samples.push(sample);
    this.lastSampleTick = tick;

    this.logger?.debug({ event: 'metrics:sample', tick, metrics }, 'Sampled metrics');
  }

  /**
   * Force a sample regardless of tick interval
   */
  forceSample(tick: number, timestamp: number, pack: Pack): void {
    const allMetrics = pack.getMetrics();

    const metrics = this.trackMetrics
      ? Object.fromEntries(
          Object.entries(allMetrics).filter(([key]) => this.trackMetrics?.includes(key))
        )
      : allMetrics;

    const sample: MetricsSample = {
      tick,
      timestamp,
      metrics,
    };

    this.samples.push(sample);
    this.lastSampleTick = tick;
  }

  /**
   * Get all collected samples
   */
  getSamples(): readonly MetricsSample[] {
    return this.samples;
  }

  /**
   * Get the most recent sample
   */
  getLatestSample(): MetricsSample | undefined {
    return this.samples[this.samples.length - 1];
  }

  /**
   * Get the final metrics (from most recent sample)
   */
  getFinalMetrics(): Record<string, number | bigint | string> {
    const latest = this.getLatestSample();
    return latest?.metrics ?? {};
  }

  /**
   * Convert samples to CSV format
   */
  toCSV(): string {
    if (this.samples.length === 0) {
      return 'tick,timestamp\n';
    }

    // Get all metric keys from first sample
    // biome-ignore lint/style/noNonNullAssertion: length check above
    const metricKeys = Object.keys(this.samples[0]!.metrics);
    const headers = ['tick', 'timestamp', ...metricKeys];

    const rows = this.samples.map((sample) => {
      const values = [
        sample.tick.toString(),
        sample.timestamp.toString(),
        ...metricKeys.map((key) => {
          const value = sample.metrics[key];
          if (value === undefined) return '';
          if (typeof value === 'bigint') return value.toString();
          return String(value);
        }),
      ];
      return values.join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Reset the collector for a new run
   */
  reset(): void {
    this.samples.length = 0;
    this.lastSampleTick = -1;
  }

  /**
   * Get summary statistics for a metric
   */
  getMetricStats(metricName: string): MetricStats | undefined {
    const values = this.samples
      .map((s) => s.metrics[metricName])
      .filter((v): v is number => typeof v === 'number');

    if (values.length === 0) {
      return undefined;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      mean: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)] ?? 0,
      count: values.length,
    };
  }
}

/**
 * Summary statistics for a metric
 */
export interface MetricStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  count: number;
}

/**
 * Create a metrics collector with default options
 */
export function createMetricsCollector(options?: MetricsCollectorOptions): MetricsCollector {
  return new MetricsCollector(options);
}

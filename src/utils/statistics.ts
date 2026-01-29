/**
 * Statistical Utilities
 *
 * Functions for calculating statistics, confidence intervals, and aggregating metrics.
 */

// ============================================
// Basic Statistics
// ============================================

/**
 * Statistical summary of a dataset
 */
export interface Statistics {
  count: number;
  mean: number;
  stdDev: number;
  variance: number;
  min: number;
  max: number;
  median: number;
  ci95Low: number;
  ci95High: number;
}

/**
 * Calculate comprehensive statistics for an array of numbers
 */
export function calculateStatistics(values: number[]): Statistics {
  const n = values.length;

  if (n === 0) {
    return {
      count: 0,
      mean: 0,
      stdDev: 0,
      variance: 0,
      min: 0,
      max: 0,
      median: 0,
      ci95Low: 0,
      ci95High: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);

  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  const median =
    n % 2 === 0 ? (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2 : sorted[Math.floor(n / 2)]!;

  // 95% confidence interval using t-distribution approximation
  const tValue = 1.96;
  const standardError = stdDev / Math.sqrt(n);
  const ci95Low = mean - tValue * standardError;
  const ci95High = mean + tValue * standardError;

  return {
    count: n,
    mean,
    stdDev,
    variance,
    min: sorted[0]!,
    max: sorted[n - 1]!,
    median,
    ci95Low,
    ci95High,
  };
}

/**
 * Calculate mean of an array
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map((v) => (v - avg) ** 2);
  return Math.sqrt(mean(squaredDiffs));
}

/**
 * Calculate median
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return n % 2 === 0 ? (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2 : sorted[Math.floor(n / 2)]!;
}

/**
 * Calculate percentile
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  if (p <= 0) return Math.min(...values);
  if (p >= 100) return Math.max(...values);

  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

// ============================================
// Confidence Intervals
// ============================================

/**
 * Confidence interval result
 */
export interface ConfidenceInterval {
  mean: number;
  lower: number;
  upper: number;
  marginOfError: number;
  confidenceLevel: number;
}

/**
 * Calculate confidence interval
 */
export function calculateConfidenceInterval(
  values: number[],
  confidenceLevel = 0.95
): ConfidenceInterval {
  const n = values.length;

  if (n === 0) {
    return {
      mean: 0,
      lower: 0,
      upper: 0,
      marginOfError: 0,
      confidenceLevel,
    };
  }

  const avg = mean(values);
  const stdDev = standardDeviation(values);
  const standardError = stdDev / Math.sqrt(n);

  // Z-score for common confidence levels
  let zScore: number;
  if (confidenceLevel >= 0.99) {
    zScore = 2.576;
  } else if (confidenceLevel >= 0.95) {
    zScore = 1.96;
  } else if (confidenceLevel >= 0.9) {
    zScore = 1.645;
  } else {
    zScore = 1.96;
  }

  const marginOfError = zScore * standardError;

  return {
    mean: avg,
    lower: avg - marginOfError,
    upper: avg + marginOfError,
    marginOfError,
    confidenceLevel,
  };
}

// ============================================
// Metric Aggregation
// ============================================

/**
 * Aggregated metrics from multiple runs
 */
export interface AggregatedMetrics {
  [key: string]: Statistics;
}

/**
 * Aggregate metrics from multiple runs
 */
export function aggregateMetrics(runs: Array<Record<string, number | bigint>>): AggregatedMetrics {
  const allKeys = new Set<string>();
  for (const run of runs) {
    for (const key of Object.keys(run)) {
      allKeys.add(key);
    }
  }

  const result: AggregatedMetrics = {};

  for (const key of allKeys) {
    const values: number[] = [];
    for (const run of runs) {
      const value = run[key];
      if (value !== undefined) {
        values.push(typeof value === 'bigint' ? Number(value) : value);
      }
    }
    result[key] = calculateStatistics(values);
  }

  return result;
}

// ============================================
// Rate Calculations
// ============================================

/**
 * Calculate success rate
 */
export function successRate(successes: number, total: number): number {
  if (total === 0) return 1;
  return successes / total;
}

/**
 * Calculate rate per unit time
 */
export function ratePerTime(count: number, timeMs: number, unitMs: number): number {
  if (timeMs === 0) return 0;
  return (count / timeMs) * unitMs;
}

/**
 * Calculate rate per tick
 */
export function ratePerTick(count: number, ticks: number): number {
  if (ticks === 0) return 0;
  return count / ticks;
}

// ============================================
// Moving Averages
// ============================================

/**
 * Calculate simple moving average
 */
export function simpleMovingAverage(values: number[], window: number): number[] {
  if (values.length === 0 || window <= 0) return [];

  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const windowValues = values.slice(start, i + 1);
    result.push(mean(windowValues));
  }

  return result;
}

/**
 * Calculate exponential moving average
 */
export function exponentialMovingAverage(values: number[], alpha = 0.3): number[] {
  if (values.length === 0) return [];

  const result: number[] = [values[0]!];
  for (let i = 1; i < values.length; i++) {
    const ema = alpha * values[i]! + (1 - alpha) * result[i - 1]!;
    result.push(ema);
  }

  return result;
}

/**
 * Utility exports
 */

export {
  type Statistics,
  type ConfidenceInterval,
  type AggregatedMetrics,
  calculateStatistics,
  mean,
  standardDeviation,
  median,
  percentile,
  calculateConfidenceInterval,
  aggregateMetrics,
  successRate,
  ratePerTime,
  ratePerTick,
  simpleMovingAverage,
  exponentialMovingAverage,
} from './statistics.js';

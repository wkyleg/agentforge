/**
 * Test Helpers
 *
 * Utilities for writing simulation tests.
 */

import type { Assertion, RunResult } from '../core/types.js';
import { successRate } from '../utils/statistics.js';

// ============================================
// Assertion Helpers
// ============================================

/**
 * Create a greater-than-or-equal assertion
 */
export function assertGte(metric: string, value: number, message?: string): Assertion {
  return {
    type: 'gte',
    metric,
    value,
    message: message ?? `Metric ${metric} should be >= ${value}`,
  };
}

/**
 * Create a less-than-or-equal assertion
 */
export function assertLte(metric: string, value: number, message?: string): Assertion {
  return {
    type: 'lte',
    metric,
    value,
    message: message ?? `Metric ${metric} should be <= ${value}`,
  };
}

/**
 * Create an equality assertion
 */
export function assertEqual(metric: string, value: number, message?: string): Assertion {
  return {
    type: 'eq',
    metric,
    value,
    message: message ?? `Metric ${metric} should equal ${value}`,
  };
}

/**
 * Create a not-equal assertion
 */
export function assertNotEqual(metric: string, value: number, message?: string): Assertion {
  return {
    type: 'neq',
    metric,
    value,
    message: message ?? `Metric ${metric} should not equal ${value}`,
  };
}

// ============================================
// Result Validation
// ============================================

/**
 * Validate that agent success rates meet a threshold
 */
export function assertAgentSuccess(
  result: RunResult,
  minSuccessRate = 0.8
): { passed: boolean; message: string } {
  const agents = result.agentStats;
  const failingAgents: string[] = [];

  for (const agent of agents) {
    const rate = successRate(agent.actionsSucceeded, agent.actionsAttempted);
    if (rate < minSuccessRate) {
      failingAgents.push(`${agent.id} (${Math.round(rate * 100)}%)`);
    }
  }

  if (failingAgents.length > 0) {
    return {
      passed: false,
      message: `Agents below ${Math.round(minSuccessRate * 100)}% success: ${failingAgents.join(', ')}`,
    };
  }

  return {
    passed: true,
    message: 'All agents above minimum success rate',
  };
}

/**
 * Validate economic metrics
 */
export function assertEconomics(
  result: RunResult,
  options: {
    minFees?: number;
    maxGas?: number;
    minAgentSuccessRate?: number;
  } = {}
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  if (options.minFees !== undefined) {
    const fees = result.finalMetrics.fees_collected_total;
    const feesNum = typeof fees === 'bigint' ? Number(fees) : Number(fees ?? 0);
    if (feesNum < options.minFees) {
      failures.push(`Fees ${feesNum} below minimum ${options.minFees}`);
    }
  }

  if (options.maxGas !== undefined) {
    const gas = result.finalMetrics.gas_total;
    const gasNum = typeof gas === 'bigint' ? Number(gas) : Number(gas ?? 0);
    if (gasNum > options.maxGas) {
      failures.push(`Gas ${gasNum} exceeds maximum ${options.maxGas}`);
    }
  }

  if (options.minAgentSuccessRate !== undefined) {
    const agentCheck = assertAgentSuccess(result, options.minAgentSuccessRate);
    if (!agentCheck.passed) {
      failures.push(agentCheck.message);
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

// ============================================
// Formatting Helpers
// ============================================

/**
 * Format a large number with K/M/B suffix
 */
export function formatNumber(value: number | bigint): string {
  const num = typeof value === 'bigint' ? Number(value) : value;

  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(2)}K`;
  }
  return num.toLocaleString();
}

/**
 * Format duration in ms to human readable
 */
export function formatDuration(ms: number): string {
  if (ms >= 3_600_000) {
    const hours = Math.floor(ms / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    return `${hours}h ${minutes}m`;
  }
  if (ms >= 60_000) {
    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.floor((ms % 60_000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
  if (ms >= 1_000) {
    return `${(ms / 1_000).toFixed(1)}s`;
  }
  return `${ms}ms`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

// ============================================
// Result Summary
// ============================================

/**
 * Generate a text summary of run results
 */
export function summarizeResult(result: RunResult): string {
  const lines: string[] = [];

  lines.push('=== Simulation Result ===');
  lines.push(`Status: ${result.success ? 'PASS' : 'FAIL'}`);
  lines.push(`Duration: ${formatDuration(result.durationMs)}`);
  lines.push(`Ticks: ${result.ticks ?? 'N/A'}`);
  lines.push('');

  // Agent stats
  lines.push('Agent Performance:');
  const totalAttempted = result.agentStats.reduce((s, a) => s + a.actionsAttempted, 0);
  const totalSucceeded = result.agentStats.reduce((s, a) => s + a.actionsSucceeded, 0);
  const overallRate = successRate(totalSucceeded, totalAttempted);
  lines.push(`  Total: ${totalSucceeded}/${totalAttempted} (${formatPercent(overallRate)})`);

  // Group by type
  const byType = new Map<string, { attempted: number; succeeded: number }>();
  for (const agent of result.agentStats) {
    const type = agent.id.split('-').slice(0, -1).join('-') || agent.id;
    const existing = byType.get(type) ?? { attempted: 0, succeeded: 0 };
    existing.attempted += agent.actionsAttempted;
    existing.succeeded += agent.actionsSucceeded;
    byType.set(type, existing);
  }

  for (const [type, stats] of byType) {
    const rate = successRate(stats.succeeded, stats.attempted);
    lines.push(`  ${type}: ${formatPercent(rate)}`);
  }

  lines.push('');

  // Key metrics
  lines.push('Key Metrics:');
  for (const key of ['app_count', 'fees_collected_total', 'veelta_total_locked', 'gas_total']) {
    const value = result.finalMetrics[key];
    if (value !== undefined) {
      const formatted = typeof value === 'bigint' ? formatNumber(value) : String(value);
      lines.push(`  ${key}: ${formatted}`);
    }
  }

  // Failed assertions
  if (result.failedAssertions.length > 0) {
    lines.push('');
    lines.push('Failed Assertions:');
    for (const assertion of result.failedAssertions) {
      lines.push(`  - ${assertion.message}`);
    }
  }

  return lines.join('\n');
}

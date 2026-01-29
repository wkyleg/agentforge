import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Parsed run artifacts
 */
export interface RunArtifacts {
  runDir: string;
  summary: RunSummary;
  config: ResolvedConfig;
  metrics: MetricsSample[];
  actions: RecordedAction[];
  hashes: ArtifactHashes;
}

/**
 * Summary.json structure
 */
export interface RunSummary {
  runId: string;
  scenarioName: string;
  seed: number;
  ticks: number;
  durationMs: number;
  success: boolean;
  failedAssertions: FailedAssertion[];
  finalMetrics: Record<string, number | string>;
  agentStats: AgentStats[];
  timestamp: string;
}

/**
 * Config resolved structure
 */
export interface ResolvedConfig {
  scenario: {
    name: string;
    seed: number;
    ticks: number;
    tickSeconds: number;
    packName: string;
    agentCount: number;
    agentTypes: Array<{ type: string; count: number }>;
    metrics?: { sampleEveryTicks: number; track?: string[] };
    assertions?: Array<{ type: string; metric: string; value: number | string }>;
  };
  options: {
    outDir?: string;
    ci?: boolean;
    verbose?: boolean;
  };
}

/**
 * Metrics sample from CSV
 */
export interface MetricsSample {
  tick: number;
  timestamp: number;
  [key: string]: number | string;
}

/**
 * Recorded action from NDJSON
 */
export interface RecordedAction {
  tick: number;
  timestamp: number;
  agentId: string;
  agentType: string;
  action: {
    id: string;
    name: string;
    params: Record<string, unknown>;
  } | null;
  result: {
    ok: boolean;
    error?: string;
    gasUsed?: string;
    txHash?: string;
  } | null;
  durationMs: number;
}

/**
 * Failed assertion
 */
export interface FailedAssertion {
  assertion: { type: string; metric: string; value: number | string };
  actualValue: number | string;
  message: string;
}

/**
 * Agent statistics
 */
export interface AgentStats {
  id: string;
  type: string;
  actionsAttempted: number;
  actionsSucceeded: number;
  actionsFailed: number;
}

/**
 * Artifact hashes for determinism fingerprint
 */
export interface ArtifactHashes {
  summary: string;
  config: string;
  metrics: string;
  actions: string;
}

/**
 * Metric statistics
 */
export interface MetricStats {
  min: number;
  max: number;
  mean: number;
  count: number;
}

/**
 * Action frequency entry
 */
export interface ActionFrequency {
  name: string;
  count: number;
  successCount: number;
  failureCount: number;
  successRate: number;
}

/**
 * Revert reason entry
 */
export interface RevertReason {
  error: string;
  count: number;
}

/**
 * Compute SHA256 hash of content
 */
export function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Compute SHA256 hash of a file
 */
export async function computeFileHash(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf-8');
  return computeHash(content);
}

/**
 * Parse a run directory and load all artifacts
 */
export async function parseRunArtifacts(runDir: string): Promise<RunArtifacts> {
  // Check if directory exists
  try {
    await stat(runDir);
  } catch {
    throw new Error(`Run directory not found: ${runDir}`);
  }

  // Load and parse each artifact
  const summaryPath = join(runDir, 'summary.json');
  const configPath = join(runDir, 'config_resolved.json');
  const metricsPath = join(runDir, 'metrics.csv');
  const actionsPath = join(runDir, 'actions.ndjson');

  const [summaryContent, configContent, metricsContent, actionsContent] = await Promise.all([
    readFile(summaryPath, 'utf-8'),
    readFile(configPath, 'utf-8'),
    readFile(metricsPath, 'utf-8'),
    readFile(actionsPath, 'utf-8'),
  ]);

  // Parse summary
  const summary = JSON.parse(summaryContent) as RunSummary;

  // Parse config
  const config = JSON.parse(configContent) as ResolvedConfig;

  // Parse metrics CSV
  const metrics = parseMetricsCSV(metricsContent);

  // Parse actions NDJSON
  const actions = parseActionsNDJSON(actionsContent);

  // Compute hashes
  const hashes: ArtifactHashes = {
    summary: computeHash(summaryContent),
    config: computeHash(configContent),
    metrics: computeHash(metricsContent),
    actions: computeHash(actionsContent),
  };

  return {
    runDir,
    summary,
    config,
    metrics,
    actions,
    hashes,
  };
}

/**
 * Parse metrics CSV into samples
 */
function parseMetricsCSV(content: string): MetricsSample[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  if (!firstLine) return [];

  const header = firstLine.split(',');
  const samples: MetricsSample[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const values = line.split(',');
    const sample: MetricsSample = { tick: 0, timestamp: 0 };

    for (let j = 0; j < header.length; j++) {
      const key = header[j];
      const value = values[j];
      if (!key) continue;
      // Try to parse as number
      const numValue = Number(value);
      sample[key] = Number.isNaN(numValue) ? (value ?? '') : numValue;
    }

    samples.push(sample);
  }

  return samples;
}

/**
 * Parse actions NDJSON into array
 */
function parseActionsNDJSON(content: string): RecordedAction[] {
  const lines = content.trim().split('\n');
  return lines.filter((line) => line.trim()).map((line) => JSON.parse(line) as RecordedAction);
}

/**
 * Compute statistics for a metric across samples
 */
export function computeMetricStats(
  samples: MetricsSample[],
  metricName: string
): MetricStats | null {
  const values = samples
    .map((s) => s[metricName])
    .filter((v): v is number => typeof v === 'number');

  if (values.length === 0) return null;

  const sum = values.reduce((a, b) => a + b, 0);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    mean: sum / values.length,
    count: values.length,
  };
}

/**
 * Compute action frequency statistics
 */
export function computeActionFrequencies(actions: RecordedAction[]): ActionFrequency[] {
  const freqMap = new Map<string, { count: number; success: number; failure: number }>();

  for (const action of actions) {
    if (!action.action) continue;
    const name = action.action.name;
    const entry = freqMap.get(name) || { count: 0, success: 0, failure: 0 };
    entry.count++;
    if (action.result?.ok) {
      entry.success++;
    } else {
      entry.failure++;
    }
    freqMap.set(name, entry);
  }

  return Array.from(freqMap.entries())
    .map(([name, stats]) => ({
      name,
      count: stats.count,
      successCount: stats.success,
      failureCount: stats.failure,
      successRate: stats.count > 0 ? stats.success / stats.count : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Compute revert reason frequencies
 */
export function computeRevertReasons(actions: RecordedAction[]): RevertReason[] {
  const reasonMap = new Map<string, number>();

  for (const action of actions) {
    if (action.result && !action.result.ok && action.result.error) {
      const error = action.result.error;
      reasonMap.set(error, (reasonMap.get(error) || 0) + 1);
    }
  }

  return Array.from(reasonMap.entries())
    .map(([error, count]) => ({ error, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Find the most expensive action (by gas)
 */
export function findMostExpensiveAction(actions: RecordedAction[]): RecordedAction | null {
  let maxGas = BigInt(0);
  let mostExpensive: RecordedAction | null = null;

  for (const action of actions) {
    if (action.result?.gasUsed) {
      const gas = BigInt(action.result.gasUsed);
      if (gas > maxGas) {
        maxGas = gas;
        mostExpensive = action;
      }
    }
  }

  return mostExpensive;
}

/**
 * Try to get git commit hash
 */
export async function getGitCommit(cwd: string): Promise<string | null> {
  try {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);
    const { stdout } = await execAsync('git rev-parse HEAD', { cwd });
    return stdout.trim().slice(0, 8);
  } catch {
    return null;
  }
}

/**
 * Format a number with appropriate precision
 */
export function formatNumber(value: number | string): string {
  if (typeof value === 'string') return value;
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toFixed(4);
}

/**
 * Format a percentage
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Generate a markdown report from artifacts
 */
export function generateMarkdownReport(artifacts: RunArtifacts, gitCommit?: string | null): string {
  const { summary, config, metrics, actions, hashes } = artifacts;

  const lines: string[] = [];

  // Header
  lines.push(`# Simulation Report: ${summary.scenarioName}`);
  lines.push('');

  // Run metadata
  lines.push('## Run Metadata');
  lines.push('');
  lines.push('| Property | Value |');
  lines.push('|----------|-------|');
  lines.push(`| Run ID | \`${summary.runId}\` |`);
  lines.push(`| Scenario | ${summary.scenarioName} |`);
  lines.push(`| Seed | ${summary.seed} |`);
  lines.push(`| Ticks | ${summary.ticks} |`);
  lines.push(`| Tick Duration | ${config.scenario.tickSeconds}s |`);
  lines.push(`| Total Agents | ${config.scenario.agentCount} |`);
  lines.push(`| Duration | ${summary.durationMs}ms |`);
  lines.push(`| Status | ${summary.success ? 'PASSED' : 'FAILED'} |`);
  lines.push(`| Timestamp | ${summary.timestamp} |`);
  if (gitCommit) {
    lines.push(`| Git Commit | \`${gitCommit}\` |`);
  }
  lines.push('');

  // Agent types
  lines.push('### Agent Configuration');
  lines.push('');
  lines.push('| Type | Count |');
  lines.push('|------|-------|');
  for (const agent of config.scenario.agentTypes) {
    lines.push(`| ${agent.type} | ${agent.count} |`);
  }
  lines.push('');

  // KPI Summary
  lines.push('## KPI Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  for (const [key, value] of Object.entries(summary.finalMetrics)) {
    lines.push(`| ${key} | ${formatNumber(value)} |`);
  }
  lines.push('');

  // Time-series statistics
  const firstMetric = metrics[0];
  if (metrics.length > 0 && firstMetric) {
    lines.push('## Time-Series Statistics');
    lines.push('');

    // Get all metric keys (excluding tick and timestamp)
    const metricKeys = Object.keys(firstMetric).filter((k) => k !== 'tick' && k !== 'timestamp');

    if (metricKeys.length > 0) {
      lines.push('| Metric | Min | Max | Mean |');
      lines.push('|--------|-----|-----|------|');

      for (const key of metricKeys) {
        const stats = computeMetricStats(metrics, key);
        if (stats) {
          lines.push(
            `| ${key} | ${formatNumber(stats.min)} | ${formatNumber(stats.max)} | ${formatNumber(stats.mean)} |`
          );
        }
      }
      lines.push('');
    }
  }

  // Agent Statistics
  lines.push('## Agent Statistics');
  lines.push('');
  lines.push('| Agent | Type | Attempted | Succeeded | Failed | Success Rate |');
  lines.push('|-------|------|-----------|-----------|--------|--------------|');
  for (const agent of summary.agentStats) {
    const successRate =
      agent.actionsAttempted > 0 ? agent.actionsSucceeded / agent.actionsAttempted : 1;
    lines.push(
      `| ${agent.id} | ${agent.type} | ${agent.actionsAttempted} | ${agent.actionsSucceeded} | ${agent.actionsFailed} | ${formatPercent(successRate)} |`
    );
  }
  lines.push('');

  // Action Analysis
  lines.push('## Action Analysis');
  lines.push('');

  const frequencies = computeActionFrequencies(actions);
  if (frequencies.length > 0) {
    lines.push('### Action Frequencies');
    lines.push('');
    lines.push('| Action | Count | Success | Failed | Success Rate |');
    lines.push('|--------|-------|---------|--------|--------------|');
    for (const freq of frequencies) {
      lines.push(
        `| ${freq.name} | ${freq.count} | ${freq.successCount} | ${freq.failureCount} | ${formatPercent(freq.successRate)} |`
      );
    }
    lines.push('');
  }

  // Revert reasons
  const reverts = computeRevertReasons(actions);
  if (reverts.length > 0) {
    lines.push('### Revert Reasons');
    lines.push('');
    lines.push('| Error | Count |');
    lines.push('|-------|-------|');
    for (const revert of reverts.slice(0, 10)) {
      lines.push(`| ${revert.error} | ${revert.count} |`);
    }
    lines.push('');
  }

  // Most expensive action
  const mostExpensive = findMostExpensiveAction(actions);
  if (mostExpensive?.result?.gasUsed) {
    lines.push('### Notable Actions');
    lines.push('');
    lines.push(`**Most Expensive Transaction:** ${mostExpensive.action?.name || 'unknown'}`);
    lines.push(`- Gas Used: ${mostExpensive.result.gasUsed}`);
    lines.push(`- Agent: ${mostExpensive.agentId}`);
    lines.push(`- Tick: ${mostExpensive.tick}`);
    lines.push('');
  }

  // Failed assertions
  if (summary.failedAssertions.length > 0) {
    lines.push('## Failed Assertions');
    lines.push('');
    for (const failure of summary.failedAssertions) {
      lines.push(`- **${failure.assertion.metric}**: ${failure.message}`);
    }
    lines.push('');
  }

  // Determinism fingerprint
  lines.push('## Determinism Fingerprint');
  lines.push('');
  lines.push('These hashes can be used to verify identical runs:');
  lines.push('');
  lines.push('```');
  lines.push(`config:  ${hashes.config}`);
  lines.push(`metrics: ${hashes.metrics}`);
  lines.push(`actions: ${hashes.actions}`);
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

/**
 * Compare two runs and generate comparison data
 */
export interface RunComparison {
  runA: RunArtifacts;
  runB: RunArtifacts;
  metadataDiffs: Array<{ field: string; valueA: string; valueB: string }>;
  kpiDiffs: Array<{
    metric: string;
    valueA: number | string;
    valueB: number | string;
    delta: number | string;
    percentChange: string;
  }>;
  actionFreqDiffs: Array<{
    action: string;
    countA: number;
    countB: number;
    delta: number;
  }>;
  revertDiffs: Array<{
    error: string;
    countA: number;
    countB: number;
    delta: number;
  }>;
}

/**
 * Compare two runs
 */
export function compareRuns(runA: RunArtifacts, runB: RunArtifacts): RunComparison {
  // Metadata diffs
  const metadataDiffs: RunComparison['metadataDiffs'] = [];

  if (runA.summary.seed !== runB.summary.seed) {
    metadataDiffs.push({
      field: 'seed',
      valueA: String(runA.summary.seed),
      valueB: String(runB.summary.seed),
    });
  }
  if (runA.summary.ticks !== runB.summary.ticks) {
    metadataDiffs.push({
      field: 'ticks',
      valueA: String(runA.summary.ticks),
      valueB: String(runB.summary.ticks),
    });
  }
  if (runA.config.scenario.tickSeconds !== runB.config.scenario.tickSeconds) {
    metadataDiffs.push({
      field: 'tickSeconds',
      valueA: String(runA.config.scenario.tickSeconds),
      valueB: String(runB.config.scenario.tickSeconds),
    });
  }

  // KPI diffs
  const allMetrics = new Set([
    ...Object.keys(runA.summary.finalMetrics),
    ...Object.keys(runB.summary.finalMetrics),
  ]);

  const kpiDiffs: RunComparison['kpiDiffs'] = [];
  for (const metric of allMetrics) {
    const valueA = runA.summary.finalMetrics[metric] ?? 0;
    const valueB = runB.summary.finalMetrics[metric] ?? 0;

    const numA = typeof valueA === 'string' ? Number.parseFloat(valueA) || 0 : valueA;
    const numB = typeof valueB === 'string' ? Number.parseFloat(valueB) || 0 : valueB;

    const delta = numB - numA;
    const percentChange =
      numA !== 0 ? ((numB - numA) / Math.abs(numA)) * 100 : numB !== 0 ? 100 : 0;

    kpiDiffs.push({
      metric,
      valueA,
      valueB,
      delta,
      percentChange: `${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(1)}%`,
    });
  }

  // Action frequency diffs
  const freqA = computeActionFrequencies(runA.actions);
  const freqB = computeActionFrequencies(runB.actions);
  const freqMapA = new Map(freqA.map((f) => [f.name, f.count]));
  const freqMapB = new Map(freqB.map((f) => [f.name, f.count]));

  const allActions = new Set([...freqMapA.keys(), ...freqMapB.keys()]);
  const actionFreqDiffs: RunComparison['actionFreqDiffs'] = [];

  for (const action of allActions) {
    const countA = freqMapA.get(action) || 0;
    const countB = freqMapB.get(action) || 0;
    actionFreqDiffs.push({
      action,
      countA,
      countB,
      delta: countB - countA,
    });
  }

  // Revert diffs
  const revertsA = computeRevertReasons(runA.actions);
  const revertsB = computeRevertReasons(runB.actions);
  const revertMapA = new Map(revertsA.map((r) => [r.error, r.count]));
  const revertMapB = new Map(revertsB.map((r) => [r.error, r.count]));

  const allReverts = new Set([...revertMapA.keys(), ...revertMapB.keys()]);
  const revertDiffs: RunComparison['revertDiffs'] = [];

  for (const error of allReverts) {
    const countA = revertMapA.get(error) || 0;
    const countB = revertMapB.get(error) || 0;
    revertDiffs.push({
      error,
      countA,
      countB,
      delta: countB - countA,
    });
  }

  return {
    runA,
    runB,
    metadataDiffs,
    kpiDiffs,
    actionFreqDiffs,
    revertDiffs,
  };
}

/**
 * Generate comparison markdown report
 */
export function generateCompareReport(comparison: RunComparison): string {
  const { runA, runB, metadataDiffs, kpiDiffs, actionFreqDiffs, revertDiffs } = comparison;
  const lines: string[] = [];

  lines.push('# Run Comparison Report');
  lines.push('');
  lines.push(`Comparing **${runA.summary.runId}** (A) vs **${runB.summary.runId}** (B)`);
  lines.push('');

  // Metadata comparison
  lines.push('## Metadata');
  lines.push('');
  lines.push('| Property | Run A | Run B |');
  lines.push('|----------|-------|-------|');
  lines.push(`| Scenario | ${runA.summary.scenarioName} | ${runB.summary.scenarioName} |`);
  lines.push(`| Seed | ${runA.summary.seed} | ${runB.summary.seed} |`);
  lines.push(`| Ticks | ${runA.summary.ticks} | ${runB.summary.ticks} |`);
  lines.push(`| Duration | ${runA.summary.durationMs}ms | ${runB.summary.durationMs}ms |`);
  lines.push(
    `| Status | ${runA.summary.success ? 'PASSED' : 'FAILED'} | ${runB.summary.success ? 'PASSED' : 'FAILED'} |`
  );
  lines.push('');

  if (metadataDiffs.length > 0) {
    lines.push('### Configuration Differences');
    lines.push('');
    for (const diff of metadataDiffs) {
      lines.push(`- **${diff.field}**: ${diff.valueA} -> ${diff.valueB}`);
    }
    lines.push('');
  }

  // KPI comparison
  lines.push('## KPI Comparison');
  lines.push('');
  lines.push('| Metric | Run A | Run B | Delta | Change |');
  lines.push('|--------|-------|-------|-------|--------|');
  for (const kpi of kpiDiffs) {
    const deltaStr = typeof kpi.delta === 'number' ? formatNumber(kpi.delta) : kpi.delta;
    lines.push(
      `| ${kpi.metric} | ${formatNumber(kpi.valueA)} | ${formatNumber(kpi.valueB)} | ${deltaStr} | ${kpi.percentChange} |`
    );
  }
  lines.push('');

  // Action frequency comparison
  if (actionFreqDiffs.length > 0) {
    lines.push('## Action Frequency Comparison');
    lines.push('');
    lines.push('| Action | Run A | Run B | Delta |');
    lines.push('|--------|-------|-------|-------|');
    for (const diff of actionFreqDiffs) {
      const deltaStr = diff.delta > 0 ? `+${diff.delta}` : String(diff.delta);
      lines.push(`| ${diff.action} | ${diff.countA} | ${diff.countB} | ${deltaStr} |`);
    }
    lines.push('');
  }

  // Revert comparison
  if (revertDiffs.length > 0) {
    lines.push('## Revert Reason Comparison');
    lines.push('');
    lines.push('| Error | Run A | Run B | Delta |');
    lines.push('|-------|-------|-------|-------|');
    for (const diff of revertDiffs.slice(0, 10)) {
      const deltaStr = diff.delta > 0 ? `+${diff.delta}` : String(diff.delta);
      lines.push(`| ${diff.error} | ${diff.countA} | ${diff.countB} | ${deltaStr} |`);
    }
    lines.push('');
  }

  // Verdict
  lines.push('## Verdict');
  lines.push('');

  const significantChanges = kpiDiffs.filter((k) => {
    if (typeof k.delta !== 'number') return false;
    const pct = Number.parseFloat(k.percentChange);
    return Math.abs(pct) > 10;
  });

  if (significantChanges.length > 0) {
    lines.push('**Significant changes detected (>10%):**');
    lines.push('');
    for (const change of significantChanges) {
      lines.push(`- ${change.metric}: ${change.percentChange}`);
    }
  } else {
    lines.push('No significant changes detected (all metrics within 10%).');
  }
  lines.push('');

  // Fingerprint comparison
  lines.push('## Determinism Check');
  lines.push('');
  const hashesMatch =
    runA.hashes.actions === runB.hashes.actions &&
    runA.hashes.metrics === runB.hashes.metrics &&
    runA.hashes.config === runB.hashes.config;

  if (hashesMatch) {
    lines.push('Artifact hashes are **identical** - runs are deterministically equivalent.');
  } else {
    lines.push('Artifact hashes **differ** - runs produced different results.');
    lines.push('');
    lines.push('| Artifact | Match |');
    lines.push('|----------|-------|');
    lines.push(`| config | ${runA.hashes.config === runB.hashes.config ? 'Yes' : 'No'} |`);
    lines.push(`| metrics | ${runA.hashes.metrics === runB.hashes.metrics ? 'Yes' : 'No'} |`);
    lines.push(`| actions | ${runA.hashes.actions === runB.hashes.actions ? 'Yes' : 'No'} |`);
  }
  lines.push('');

  return lines.join('\n');
}

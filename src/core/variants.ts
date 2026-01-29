import type { Pack, Scenario } from './types.js';

/**
 * A variant defines an alternative configuration for a scenario
 */
export interface Variant {
  /** Unique name for this variant */
  name: string;
  /** Description of what this variant tests */
  description?: string;
  /** Custom pack for this variant (replaces scenario pack) */
  pack?: Pack;
  /** Scenario overrides (merged with base scenario) */
  overrides?: Partial<Omit<Scenario, 'pack'>>;
}

/**
 * A variants file exports an array of variants
 */
export interface VariantsFile {
  /** Reference to base scenario (path or name) */
  baseScenario?: string;
  /** Array of variant configurations */
  variants: Variant[];
}

/**
 * Result of a single variant run
 */
export interface VariantRunResult {
  /** Variant name */
  variantName: string;
  /** Seed used */
  seed: number;
  /** Whether run succeeded */
  success: boolean;
  /** Final metrics */
  finalMetrics: Record<string, number | bigint | string>;
  /** Duration in ms */
  durationMs: number;
  /** Output directory */
  outputDir: string;
}

/**
 * Result of running all variants
 */
export interface MatrixResult {
  /** Base scenario name */
  scenarioName: string;
  /** Seeds used */
  seeds: number[];
  /** Results per variant */
  variantResults: Map<string, VariantRunResult[]>;
  /** Total duration */
  durationMs: number;
}

/**
 * Apply a variant to a base scenario
 */
export function applyVariant(scenario: Scenario, variant: Variant): Scenario {
  return {
    ...scenario,
    ...variant.overrides,
    name: `${scenario.name}-${variant.name}`,
    pack: variant.pack ?? scenario.pack,
  };
}

/**
 * Parse a variants file
 */
export async function loadVariants(fileUrl: string): Promise<Variant[]> {
  const module = await import(fileUrl);

  // Support both default export and named export
  if (Array.isArray(module.default)) {
    return module.default as Variant[];
  }

  if (module.variants && Array.isArray(module.variants)) {
    return module.variants as Variant[];
  }

  throw new Error('Variants file must export an array of variants as default or named "variants"');
}

/**
 * Compare two variant results
 */
export interface VariantComparison {
  variantA: string;
  variantB: string;
  metricDiffs: Array<{
    metric: string;
    valueA: number;
    valueB: number;
    delta: number;
    percentChange: number;
  }>;
}

/**
 * Generate pairwise comparisons between variants
 */
export function compareVariants(results: Map<string, VariantRunResult[]>): VariantComparison[] {
  const comparisons: VariantComparison[] = [];
  const variantNames = Array.from(results.keys());

  for (let i = 0; i < variantNames.length; i++) {
    for (let j = i + 1; j < variantNames.length; j++) {
      const nameA = variantNames[i];
      const nameB = variantNames[j];

      if (!nameA || !nameB) continue;

      const resultsA = results.get(nameA) ?? [];
      const resultsB = results.get(nameB) ?? [];

      if (resultsA.length === 0 || resultsB.length === 0) continue;

      // Average metrics across seeds
      const avgA = averageMetrics(resultsA);
      const avgB = averageMetrics(resultsB);

      const allMetrics = new Set([...Object.keys(avgA), ...Object.keys(avgB)]);
      const metricDiffs: VariantComparison['metricDiffs'] = [];

      for (const metric of allMetrics) {
        const valueA = avgA[metric] ?? 0;
        const valueB = avgB[metric] ?? 0;
        const delta = valueB - valueA;
        const percentChange =
          valueA !== 0 ? (delta / Math.abs(valueA)) * 100 : valueB !== 0 ? 100 : 0;

        metricDiffs.push({ metric, valueA, valueB, delta, percentChange });
      }

      comparisons.push({ variantA: nameA, variantB: nameB, metricDiffs });
    }
  }

  return comparisons;
}

/**
 * Average metrics across multiple runs
 */
function averageMetrics(results: VariantRunResult[]): Record<string, number> {
  if (results.length === 0) return {};

  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};

  for (const result of results) {
    for (const [key, value] of Object.entries(result.finalMetrics)) {
      const numValue = typeof value === 'number' ? value : Number.parseFloat(String(value));
      if (!Number.isNaN(numValue)) {
        sums[key] = (sums[key] ?? 0) + numValue;
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
  }

  const averages: Record<string, number> = {};
  for (const key of Object.keys(sums)) {
    const sumVal = sums[key];
    const countVal = counts[key];
    if (sumVal !== undefined && countVal !== undefined && countVal > 0) {
      averages[key] = sumVal / countVal;
    }
  }

  return averages;
}

/**
 * Generate a matrix report
 */
export function generateMatrixReport(
  scenarioName: string,
  results: Map<string, VariantRunResult[]>,
  comparisons: VariantComparison[]
): string {
  const lines: string[] = [];

  lines.push(`# Matrix Report: ${scenarioName}`);
  lines.push('');

  // Summary
  lines.push('## Variants Summary');
  lines.push('');
  lines.push('| Variant | Runs | Passed | Failed | Avg Duration |');
  lines.push('|---------|------|--------|--------|--------------|');

  for (const [name, variantResults] of results) {
    const passed = variantResults.filter((r) => r.success).length;
    const failed = variantResults.length - passed;
    const avgDuration =
      variantResults.reduce((sum, r) => sum + r.durationMs, 0) / variantResults.length;
    lines.push(
      `| ${name} | ${variantResults.length} | ${passed} | ${failed} | ${avgDuration.toFixed(0)}ms |`
    );
  }
  lines.push('');

  // Per-variant metrics
  lines.push('## Variant Metrics (Averaged)');
  lines.push('');

  const variantNames = Array.from(results.keys());
  const allMetrics = new Set<string>();
  for (const variantResults of results.values()) {
    for (const result of variantResults) {
      for (const key of Object.keys(result.finalMetrics)) {
        allMetrics.add(key);
      }
    }
  }

  if (allMetrics.size > 0) {
    const header = ['Metric', ...variantNames].join(' | ');
    lines.push(`| ${header} |`);
    lines.push(`| ${['-------', ...variantNames.map(() => '-------')].join(' | ')} |`);

    for (const metric of allMetrics) {
      const values = variantNames.map((name) => {
        const variantResults = results.get(name) ?? [];
        const avg = averageMetrics(variantResults);
        const value = avg[metric];
        return value !== undefined ? value.toFixed(2) : '-';
      });
      lines.push(`| ${metric} | ${values.join(' | ')} |`);
    }
    lines.push('');
  }

  // Pairwise comparisons
  if (comparisons.length > 0) {
    lines.push('## Pairwise Comparisons');
    lines.push('');

    for (const comparison of comparisons) {
      lines.push(`### ${comparison.variantA} vs ${comparison.variantB}`);
      lines.push('');
      lines.push('| Metric | A | B | Delta | Change |');
      lines.push('|--------|---|---|-------|--------|');

      for (const diff of comparison.metricDiffs) {
        const changeStr = `${diff.percentChange >= 0 ? '+' : ''}${diff.percentChange.toFixed(1)}%`;
        lines.push(
          `| ${diff.metric} | ${diff.valueA.toFixed(2)} | ${diff.valueB.toFixed(2)} | ${diff.delta.toFixed(2)} | ${changeStr} |`
        );
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

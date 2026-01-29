import { describe, expect, it } from 'vitest';
import { NoOpAgent } from '../../src/core/agent.js';
import type { Scenario } from '../../src/core/types.js';
import {
  type Variant,
  type VariantComparison,
  type VariantRunResult,
  applyVariant,
  compareVariants,
  generateMatrixReport,
} from '../../src/core/variants.js';
import { createMockPack } from '../mocks/index.js';

describe('Variants', () => {
  describe('applyVariant', () => {
    it('merges variant name with scenario name', () => {
      const scenario = createMockScenario();
      const variant: Variant = { name: 'modified' };

      const result = applyVariant(scenario, variant);

      expect(result.name).toBe('test-scenario-modified');
    });

    it('applies variant overrides', () => {
      const scenario = createMockScenario();
      const variant: Variant = {
        name: 'fast',
        overrides: {
          ticks: 50,
          tickSeconds: 1800,
        },
      };

      const result = applyVariant(scenario, variant);

      expect(result.ticks).toBe(50);
      expect(result.tickSeconds).toBe(1800);
    });

    it('replaces pack when variant provides one', () => {
      const scenario = createMockScenario();
      const newPack = createMockPack();
      const variant: Variant = {
        name: 'new-pack',
        pack: newPack,
      };

      const result = applyVariant(scenario, variant);

      expect(result.pack).toBe(newPack);
    });

    it('preserves original pack when variant does not provide one', () => {
      const scenario = createMockScenario();
      const originalPack = scenario.pack;
      const variant: Variant = { name: 'no-pack' };

      const result = applyVariant(scenario, variant);

      expect(result.pack).toBe(originalPack);
    });

    it('preserves original scenario when no overrides', () => {
      const scenario = createMockScenario();
      const variant: Variant = { name: 'unchanged' };

      const result = applyVariant(scenario, variant);

      expect(result.seed).toBe(scenario.seed);
      expect(result.ticks).toBe(scenario.ticks);
      expect(result.agents).toBe(scenario.agents);
    });
  });

  describe('compareVariants', () => {
    it('generates pairwise comparisons', () => {
      const results = new Map<string, VariantRunResult[]>();
      results.set('variantA', [createMockResult('variantA', 1, { volume: 100 })]);
      results.set('variantB', [createMockResult('variantB', 1, { volume: 200 })]);
      results.set('variantC', [createMockResult('variantC', 1, { volume: 150 })]);

      const comparisons = compareVariants(results);

      // Should have 3 pairwise comparisons: A-B, A-C, B-C
      expect(comparisons).toHaveLength(3);
    });

    it('skips variants with no results', () => {
      const results = new Map<string, VariantRunResult[]>();
      results.set('variantA', [createMockResult('variantA', 1, { volume: 100 })]);
      results.set('variantB', []);

      const comparisons = compareVariants(results);

      expect(comparisons).toHaveLength(0);
    });

    it('computes correct metric diffs', () => {
      const results = new Map<string, VariantRunResult[]>();
      results.set('baseline', [createMockResult('baseline', 1, { volume: 100 })]);
      results.set('modified', [createMockResult('modified', 1, { volume: 120 })]);

      const comparisons = compareVariants(results);

      expect(comparisons).toHaveLength(1);
      const comparison = comparisons[0];
      expect(comparison?.variantA).toBe('baseline');
      expect(comparison?.variantB).toBe('modified');

      const volumeDiff = comparison?.metricDiffs.find((d) => d.metric === 'volume');
      expect(volumeDiff?.valueA).toBe(100);
      expect(volumeDiff?.valueB).toBe(120);
      expect(volumeDiff?.delta).toBe(20);
      expect(volumeDiff?.percentChange).toBe(20); // 20%
    });

    it('handles metrics present in only one variant', () => {
      const results = new Map<string, VariantRunResult[]>();
      results.set('A', [createMockResult('A', 1, { common: 100, onlyA: 50 })]);
      results.set('B', [createMockResult('B', 1, { common: 100, onlyB: 75 })]);

      const comparisons = compareVariants(results);
      const metricDiffs = comparisons[0]?.metricDiffs ?? [];

      const onlyADiff = metricDiffs.find((d) => d.metric === 'onlyA');
      const onlyBDiff = metricDiffs.find((d) => d.metric === 'onlyB');

      expect(onlyADiff?.valueA).toBe(50);
      expect(onlyADiff?.valueB).toBe(0);
      expect(onlyBDiff?.valueA).toBe(0);
      expect(onlyBDiff?.valueB).toBe(75);
    });

    it('averages metrics across multiple seeds', () => {
      const results = new Map<string, VariantRunResult[]>();
      results.set('A', [
        createMockResult('A', 1, { volume: 100 }),
        createMockResult('A', 2, { volume: 200 }),
      ]);
      results.set('B', [
        createMockResult('B', 1, { volume: 150 }),
        createMockResult('B', 2, { volume: 150 }),
      ]);

      const comparisons = compareVariants(results);
      const volumeDiff = comparisons[0]?.metricDiffs.find((d) => d.metric === 'volume');

      // A average: (100 + 200) / 2 = 150
      // B average: (150 + 150) / 2 = 150
      expect(volumeDiff?.valueA).toBe(150);
      expect(volumeDiff?.valueB).toBe(150);
    });
  });

  describe('generateMatrixReport', () => {
    it('generates valid markdown structure', () => {
      const results = new Map<string, VariantRunResult[]>();
      results.set('baseline', [createMockResult('baseline', 1, { volume: 100 })]);
      results.set('modified', [createMockResult('modified', 1, { volume: 120 })]);

      const comparisons = compareVariants(results);
      const report = generateMatrixReport('test-scenario', results, comparisons);

      expect(report).toContain('# Matrix Report: test-scenario');
      expect(report).toContain('## Variants Summary');
      expect(report).toContain('## Variant Metrics (Averaged)');
      expect(report).toContain('## Pairwise Comparisons');
    });

    it('includes variant summary table', () => {
      const results = new Map<string, VariantRunResult[]>();
      results.set('baseline', [
        createMockResult('baseline', 1, {}, true),
        createMockResult('baseline', 2, {}, false),
      ]);

      const report = generateMatrixReport('test', results, []);

      expect(report).toContain('baseline');
      expect(report).toContain('2'); // Total runs
      expect(report).toContain('1'); // Passed
    });

    it('handles empty results', () => {
      const results = new Map<string, VariantRunResult[]>();
      const report = generateMatrixReport('empty-test', results, []);

      expect(report).toContain('# Matrix Report: empty-test');
    });

    it('shows metric comparison table', () => {
      const results = new Map<string, VariantRunResult[]>();
      results.set('A', [createMockResult('A', 1, { volume: 100, price: 50 })]);
      results.set('B', [createMockResult('B', 1, { volume: 200, price: 75 })]);

      const comparisons = compareVariants(results);
      const report = generateMatrixReport('test', results, comparisons);

      expect(report).toContain('volume');
      expect(report).toContain('price');
      expect(report).toContain('100.00');
      expect(report).toContain('200.00');
    });

    it('includes pairwise comparison details', () => {
      const results = new Map<string, VariantRunResult[]>();
      results.set('baseline', [createMockResult('baseline', 1, { volume: 100 })]);
      results.set('modified', [createMockResult('modified', 1, { volume: 200 })]);

      const comparisons = compareVariants(results);
      const report = generateMatrixReport('test', results, comparisons);

      expect(report).toContain('### baseline vs modified');
      expect(report).toContain('+100.0%'); // 100% increase
    });
  });
});

// Helper functions

function createMockScenario(): Scenario {
  return {
    name: 'test-scenario',
    seed: 42,
    ticks: 100,
    tickSeconds: 3600,
    pack: createMockPack(),
    agents: [{ type: NoOpAgent, count: 1 }],
  };
}

function createMockResult(
  variantName: string,
  seed: number,
  metrics: Record<string, number> = {},
  success = true
): VariantRunResult {
  return {
    variantName,
    seed,
    success,
    finalMetrics: metrics,
    durationMs: 100,
    outputDir: `/test/${variantName}`,
  };
}

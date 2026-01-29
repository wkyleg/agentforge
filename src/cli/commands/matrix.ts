import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Command } from 'commander';
import { SimulationEngine } from '../../core/engine.js';
import { createLogger } from '../../core/logging.js';
import { loadScenario } from '../../core/scenario.js';
import {
  type Variant,
  type VariantRunResult,
  applyVariant,
  compareVariants,
  generateMatrixReport,
  loadVariants,
} from '../../core/variants.js';
import { output } from '../ui/output.js';

/**
 * Parse seed range (same as sweep command)
 */
function parseSeedRange(seedArg: string): number[] {
  const rangeMatch = seedArg.match(/^(\d+)\.\.(\d+)$/);
  if (rangeMatch?.[1] && rangeMatch[2]) {
    const start = Number.parseInt(rangeMatch[1], 10);
    const end = Number.parseInt(rangeMatch[2], 10);
    const seeds: number[] = [];
    for (let i = start; i <= end; i++) {
      seeds.push(i);
    }
    return seeds;
  }

  if (seedArg.includes(',')) {
    return seedArg.split(',').map((s) => Number.parseInt(s.trim(), 10));
  }

  const count = Number.parseInt(seedArg, 10);
  if (!Number.isNaN(count) && count > 0) {
    const seeds: number[] = [];
    for (let i = 1; i <= count; i++) {
      seeds.push(i);
    }
    return seeds;
  }

  throw new Error(`Invalid seed format: ${seedArg}`);
}

/**
 * Matrix command - run scenario with multiple variants
 */
export const matrixCommand = new Command('matrix')
  .description('Run a scenario with multiple variants and compare results')
  .argument('<scenario>', 'Path to scenario file (.ts)')
  .option('--variants <file>', 'Path to variants file (.ts)', 'variants.ts')
  .option('--seeds <range>', 'Seed range for each variant (e.g., "1..5", "42")', '42')
  .option('-t, --ticks <number>', 'Override number of ticks', Number.parseInt)
  .option('-o, --out <path>', 'Output directory for matrix results', 'sim/results/matrix')
  .option('--ci', 'CI mode (no colors, strict exit codes)')
  .option('-v, --verbose', 'Verbose output')
  .option('--json', 'Output results as JSON')
  .action(async (scenarioPath, options) => {
    const ci = options.ci || process.env.CI === 'true';
    const jsonOutput = options.json;
    const suppressOutput = jsonOutput;
    const startTime = Date.now();

    try {
      // Parse seeds
      const seeds = parseSeedRange(options.seeds);

      // Load base scenario
      const fullScenarioPath = isAbsolute(scenarioPath)
        ? scenarioPath
        : resolve(process.cwd(), scenarioPath);
      const scenarioUrl = pathToFileURL(fullScenarioPath).href;
      const baseScenario = await loadScenario(scenarioUrl);

      if (!suppressOutput) {
        output.header(`Matrix: ${baseScenario.name}`);
        output.newline();
        output.info(`Base scenario: ${baseScenario.name}`);
      }

      // Load variants
      const variantsPath = isAbsolute(options.variants)
        ? options.variants
        : resolve(process.cwd(), options.variants);

      let variants: Variant[];
      try {
        const variantsUrl = pathToFileURL(variantsPath).href;
        variants = await loadVariants(variantsUrl);
      } catch {
        // If variants file not found, create default variants from scenario
        variants = [{ name: 'baseline', description: 'Base scenario without modifications' }];
        if (!suppressOutput) {
          output.info('No variants file found, using baseline only');
        }
      }

      if (!suppressOutput) {
        output.config('Variants', String(variants.length));
        output.config('Seeds per variant', String(seeds.length));
        output.config('Total runs', String(variants.length * seeds.length));
        output.newline();
      }

      // Create output directory
      const outDir = isAbsolute(options.out) ? options.out : resolve(process.cwd(), options.out);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const matrixDir = join(outDir, `${baseScenario.name}-${timestamp}`);
      await mkdir(matrixDir, { recursive: true });

      // Create logger
      const logger = createLogger({
        level: options.verbose ? 'debug' : 'warn',
        ci,
      });

      // Run each variant
      const results = new Map<string, VariantRunResult[]>();

      for (const variant of variants) {
        if (!suppressOutput) {
          output.subheader(`Running variant: ${variant.name}`);
          if (variant.description) {
            output.info(variant.description);
          }
        }

        const variantScenario = applyVariant(baseScenario, variant);
        const variantResults: VariantRunResult[] = [];
        const variantDir = join(matrixDir, variant.name);
        await mkdir(variantDir, { recursive: true });

        for (const seed of seeds) {
          const engine = new SimulationEngine({ logger });
          const result = await engine.run(variantScenario, {
            seed,
            ticks: options.ticks ?? baseScenario.ticks,
            outDir: variantDir,
            ci: true,
          });

          variantResults.push({
            variantName: variant.name,
            seed,
            success: result.success,
            finalMetrics: result.finalMetrics,
            durationMs: result.durationMs,
            outputDir: result.outputDir,
          });

          if (!suppressOutput) {
            const status = result.success ? 'PASS' : 'FAIL';
            output.info(`  Seed ${seed}: ${status} (${result.durationMs}ms)`);
          }
        }

        results.set(variant.name, variantResults);
      }

      // Generate comparisons
      const comparisons = compareVariants(results);

      // Generate matrix report
      const report = generateMatrixReport(baseScenario.name, results, comparisons);
      await writeFile(join(matrixDir, 'report.md'), report);

      // Generate summary CSV
      const csvLines: string[] = [];
      const allMetrics = new Set<string>();
      for (const variantResults of results.values()) {
        for (const result of variantResults) {
          for (const key of Object.keys(result.finalMetrics)) {
            allMetrics.add(key);
          }
        }
      }

      csvLines.push(['variant', 'seed', 'success', 'durationMs', ...allMetrics].join(','));
      for (const [variantName, variantResults] of results) {
        for (const result of variantResults) {
          const values = [
            variantName,
            result.seed,
            result.success ? 1 : 0,
            result.durationMs,
            ...Array.from(allMetrics).map((m) => {
              const v = result.finalMetrics[m];
              return v !== undefined ? String(v) : '';
            }),
          ];
          csvLines.push(values.join(','));
        }
      }
      await writeFile(join(matrixDir, 'summary.csv'), csvLines.join('\n'));

      const totalDuration = Date.now() - startTime;

      if (jsonOutput) {
        const jsonResult = {
          scenario: baseScenario.name,
          variants: variants.map((v) => v.name),
          seeds,
          totalRuns: variants.length * seeds.length,
          durationMs: totalDuration,
          results: Object.fromEntries(
            Array.from(results.entries()).map(([name, results]) => [
              name,
              results.map((r) => ({
                seed: r.seed,
                success: r.success,
                durationMs: r.durationMs,
              })),
            ])
          ),
          comparisons: comparisons.map((c) => ({
            variantA: c.variantA,
            variantB: c.variantB,
            significantDiffs: c.metricDiffs.filter((d) => Math.abs(d.percentChange) > 10),
          })),
          outputDir: matrixDir,
        };
        console.log(JSON.stringify(jsonResult, null, 2));
      } else {
        output.newline();
        output.success(`Matrix complete: ${variants.length} variants x ${seeds.length} seeds`);
        output.newline();

        output.subheader('Summary');
        for (const [variantName, variantResults] of results) {
          const passed = variantResults.filter((r) => r.success).length;
          output.stat(variantName, `${passed}/${variantResults.length} passed`);
        }
        output.newline();

        // Highlight significant differences
        if (comparisons.length > 0) {
          output.subheader('Significant Differences (>10%)');
          for (const comparison of comparisons) {
            const significant = comparison.metricDiffs.filter(
              (d) => Math.abs(d.percentChange) > 10
            );
            if (significant.length > 0) {
              output.info(`${comparison.variantA} vs ${comparison.variantB}:`);
              for (const diff of significant.slice(0, 3)) {
                const change = `${diff.percentChange >= 0 ? '+' : ''}${diff.percentChange.toFixed(1)}%`;
                output.bullet(`${diff.metric}: ${change}`);
              }
            }
          }
          output.newline();
        }

        output.info(`Results written to: ${matrixDir}`);
        output.bullet('report.md - Matrix comparison report');
        output.bullet('summary.csv - All runs data');
      }

      // Exit with failure if any variant had all runs fail
      const anyTotalFailure = Array.from(results.values()).some((variantResults) =>
        variantResults.every((r) => !r.success)
      );
      process.exit(anyTotalFailure ? 1 : 0);
    } catch (error) {
      if (jsonOutput) {
        console.log(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          })
        );
      } else {
        output.error(`Matrix failed: ${error instanceof Error ? error.message : error}`);
      }
      process.exit(2);
    }
  });

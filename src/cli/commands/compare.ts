import { writeFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { Command } from 'commander';
import { compareRuns, generateCompareReport, parseRunArtifacts } from '../../core/report.js';
import { output } from '../ui/output.js';

/**
 * Compare command - compare two simulation runs
 */
export const compareCommand = new Command('compare')
  .description('Compare two simulation runs and generate a diff report')
  .argument('<runA>', 'Path to the first run directory (baseline)')
  .argument('<runB>', 'Path to the second run directory (comparison)')
  .option('-o, --output <path>', 'Output file path (default: compare.md in current directory)')
  .option('--json', 'Output comparison data as JSON instead of Markdown')
  .option('--threshold <percent>', 'Threshold for significant changes (default: 10)', '10')
  .action(async (runA, runB, options) => {
    try {
      // Resolve paths
      const pathA = isAbsolute(runA) ? runA : resolve(process.cwd(), runA);
      const pathB = isAbsolute(runB) ? runB : resolve(process.cwd(), runB);

      output.info('Comparing runs...');
      output.stat('Run A (baseline)', pathA);
      output.stat('Run B (comparison)', pathB);
      output.newline();

      // Parse both run artifacts
      output.info('Parsing artifacts...');
      const [artifactsA, artifactsB] = await Promise.all([
        parseRunArtifacts(pathA),
        parseRunArtifacts(pathB),
      ]);

      // Compare runs
      const comparison = compareRuns(artifactsA, artifactsB);

      if (options.json) {
        // Output as JSON
        const jsonOutput = {
          runA: {
            runId: artifactsA.summary.runId,
            scenario: artifactsA.summary.scenarioName,
            seed: artifactsA.summary.seed,
            ticks: artifactsA.summary.ticks,
            success: artifactsA.summary.success,
          },
          runB: {
            runId: artifactsB.summary.runId,
            scenario: artifactsB.summary.scenarioName,
            seed: artifactsB.summary.seed,
            ticks: artifactsB.summary.ticks,
            success: artifactsB.summary.success,
          },
          metadataDiffs: comparison.metadataDiffs,
          kpiDiffs: comparison.kpiDiffs,
          actionFreqDiffs: comparison.actionFreqDiffs,
          revertDiffs: comparison.revertDiffs,
          hashesMatch:
            artifactsA.hashes.actions === artifactsB.hashes.actions &&
            artifactsA.hashes.metrics === artifactsB.hashes.metrics,
        };
        console.log(JSON.stringify(jsonOutput, null, 2));
      } else {
        // Generate markdown report
        const report = generateCompareReport(comparison);

        // Determine output path
        const outputPath = options.output
          ? isAbsolute(options.output)
            ? options.output
            : resolve(process.cwd(), options.output)
          : resolve(process.cwd(), 'compare.md');

        // Write report
        await writeFile(outputPath, report);

        output.success(`Comparison report written to: ${outputPath}`);
        output.newline();

        // Print summary
        output.subheader('Comparison Summary');
        output.stat('Run A', artifactsA.summary.runId);
        output.stat('Run B', artifactsB.summary.runId);

        // Check for significant changes
        const threshold = Number.parseFloat(options.threshold) || 10;
        const significantChanges = comparison.kpiDiffs.filter((k) => {
          const pct = Number.parseFloat(k.percentChange);
          return Math.abs(pct) > threshold;
        });

        if (significantChanges.length > 0) {
          output.newline();
          output.subheader(`Significant Changes (>${threshold}%)`);
          for (const change of significantChanges) {
            output.stat(change.metric, change.percentChange);
          }
        } else {
          output.newline();
          output.info(`No significant changes detected (threshold: ${threshold}%)`);
        }

        // Determinism check
        output.newline();
        const hashesMatch =
          artifactsA.hashes.actions === artifactsB.hashes.actions &&
          artifactsA.hashes.metrics === artifactsB.hashes.metrics;

        if (hashesMatch) {
          output.success('Artifact hashes match - runs are deterministically equivalent');
        } else {
          output.info('Artifact hashes differ - runs produced different results');
        }
      }

      process.exit(0);
    } catch (error) {
      output.error(`Failed to compare runs: ${error instanceof Error ? error.message : error}`);
      process.exit(2);
    }
  });

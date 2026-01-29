import { constants, access, watch as fsWatch } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Command } from 'commander';
import { SimulationEngine } from '../../core/engine.js';
import { createLogger } from '../../core/logging.js';
import { loadScenario } from '../../core/scenario.js';
import type { RunOptions, RunResult, Scenario } from '../../core/types.js';
import { createToyScenario } from '../../toy/toyScenario.js';
import { output } from '../ui/output.js';

/**
 * Run command - execute a simulation scenario
 */
export const runCommand = new Command('run')
  .description('Run a simulation scenario')
  .argument('[scenario]', 'Path to scenario file (.ts)')
  .option('--toy', 'Run the built-in toy scenario')
  .option('-s, --seed <number>', 'Random seed', Number.parseInt)
  .option('-t, --ticks <number>', 'Number of ticks to simulate', Number.parseInt)
  .option('--tick-seconds <number>', 'Simulated seconds per tick', Number.parseInt)
  .option('-o, --out <path>', 'Output directory', 'sim/results')
  .option('--output-path <path>', 'Exact output path (overrides --out, useful for CI)')
  .option('--ci', 'CI mode (no colors, strict exit codes)')
  .option('--summary', 'Print one-line summary (useful for CI logs)')
  .option('-v, --verbose', 'Verbose output')
  .option('--fork-url <url>', 'Fork from a network URL (for EVM simulations)')
  .option('--snapshot-every <number>', 'Create snapshots every N ticks', Number.parseInt)
  .option('--watch', 'Re-run simulation when scenario file changes')
  .option('--json', 'Output results as JSON')
  .action(async (scenarioPath, options) => {
    // Determine if we're in CI or JSON mode
    const ci = options.ci || process.env.CI === 'true';
    const jsonOutput = options.json;
    const suppressOutput = jsonOutput;

    // Create logger
    const logger = createLogger({
      level: options.verbose ? 'debug' : 'info',
      ci,
    });

    /**
     * Run a single simulation
     */
    async function runSimulation(): Promise<RunResult> {
      // Load scenario
      let scenario: Scenario;

      if (options.toy || !scenarioPath) {
        if (!options.toy && !scenarioPath && !suppressOutput) {
          output.info('No scenario specified, running toy scenario');
          output.newline();
        }
        scenario = createToyScenario({
          seed: options.seed,
          ticks: options.ticks,
        });
        if (!suppressOutput) {
          output.header('Running scenario: toy-market');
        }
      } else {
        const fullPath = isAbsolute(scenarioPath)
          ? scenarioPath
          : resolve(process.cwd(), scenarioPath);

        // Check if file exists
        try {
          await access(fullPath, constants.R_OK);
        } catch {
          if (jsonOutput) {
            console.log(
              JSON.stringify({ success: false, error: `Scenario file not found: ${fullPath}` })
            );
          } else {
            output.error(`Scenario file not found: ${fullPath}`);
          }
          process.exit(2);
        }

        // Load the scenario
        if (!suppressOutput) {
          output.info(`Loading scenario from: ${scenarioPath}`);
        }
        const fileUrl = pathToFileURL(fullPath).href;
        scenario = await loadScenario(fileUrl);
        if (!suppressOutput) {
          output.header(`Running scenario: ${scenario.name}`);
        }
      }

      if (!suppressOutput) {
        output.newline();
      }

      // Build run options
      // --output-path takes precedence over --out for exact path control in CI
      const outDir = options.outputPath ? dirname(options.outputPath) : options.out;

      const runOptions: RunOptions = {
        seed: options.seed,
        ticks: options.ticks,
        tickSeconds: options.tickSeconds,
        outDir,
        ci,
        verbose: options.verbose,
      };

      // Store additional options for later use
      const forkUrl = options.forkUrl;
      const snapshotEvery = options.snapshotEvery;

      // Print configuration
      if (!suppressOutput) {
        output.config('Seed', String(runOptions.seed ?? scenario.seed));
        output.config('Ticks', String(runOptions.ticks ?? scenario.ticks));
        output.config('Tick Duration', `${runOptions.tickSeconds ?? scenario.tickSeconds}s`);
        output.config('Output', runOptions.outDir ?? 'sim/results');
        if (forkUrl) {
          output.config('Fork URL', forkUrl);
        }
        if (snapshotEvery) {
          output.config('Snapshot Every', `${snapshotEvery} ticks`);
        }
        output.newline();
      }

      // Create and run engine
      const engine = new SimulationEngine({ logger });

      if (!suppressOutput) {
        output.info('Starting simulation...');
        output.newline();
      }

      const result = await engine.run(scenario, runOptions);

      return result;
    }

    /**
     * Print one-line summary for CI logs
     */
    function printSummary(result: RunResult): void {
      const status = result.success ? 'PASS' : 'FAIL';
      const failedCount = result.failedAssertions.length;
      const totalActions = result.agentStats.reduce((sum, s) => sum + s.actionsAttempted, 0);
      const successActions = result.agentStats.reduce((sum, s) => sum + s.actionsSucceeded, 0);
      const successRate =
        totalActions > 0 ? Math.round((successActions / totalActions) * 100) : 100;

      // One-line format: STATUS scenario seed=X ticks=Y duration=Zms actions=N/M (P%) [failed=F]
      let line = `${status} ${result.scenarioName} seed=${result.seed} ticks=${result.ticks} duration=${result.durationMs}ms actions=${successActions}/${totalActions} (${successRate}%)`;
      if (failedCount > 0) {
        line += ` failed_assertions=${failedCount}`;
      }
      console.log(line);
    }

    /**
     * Print human-readable results
     */
    function printResults(result: RunResult): void {
      // If --summary flag, just print one line
      if (options.summary) {
        printSummary(result);
        return;
      }

      output.newline();
      output.header('Results');
      output.newline();

      output.config('Run ID', result.runId);
      output.config('Duration', `${result.durationMs}ms`);
      output.config('Ticks', String(result.ticks));
      output.config('Status', result.success ? 'PASSED' : 'FAILED');
      output.newline();

      // Print agent stats
      output.subheader('Agent Statistics');
      for (const stat of result.agentStats) {
        const successRate =
          stat.actionsAttempted > 0
            ? Math.round((stat.actionsSucceeded / stat.actionsAttempted) * 100)
            : 100;
        output.stat(
          stat.id,
          `${stat.actionsSucceeded}/${stat.actionsAttempted} actions (${successRate}% success)`
        );
      }
      output.newline();

      // Print key metrics
      output.subheader('Final Metrics');
      const metricsToShow = ['totalVolume', 'totalAgentValue', 'tick'];
      for (const key of metricsToShow) {
        const value = result.finalMetrics[key];
        if (value !== undefined) {
          output.stat(key, String(value));
        }
      }
      output.newline();

      // Print artifact location
      output.info(`Artifacts written to: ${result.outputDir}`);
      output.newline();

      // Handle assertions
      if (result.failedAssertions.length > 0) {
        output.error('Failed assertions:');
        for (const failure of result.failedAssertions) {
          output.bullet(`${failure.message}`);
        }
        output.newline();
      }

      // Final status
      if (result.success) {
        output.success('Simulation completed successfully!');
      } else {
        output.error('Simulation completed with failures');
      }
    }

    /**
     * Print JSON results
     */
    function printJsonResults(result: RunResult): void {
      // Convert bigint values to strings for JSON serialization
      const serializableMetrics: Record<string, string | number> = {};
      for (const [key, value] of Object.entries(result.finalMetrics)) {
        serializableMetrics[key] = typeof value === 'bigint' ? value.toString() : value;
      }

      console.log(
        JSON.stringify(
          {
            success: result.success,
            runId: result.runId,
            scenarioName: result.scenarioName,
            seed: result.seed,
            ticks: result.ticks,
            durationMs: result.durationMs,
            outputDir: result.outputDir,
            agentStats: result.agentStats,
            finalMetrics: serializableMetrics,
            failedAssertions: result.failedAssertions,
          },
          null,
          2
        )
      );
    }

    try {
      // Watch mode
      if (options.watch && scenarioPath) {
        const fullPath = isAbsolute(scenarioPath)
          ? scenarioPath
          : resolve(process.cwd(), scenarioPath);
        const watchDir = dirname(fullPath);

        output.info(`Watching for changes in: ${watchDir}`);
        output.newline();

        // Initial run
        const initialResult = await runSimulation();
        printResults(initialResult);

        // Watch for changes
        const watcher = fsWatch(watchDir);
        for await (const event of watcher) {
          if (event.filename?.endsWith('.ts')) {
            output.newline();
            output.info(`File changed: ${event.filename}, re-running simulation...`);
            output.newline();

            try {
              const result = await runSimulation();
              printResults(result);
            } catch (error) {
              output.error(`Re-run failed: ${error instanceof Error ? error.message : error}`);
            }
          }
        }
      } else {
        // Single run
        const result = await runSimulation();

        if (jsonOutput) {
          printJsonResults(result);
        } else {
          printResults(result);
        }

        // Exit with appropriate code
        process.exit(result.success ? 0 : 1);
      }
    } catch (error) {
      if (jsonOutput) {
        console.log(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          })
        );
      } else {
        output.newline();
        output.error(`Simulation failed: ${error instanceof Error ? error.message : error}`);

        if (options.verbose && error instanceof Error && error.stack) {
          console.error(error.stack);
        }
      }

      process.exit(2);
    }
  });

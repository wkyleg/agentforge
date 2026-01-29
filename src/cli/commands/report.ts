import { writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { Command } from 'commander';
import { generateMarkdownReport, getGitCommit, parseRunArtifacts } from '../../core/report.js';
import { output } from '../ui/output.js';

/**
 * Report command - generate a report from run artifacts
 */
export const reportCommand = new Command('report')
  .description('Generate a report from simulation run artifacts')
  .argument('<runDir>', 'Path to the run directory containing artifacts')
  .option('-o, --output <path>', 'Output file path (default: report.md in run directory)')
  .option('--json', 'Output report data as JSON instead of Markdown')
  .option('--no-git', 'Skip git commit lookup')
  .action(async (runDir, options) => {
    try {
      // Resolve run directory path
      const runPath = isAbsolute(runDir) ? runDir : resolve(process.cwd(), runDir);

      output.info(`Parsing artifacts from: ${runPath}`);
      output.newline();

      // Parse artifacts
      const artifacts = await parseRunArtifacts(runPath);

      // Get git commit if not disabled
      let gitCommit: string | null = null;
      if (options.git !== false) {
        gitCommit = await getGitCommit(process.cwd());
      }

      if (options.json) {
        // Output as JSON
        const reportData = {
          summary: artifacts.summary,
          config: artifacts.config,
          hashes: artifacts.hashes,
          gitCommit,
          metricsCount: artifacts.metrics.length,
          actionsCount: artifacts.actions.length,
        };
        console.log(JSON.stringify(reportData, null, 2));
      } else {
        // Generate markdown report
        const report = generateMarkdownReport(artifacts, gitCommit);

        // Determine output path
        const outputPath = options.output
          ? isAbsolute(options.output)
            ? options.output
            : resolve(process.cwd(), options.output)
          : join(runPath, 'report.md');

        // Write report
        await writeFile(outputPath, report);

        output.success(`Report written to: ${outputPath}`);
        output.newline();

        // Print summary
        output.subheader('Report Summary');
        output.stat('Scenario', artifacts.summary.scenarioName);
        output.stat('Seed', String(artifacts.summary.seed));
        output.stat('Ticks', String(artifacts.summary.ticks));
        output.stat('Status', artifacts.summary.success ? 'PASSED' : 'FAILED');
        output.stat('Actions Recorded', String(artifacts.actions.length));
        output.stat('Metrics Samples', String(artifacts.metrics.length));
      }

      process.exit(0);
    } catch (error) {
      output.error(`Failed to generate report: ${error instanceof Error ? error.message : error}`);
      process.exit(2);
    }
  });

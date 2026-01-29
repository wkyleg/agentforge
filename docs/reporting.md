# Reporting

AgentForge provides three reporting commands for analyzing simulation results:

- `report` - Generate a report from a single run
- `compare` - Diff two runs and highlight changes
- `sweep` - Run multiple seeds and aggregate statistics

## Report Command

Generate a comprehensive report from simulation artifacts:

```bash
forge-sim report <runDir> [options]
```

### Arguments

- `<runDir>` - Path to the run directory containing artifacts

### Options

- `-o, --output <path>` - Output file path (default: report.md in run directory)
- `--json` - Output report data as JSON instead of Markdown
- `--no-git` - Skip git commit lookup

### Example

```bash
# Generate report
forge-sim report sim/results/stress-2024-01-15T10-30-00

# Specify output location
forge-sim report sim/results/stress-ci -o reports/stress-report.md

# Get JSON for programmatic use
forge-sim report sim/results/stress-ci --json > report.json
```

### Report Contents

The generated `report.md` includes:

1. **Run Metadata** - Scenario name, seed, ticks, duration, status
2. **Agent Configuration** - Types and counts
3. **KPI Summary** - Final metric values
4. **Time-Series Statistics** - Min/max/mean for each metric
5. **Agent Statistics** - Per-agent action counts and success rates
6. **Action Analysis** - Frequency table, revert reasons
7. **Notable Actions** - Most expensive transaction
8. **Failed Assertions** - If any
9. **Determinism Fingerprint** - Artifact hashes for verification

## Compare Command

Compare two simulation runs and generate a diff report:

```bash
forge-sim compare <runA> <runB> [options]
```

### Arguments

- `<runA>` - Path to the baseline run directory
- `<runB>` - Path to the comparison run directory

### Options

- `-o, --output <path>` - Output file path (default: compare.md in current directory)
- `--json` - Output comparison data as JSON
- `--threshold <percent>` - Threshold for significant changes (default: 10%)

### Example

```bash
# Compare two runs
forge-sim compare sim/results/run1/stress-ci sim/results/run2/stress-ci

# Custom threshold
forge-sim compare runA runB --threshold 5

# JSON output
forge-sim compare runA runB --json > comparison.json
```

### Comparison Contents

The generated `compare.md` includes:

1. **Metadata Comparison** - Side-by-side run configuration
2. **KPI Comparison** - Values, deltas, and percent changes
3. **Action Frequency Comparison** - Count changes per action type
4. **Revert Reason Comparison** - Error count changes
5. **Verdict** - Significant changes exceeding threshold
6. **Determinism Check** - Whether artifact hashes match

### Use Cases

- **Regression testing**: Compare current run against baseline
- **A/B testing**: Compare different configurations
- **Determinism verification**: Confirm same-seed runs are identical

## Sweep Command

Run a scenario with multiple seeds and generate aggregate statistics:

```bash
forge-sim sweep <scenario> [options]
```

### Arguments

- `<scenario>` - Path to scenario file, or `--toy` for built-in

### Options

- `--seeds <range>` - Seed range (default: "1..25")
  - Range format: `1..50` (inclusive range)
  - List format: `1,2,5,10`
  - Count format: `25` (seeds 1 through 25)
- `-t, --ticks <number>` - Override tick count
- `-o, --out <path>` - Output directory (default: sim/results/sweep)
- `--ci` - CI mode
- `-v, --verbose` - Verbose output
- `--parallel <n>` - Parallel runs (default: 1)
- `--json` - Output results as JSON

### Example

```bash
# Basic sweep with 25 seeds
forge-sim sweep sim/scenarios/stress.ts

# Custom seed range
forge-sim sweep sim/scenarios/stress.ts --seeds 1..100

# Specific seeds
forge-sim sweep sim/scenarios/stress.ts --seeds 42,123,456

# Parallel execution
forge-sim sweep sim/scenarios/stress.ts --seeds 1..50 --parallel 4

# Use toy scenario
forge-sim sweep --toy --seeds 1..10
```

### Sweep Output

The sweep creates a directory with:

```
sweep/<scenario>-<timestamp>/
├── summary.csv      # Per-seed KPIs
├── report.md        # Aggregate statistics
└── <scenario>-ci/   # Individual run artifacts (per seed)
```

### summary.csv

CSV with one row per seed:

```csv
seed,success,durationMs,totalVolume,totalAgentValue,...
1,1,1234,5000,100000,...
2,1,1189,4800,98000,...
```

### report.md

Aggregate statistics including:

1. **Configuration** - Scenario, seed count, ticks
2. **Results Summary** - Pass/fail counts
3. **Metric Statistics** - Min, P05, P50, P95, Max, Mean, StdDev
4. **Tail Risk Analysis** - Worst 3 runs with reasons

### Statistical Analysis

The sweep report includes percentile analysis:

| Metric | Min | P05 | P50 | P95 | Max | Mean | StdDev |
|--------|-----|-----|-----|-----|-----|------|--------|
| totalVolume | 4200 | 4500 | 5100 | 5800 | 6200 | 5050 | 420 |

This helps identify:
- **Central tendency**: P50 (median) and mean
- **Tail risk**: P05/P95 for extreme outcomes
- **Variability**: StdDev for consistency

## Workflow Examples

### Regression Testing

```bash
# Create baseline
forge-sim run sim/scenarios/stress.ts --seed 42 --out baseline --ci
forge-sim report baseline/stress-ci

# After changes, compare
forge-sim run sim/scenarios/stress.ts --seed 42 --out current --ci
forge-sim compare baseline/stress-ci current/stress-ci
```

### Confidence Building

```bash
# Run sweep to understand distribution
forge-sim sweep sim/scenarios/stress.ts --seeds 1..100 --parallel 4

# Review tail risks
cat sim/results/sweep/stress-*/report.md | grep -A 20 "Tail Risk"
```

### Protocol Change Analysis

```bash
# Run baseline
forge-sim run sim/scenarios/defi.ts --seed 42 --out before

# Deploy new contract version
# ... make changes ...

# Run comparison
forge-sim run sim/scenarios/defi.ts --seed 42 --out after
forge-sim compare before/defi-* after/defi-*
```

## Programmatic Usage

All commands support `--json` for integration with other tools:

```javascript
import { execSync } from 'child_process';

// Get report data
const reportJson = execSync('forge-sim report runDir --json').toString();
const report = JSON.parse(reportJson);

// Check metrics
if (report.summary.finalMetrics.totalVolume < 1000) {
  throw new Error('Volume too low');
}
```

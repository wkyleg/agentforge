# AgentForge Examples

This directory contains example scenarios demonstrating various AgentForge features.

## Examples

### 1. Basic Simulation (`basic-simulation/`)

A minimal simulation setup using built-in agent types.

```bash
npx tsx examples/basic-simulation/scenario.ts
# or
npx forge-sim run examples/basic-simulation/scenario.ts
```

**Demonstrates:**
- Basic scenario definition
- Using built-in agents (RandomTrader, Momentum, Holder)
- Metrics configuration
- Simple assertions

### 2. Custom Agent (`custom-agent/`)

How to create custom agents with advanced features.

```bash
npx tsx examples/custom-agent/scenario.ts
```

**Demonstrates:**
- Extending `BaseAgent`
- Using agent memory (`remember`, `recall`)
- Setting cooldowns
- Accessing world state
- Parameter passing

### 3. Assertions (`assertions/`)

How to use assertions for simulation validation.

```bash
npx tsx examples/assertions/scenario.ts
```

**Demonstrates:**
- All assertion types (gt, gte, lt, lte, eq)
- Multiple assertions
- Assertion failure handling
- Success/failure determination

### 4. Metrics Tracking (`metrics-tracking/`)

Detailed metrics collection and analysis.

```bash
npx tsx examples/metrics-tracking/scenario.ts
```

**Demonstrates:**
- Metrics configuration
- CSV output analysis
- Statistical summaries
- Price trajectory visualization

## Running Examples

Each example can be run directly with `tsx`:

```bash
npx tsx examples/<example-name>/scenario.ts
```

Or through the CLI:

```bash
npx forge-sim run examples/<example-name>/scenario.ts
```

## Output

Each example writes its artifacts to an example-specific `results/` directory:

```
examples/<name>/results/
├── summary.json
├── metrics.csv
├── actions.ndjson
├── config_resolved.json
└── run.log
```

## Creating Your Own

Use these examples as templates for your own scenarios:

1. Copy an example directory
2. Modify the scenario configuration
3. Create custom agents if needed
4. Run and iterate

See the main [README](../README.md) for comprehensive documentation.

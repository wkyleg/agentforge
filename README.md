# AgentForge

Type-safe agent-based simulation framework for Foundry/EVM protocols.

AgentForge enables you to stress-test your Solidity protocol's economic assumptions by simulating multiple agents interacting with your contracts over time. Think of it as "unit tests for tokenomics."

## Features

- **Type-safe TypeScript + Viem** - Full type safety for contract interactions
- **Deterministic simulations** - Same seed produces identical results
- **CLI tool (`forge-sim`)** - Easy integration with any Foundry project
- **Pluggable packs** - Protocol-specific bindings for your contracts
- **Multiple agent types** - Random traders, momentum followers, custom behaviors
- **Rich artifacts** - JSON summaries, CSV metrics, action logs
- **CI-ready** - Designed for automated testing pipelines

## Installation

```bash
# Using pnpm (recommended)
pnpm add agentforge

# Using npm
npm install agentforge

# Using yarn
yarn add agentforge
```

## Quick Start

### 1. Initialize your project

```bash
npx forge-sim init
```

This creates a `sim/` directory with:
- `scenarios/` - Simulation scenario files
- `agents/` - Custom agent implementations
- `packs/` - Protocol-specific packs
- `results/` - Output artifacts (gitignored)

### 2. Run the toy scenario

```bash
npx forge-sim run --toy
```

This runs a built-in market simulation to verify everything works.

### 3. Check your environment

```bash
npx forge-sim doctor
```

## Writing Scenarios

Scenarios define the simulation parameters, agents, and assertions.

```typescript
// sim/scenarios/my-scenario.ts
import { defineScenario } from 'agentforge';
import { ToyPack, RandomTraderAgent, MomentumAgent } from 'agentforge/toy';

export default defineScenario({
  name: 'my-scenario',
  seed: 42,              // Deterministic seed
  ticks: 100,            // Number of simulation steps
  tickSeconds: 3600,     // Simulated time per tick (1 hour)

  pack: new ToyPack({
    assets: [
      { name: 'TOKEN', initialPrice: 100, volatility: 0.05 },
    ],
    initialCash: 10000,
  }),

  agents: [
    { type: RandomTraderAgent, count: 10 },
    { type: MomentumAgent, count: 5 },
  ],

  metrics: {
    sampleEveryTicks: 1,
  },

  assertions: [
    { type: 'gt', metric: 'totalVolume', value: 0 },
  ],
});
```

Run it:

```bash
npx forge-sim run sim/scenarios/my-scenario.ts
```

## Writing Custom Agents

Agents are TypeScript classes that decide what action to take each tick.

```typescript
import { BaseAgent, type Action, type TickContext } from 'agentforge';

export class MyAgent extends BaseAgent {
  async step(ctx: TickContext): Promise<Action | null> {
    // Access world state
    const world = ctx.world;
    
    // Use deterministic RNG
    if (ctx.rng.chance(0.3)) {
      return {
        id: this.generateActionId('buy', ctx.tick),
        name: 'buy',
        params: { amount: 100 },
      };
    }
    
    return null; // Skip this tick
  }
}
```

## CLI Reference

### `forge-sim doctor`

Check your environment for required dependencies.

```bash
forge-sim doctor [--json]
```

Options:
- `--json` - Output results as JSON (for programmatic use)

### `forge-sim init`

Initialize simulation folder structure.

```bash
forge-sim init [path] [--force]
```

Options:
- `path` - Target directory (default: current directory)
- `--force` - Overwrite existing files

### `forge-sim run`

Execute a simulation scenario.

```bash
forge-sim run [scenario] [options]
```

Options:
- `--toy` - Run built-in toy scenario
- `-s, --seed <n>` - Random seed (overrides scenario)
- `-t, --ticks <n>` - Number of ticks (overrides scenario)
- `--tick-seconds <n>` - Seconds per tick (overrides scenario)
- `-o, --out <path>` - Output directory (default: sim/results)
- `--ci` - CI mode (no colors, stable output paths)
- `-v, --verbose` - Verbose logging
- `--fork-url <url>` - Fork from a network URL (for EVM simulations)
- `--snapshot-every <n>` - Create snapshots every N ticks
- `--watch` - Re-run simulation when scenario file changes
- `--json` - Output results as JSON

### `forge-sim types`

Extract ABIs from Foundry artifacts and generate TypeScript types.

```bash
forge-sim types [options]
```

Options:
- `-d, --dir <path>` - Target directory with Foundry project (default: .)
- `-o, --out <path>` - Output directory for generated types (default: sim/generated/abi)
- `--no-index` - Do not generate index.ts file
- `-f, --filter <pattern>` - Filter contracts by name pattern
- `--json` - Output result as JSON

## Output Artifacts

Each simulation run produces:

```
sim/results/<run-id>/
├── summary.json         # Run metadata, final KPIs, agent stats
├── metrics.csv          # Time-series data
├── actions.ndjson       # All agent actions (newline-delimited JSON)
├── config_resolved.json # Resolved configuration
└── run.log              # Structured log output
```

### summary.json

```json
{
  "runId": "my-scenario-2026-01-27T...",
  "scenarioName": "my-scenario",
  "seed": 42,
  "ticks": 100,
  "durationMs": 1234,
  "success": true,
  "finalMetrics": {
    "totalVolume": 15000,
    "price_TOKEN": 105.23
  },
  "agentStats": [
    {
      "id": "RandomTraderAgent-0",
      "type": "RandomTraderAgent",
      "actionsAttempted": 45,
      "actionsSucceeded": 42,
      "actionsFailed": 3
    }
  ]
}
```

## Library API

### Core Exports

```typescript
import {
  // Scenario definition
  defineScenario,
  loadScenario,
  
  // Engine
  SimulationEngine,
  runScenario,
  
  // Agents
  BaseAgent,
  NoOpAgent,
  
  // Utilities
  Rng,
  Scheduler,
  createScheduler,
  MetricsCollector,
  ArtifactsWriter,
  createLogger,
  
  // Error handling
  AgentForgeError,
  RevertError,
  RpcError,
  TimeoutError,
  NonceError,
  ConfigurationError,
  PreconditionError,
  
  // Preconditions
  hasBalance,
  hasAllowance,
  withinTimeWindow,
  notOnCooldown,
  preconditions,
  
  // Schema validation
  validateScenarioConfig,
  validateRunOptions,
} from 'agentforge';
```

### Type Exports

```typescript
import type {
  Scenario,
  RunOptions,
  RunResult,
  Action,
  ActionResult,
  ActionEvent,
  TickContext,
  Pack,
  WorldState,
  AgentStats,
  AgentConfig,
  MetricsConfig,
  MetricsSample,
  Assertion,
  FailedAssertion,
  RecordedAction,
} from 'agentforge';
```

## Scenario Configuration Reference

### Full Scenario Schema

```typescript
interface Scenario {
  // Required fields
  name: string;           // Unique scenario identifier
  seed: number;           // Random seed for determinism
  ticks: number;          // Total simulation steps
  tickSeconds: number;    // Simulated seconds per tick
  pack: Pack;             // Protocol-specific bindings
  agents: AgentConfig[];  // Agent type configurations
  
  // Optional fields
  metrics?: {
    sampleEveryTicks: number;  // Sample interval (default: 1)
    track?: string[];          // Specific metrics to track
  };
  assertions?: Assertion[];    // Post-run validation rules
}
```

### Agent Configuration

```typescript
interface AgentConfig {
  type: typeof BaseAgent;          // Agent class constructor
  count: number;                   // Number of instances to create
  params?: Record<string, unknown>; // Parameters passed to constructor
}
```

### Assertions

Assertions validate conditions at the end of a simulation:

```typescript
interface Assertion {
  type: 'eq' | 'gt' | 'gte' | 'lt' | 'lte';  // Comparison type
  metric: string;                             // Metric name to check
  value: number | string;                     // Expected value
}

// Examples
const assertions = [
  { type: 'gt', metric: 'totalVolume', value: 1000 },
  { type: 'gte', metric: 'successRate', value: 0.9 },
  { type: 'lt', metric: 'maxDrawdown', value: 0.2 },
  { type: 'eq', metric: 'errorCount', value: 0 },
];
```

## Agent Authoring Guide

### Basic Agent Structure

```typescript
import { BaseAgent, type Action, type TickContext } from 'agentforge';

export class MyAgent extends BaseAgent {
  // Called once when simulation starts
  async initialize(ctx: TickContext): Promise<void> {
    this.remember('initialBalance', ctx.world.balance);
  }
  
  // Called every tick - decide what action to take
  async step(ctx: TickContext): Promise<Action | null> {
    // Access parameters passed in scenario config
    const threshold = this.getParam('threshold', 100);
    
    // Use deterministic RNG
    if (ctx.rng.chance(0.3)) {
      return this.createAction('buy', ctx.tick, { amount: 100 });
    }
    
    return null; // Skip this tick
  }
  
  // Called once when simulation ends
  async cleanup(): Promise<void> {
    // Clean up any resources
  }
  
  private createAction(name: string, tick: number, params: Record<string, unknown>): Action {
    return {
      id: this.generateActionId(name, tick),
      name,
      params,
    };
  }
}
```

### Using Agent Memory

Agents can persist state between ticks using the memory system:

```typescript
class StatefulAgent extends BaseAgent {
  async step(ctx: TickContext): Promise<Action | null> {
    // Store values in memory
    this.remember('lastPrice', ctx.world.price);
    this.remember('tickCount', (this.recall('tickCount') ?? 0) + 1);
    
    // Retrieve values from memory
    const previousPrice = this.recall<number>('previousPrice');
    const history = this.recall<number[]>('priceHistory', []);
    
    // Check if memory exists
    if (this.hasMemory('initialized')) {
      // ...
    }
    
    // Clear specific or all memory
    this.forget('tempValue');
    this.clearMemory();
    
    return null;
  }
}
```

### Using Cooldowns

Prevent agents from spamming actions:

```typescript
class CooldownAgent extends BaseAgent {
  async step(ctx: TickContext): Promise<Action | null> {
    // Check if action is available
    if (this.isOnCooldown('buy', ctx.tick)) {
      const remaining = this.getCooldownRemaining('buy', ctx.tick);
      ctx.logger.debug(`Buy on cooldown for ${remaining} more ticks`);
      return null;
    }
    
    // Set cooldown after action
    this.setCooldown('buy', 5, ctx.tick); // Can't buy for 5 ticks
    
    return {
      id: this.generateActionId('buy', ctx.tick),
      name: 'buy',
      params: { amount: 100 },
    };
  }
}
```

### Using Preconditions

Check conditions before taking actions:

```typescript
import { hasBalance, withinTimeWindow, preconditions } from 'agentforge';

class PreconditionAgent extends BaseAgent {
  async step(ctx: TickContext): Promise<Action | null> {
    // Individual precondition checks
    const balanceCheck = hasBalance(ctx.world, this.id, 'ETH', 1000n);
    if (!balanceCheck.passed) {
      ctx.logger.debug(balanceCheck.message);
      return null;
    }
    
    // Fluent API for multiple checks
    const check = preconditions()
      .hasBalance(ctx.world, this.id, 'TOKEN', 100n)
      .withinTimeWindow(ctx, 1000, 5000)
      .notOnCooldown(this.cooldowns, 'trade', ctx.tick)
      .check();
    
    if (!check.passed) {
      return null;
    }
    
    return this.createTradeAction(ctx);
  }
}
```

### RNG Methods

The `Rng` class provides deterministic random number generation:

```typescript
class RandomAgent extends BaseAgent {
  async step(ctx: TickContext): Promise<Action | null> {
    const { rng } = ctx;
    
    // Random float [0, 1)
    const float = rng.nextFloat();
    
    // Random integer [0, max)
    const int = rng.nextU32() % 100;
    
    // Boolean with probability
    if (rng.chance(0.3)) { /* 30% chance */ }
    
    // Pick from array
    const action = rng.pickOne(['buy', 'sell', 'hold']);
    
    // Weighted selection
    const weighted = rng.weightedPick([
      { item: 'buy', weight: 0.5 },
      { item: 'sell', weight: 0.3 },
      { item: 'hold', weight: 0.2 },
    ]);
    
    // Gaussian distribution
    const gaussian = rng.nextGaussian(100, 15); // mean=100, stddev=15
    
    // Shuffle array (returns new array)
    const shuffled = rng.shuffle([1, 2, 3, 4, 5]);
    
    return null;
  }
}
```

### Running Programmatically

```typescript
import { SimulationEngine, defineScenario } from 'agentforge';
import { ToyPack, RandomTraderAgent } from 'agentforge/toy';

const scenario = defineScenario({
  name: 'programmatic-test',
  seed: 123,
  ticks: 50,
  tickSeconds: 3600,
  pack: new ToyPack(),
  agents: [{ type: RandomTraderAgent, count: 5 }],
});

const engine = new SimulationEngine();
const result = await engine.run(scenario, {
  outDir: './my-results',
  verbose: true,
});

console.log(`Success: ${result.success}`);
console.log(`Final metrics:`, result.finalMetrics);
```

## Determinism

AgentForge guarantees deterministic simulations:

- Same seed + same scenario = identical results
- Agent execution order is shuffled deterministically per tick
- All randomness derives from the seeded RNG

This enables:
- Reproducible bug investigations
- CI regression testing
- Monte Carlo simulations with different seeds

## Phase 2 (Coming Soon)

Phase 2 will add:

- **Foundry integration** - Auto-detect `foundry.toml`, parse artifacts
- **Anvil control** - Spawn/manage local nodes, time manipulation
- **Real contract packs** - Deploy and interact with actual Solidity contracts
- **Type generation** - Generate Viem types from Foundry artifacts

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Built by [wkyleg.eth](https://github.com/wkyleg) | Originally developed for [Elata Protocol](https://github.com/elata-protocol)

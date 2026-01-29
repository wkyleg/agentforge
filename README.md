<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="logo-light.svg">
    <img alt="AgentForge" src="logo-light.svg" width="560">
  </picture>
</p>

<p align="center">
  Stress-test your smart contracts before mainnet.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@elata-biosciences/agentforge"><img src="https://img.shields.io/npm/v/@elata-biosciences/agentforge?color=orange" alt="npm version"></a>
  <a href="https://github.com/Elata-Biosciences/agentforge/actions/workflows/ci.yml"><img src="https://github.com/Elata-Biosciences/agentforge/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
</p>

---

> **Note**: AgentForge is currently in alpha. APIs may change and you may encounter bugs.

AgentForge is an agent-based simulation framework for Foundry/EVM protocols. Define autonomous agents, run them against your smart contracts, and validate economic invariants with deterministic, reproducible results.

Traditional testing validates individual functions. Agent-based modeling validates emergent system behavior—what happens when hundreds of users interact simultaneously? Does your AMM stay solvent under volatility? How do rational actors exploit edge cases?

## Installation

```bash
pnpm add @elata-biosciences/agentforge
```

Requirements: Node.js 18+ and [Foundry](https://book.getfoundry.sh/getting-started/installation) with Anvil for EVM simulations.

## Quick Start

```bash
# Initialize project structure
npx agentforge init

# Run built-in toy scenario to verify setup
npx agentforge run --toy

# Check environment
npx agentforge doctor
```

## Writing a Scenario

```typescript
import { defineScenario } from '@elata-biosciences/agentforge';
import { ToyPack, RandomTraderAgent, MomentumAgent } from '@elata-biosciences/agentforge/toy';

export default defineScenario({
  name: 'market-stress',
  seed: 42,
  ticks: 100,
  tickSeconds: 3600,

  pack: new ToyPack({
    assets: [{ name: 'TOKEN', initialPrice: 100, volatility: 0.05 }],
    initialCash: 10000,
  }),

  agents: [
    { type: RandomTraderAgent, count: 10 },
    { type: MomentumAgent, count: 5, params: { threshold: 0.02 } },
  ],

  assertions: [
    { type: 'gt', metric: 'totalVolume', value: 0 },
    { type: 'gte', metric: 'successRate', value: 0.9 },
  ],
});
```

Run it:

```bash
npx agentforge run sim/scenarios/market-stress.ts
```

## Writing an Agent

Extend `BaseAgent` and implement `step()`:

```typescript
import { BaseAgent, type Action, type TickContext } from '@elata-biosciences/agentforge';

export class MyAgent extends BaseAgent {
  async step(ctx: TickContext): Promise<Action | null> {
    // 30% chance to buy each tick
    if (ctx.rng.chance(0.3)) {
      return {
        id: this.generateActionId('buy', ctx.tick),
        name: 'buy',
        params: { amount: ctx.rng.nextInt(1, 100), asset: 'TOKEN' },
      };
    }
    return null; // Skip this tick
  }
}
```

Agents have access to:

- `ctx.rng` — Deterministic random number generator
- `this.remember()` / `this.recall()` — Persist state across ticks
- `this.setCooldown()` / `this.isOnCooldown()` — Rate-limit actions
- `this.getParam()` — Access scenario-defined parameters

## CLI

```bash
agentforge init [path]          # Initialize simulation folder
agentforge run <scenario>       # Execute a scenario
agentforge run --toy            # Run built-in demo
agentforge doctor               # Check dependencies
agentforge types                # Generate types from Foundry artifacts
```

Options for `run`:

```bash
--seed <n>      # Override random seed
--ticks <n>     # Override tick count
--out <dir>     # Output directory
--ci            # CI mode (no colors)
--verbose       # Verbose logging
```

## Output

Each run produces:

```
results/<scenario>-<timestamp>/
├── summary.json          # Metadata, metrics, assertion results
├── metrics.csv           # Time-series data
├── actions.ndjson        # Action log
└── config_resolved.json  # Resolved configuration
```

## Core Concepts

**Scenarios** define simulation parameters: seed, duration, agents, and assertions.

**Packs** are protocol adapters that set up blockchain state and handle contract interactions.

**Agents** are autonomous actors that observe state and decide actions each tick.

**Determinism**: Same seed + same scenario = identical results. All randomness derives from seeded RNG.

## Examples

See [examples/](examples/) for working code:

- `basic-simulation/` — Minimal setup
- `custom-agent/` — Memory, cooldowns, custom logic
- `assertions/` — Validation and failure handling
- `metrics-tracking/` — CSV analysis

## CI Integration

```yaml
- name: Run simulations
  run: npx agentforge run sim/scenarios/stress.ts --ci --seed 42
```

Assertions fail CI on invariant violations.

## API

```typescript
// Core
import { defineScenario, BaseAgent, SimulationEngine } from '@elata-biosciences/agentforge';
import type { Scenario, Action, TickContext, Pack } from '@elata-biosciences/agentforge';

// Adapters
import { spawnAnvil, createViemClient } from '@elata-biosciences/agentforge/adapters';

// Toy simulation
import { ToyPack, RandomTraderAgent, MomentumAgent } from '@elata-biosciences/agentforge/toy';
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT

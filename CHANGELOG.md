# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-01-27

### Added

- Initial public release of AgentForge
- **Core Simulation Framework**
  - `defineScenario()` for declarative scenario configuration
  - `BaseAgent` class with memory, cooldowns, and parameter support
  - `SimulationEngine` for orchestrating simulation lifecycle
  - Deterministic seeded RNG for reproducible results
- **Scheduling Strategies**
  - Round-robin execution
  - Random (shuffled) execution
  - Priority-based execution
- **Metrics and Analytics**
  - Time-series metric collection
  - CSV export for analysis
  - JSON summary generation
  - Action logging (NDJSON format)
- **Assertions System**
  - Post-simulation validation
  - Comparison operators: `gt`, `gte`, `lt`, `lte`, `eq`
  - CI-friendly exit codes on assertion failure
- **CLI Tool (`agentforge` / `forge-sim`)**
  - `init` - Initialize simulation folder structure
  - `run` - Execute scenario files
  - `doctor` - Check environment dependencies
  - `types` - Generate TypeScript types from Foundry artifacts
- **Adapters**
  - Anvil adapter for local EVM simulation
  - Viem client integration
  - Foundry artifact parsing
- **Toy Simulation Pack**
  - `ToyPack` for development and testing
  - `RandomTraderAgent` - Random buy/sell decisions
  - `MomentumAgent` - Trend-following behavior
  - `MarketMakerAgent` - Spread-based market making
- **Developer Experience**
  - Full TypeScript support with type inference
  - ESM module format
  - Comprehensive JSDoc documentation on core APIs
  - Example scenarios in `examples/` directory

### Documentation

- README with installation, quick start, and API reference
- CONTRIBUTING.md with development guidelines
- Example scenarios demonstrating key features

[Unreleased]: https://github.com/wkyleg/agentforge/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/wkyleg/agentforge/releases/tag/v0.1.0

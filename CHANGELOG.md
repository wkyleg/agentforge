# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-01-29

### Added

- **New CLI Commands**
  - `report` - Generate markdown reports from run artifacts with KPI summaries, action analysis, and determinism fingerprints
  - `compare` - Compare two simulation runs with diff analysis and threshold checking
  - `sweep` - Run scenarios with multiple seeds and generate aggregate statistics (min/max/mean/percentiles)
  - `matrix` - Run scenarios with multiple variants for A/B testing and pairwise comparison
- **Checkpoints and Probes**
  - `CheckpointWriter` for periodic state snapshots during simulation
  - `ProbeSampler` for custom metric collection (computed, balance, call types)
  - Configurable checkpoint intervals and probe sampling
- **Variants System**
  - Define scenario variants for matrix testing
  - Automatic pairwise comparison between variants
  - Support for variant-specific pack and configuration overrides
- **Reporting System**
  - Markdown report generation with time-series statistics
  - Run comparison with KPI diffs and percentage changes
  - Sweep reports with tail risk analysis
  - Matrix reports with variant comparison tables
- **Documentation**
  - `docs/concepts.md` - Core concepts reference
  - `docs/ci.md` - CI/CD integration guide
  - `docs/reporting.md` - Reporting commands guide
- **Example Experiments**
  - `ordering-tax` - MEV ordering policy simulation
  - `timing-auction` - Auction timing advantage analysis
- **Enhanced CLI Options**
  - `--output-path` for stable naming in CI
  - `--summary` for one-line output
  - `--toy` flag for sweep command (consistency with run)

### Fixed

- **Determinism Bug** - Action ID generation now uses deterministic counter instead of `Date.now()`
- **Type Safety** - Fixed 24 type errors across matrix, sweep, report, and variants modules
- **Lint Compliance** - Resolved all Biome lint errors (import organization, unused variables, optional chaining)
- **Artifact Formatting** - JSON artifacts now include trailing newlines
- **Doctor Command** - Renamed filesystem check to "Temp directory" for clarity

### Changed

- Improved `doctor` command with better write access checks and summary output
- Enhanced determinism tests with normalized hash comparison (excludes wall-clock fields)

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

[Unreleased]: https://github.com/wkyleg/agentforge/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/wkyleg/agentforge/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/wkyleg/agentforge/releases/tag/v0.1.0

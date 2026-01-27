/**
 * Adapters for external tools and services
 *
 * Phase 1: Stubs with basic functionality
 * Phase 2: Full implementations
 */

// Anvil adapter
export {
  isAnvilInstalled,
  getAnvilVersion,
  spawnAnvil,
  stopAnvil,
  anvilRpc,
} from './anvil.js';
export type { AnvilConfig, AnvilInstance } from './anvil.js';

// Foundry adapter
export {
  isFoundryProject,
  findFoundryRoot,
  isFoundryInstalled,
  getFoundryVersion,
  parseFoundryConfig,
  forgeBuild,
  loadArtifact,
  listArtifacts,
  forgeScript,
  parseBroadcast,
  getDeployedAddresses,
} from './foundry.js';
export type { FoundryConfig, ContractArtifact, BroadcastTransaction } from './foundry.js';

// Viem adapter
export {
  createViemPublicClient,
  createAgentWallet,
  createContractInstance,
  createClientManager,
  ViemClientManager,
  waitForTransaction,
  estimateGas,
} from './viem.js';
export type { ClientConfig, AgentWalletConfig, ContractConfig } from './viem.js';

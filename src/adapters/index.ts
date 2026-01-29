/**
 * Adapters for external tools and services
 *
 * Provides integration with:
 * - Anvil (local Ethereum node)
 * - Foundry (build and deployment tools)
 * - Viem (EVM client library)
 */

// Anvil adapter
export {
  isAnvilInstalled,
  getAnvilVersion,
  spawnAnvil,
  stopAnvil,
  anvilRpc,
  advanceTime,
  advanceToTimestamp,
  fundAccounts,
  createTestAnvilConfig,
  DEFAULT_ANVIL_CONFIG,
  DEFAULT_ANVIL_MNEMONIC,
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
  forgeClean,
  forgeTest,
  forgeScript,
  loadArtifact,
  loadArtifacts,
  listArtifacts,
  parseBroadcast,
  getDeployedAddresses,
  getAllDeployedAddresses,
  generateTypes,
  DEFAULT_FOUNDRY_CONFIG,
} from './foundry.js';
export type {
  FoundryConfig,
  ContractArtifact,
  BroadcastTransaction,
  ForgeScriptOptions,
} from './foundry.js';

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

/**
 * Viem adapter - provides type-safe EVM client helpers
 *
 * Phase 2 will implement:
 * - Public client creation
 * - Wallet client creation for agents
 * - Contract instance creation from artifacts
 * - Transaction helpers (send, wait, decode)
 * - Event watching and filtering
 */

import {
  http,
  type Abi,
  type Account,
  type Chain,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  getContract,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

/**
 * Client configuration
 */
export interface ClientConfig {
  /** RPC URL */
  rpcUrl: string;
  /** Chain configuration */
  chain?: Chain;
}

/**
 * Agent wallet configuration
 */
export interface AgentWalletConfig {
  /** Private key (hex string with 0x prefix) */
  privateKey?: `0x${string}`;
  /** Generate a new key if not provided */
  generateKey?: boolean;
}

/**
 * Contract configuration
 */
export interface ContractConfig {
  /** Contract address */
  address: `0x${string}`;
  /** Contract ABI */
  abi: Abi;
}

/**
 * Create a public client for reading chain state
 */
export function createViemPublicClient(config: ClientConfig): PublicClient {
  return createPublicClient({
    chain: config.chain ?? foundry,
    transport: http(config.rpcUrl),
  });
}

/**
 * Create a wallet client for an agent
 */
export function createAgentWallet(
  config: ClientConfig,
  walletConfig: AgentWalletConfig = {}
): { client: WalletClient; account: Account; privateKey: `0x${string}` } {
  const privateKey =
    walletConfig.privateKey ??
    (walletConfig.generateKey !== false ? generatePrivateKey() : undefined);

  if (!privateKey) {
    throw new Error('No private key provided and key generation disabled');
  }

  const account = privateKeyToAccount(privateKey);

  const client = createWalletClient({
    account,
    chain: config.chain ?? foundry,
    transport: http(config.rpcUrl),
  });

  return { client, account, privateKey };
}

/**
 * Create a contract instance
 *
 * @stub Full implementation in Phase 2
 */
export function createContractInstance(
  config: ContractConfig,
  publicClient: PublicClient,
  walletClient?: WalletClient
): ReturnType<typeof getContract> {
  return getContract({
    address: config.address,
    abi: config.abi,
    client: {
      public: publicClient,
      wallet: walletClient,
    },
  });
}

/**
 * Client manager for simulations
 *
 * @stub Phase 2 will expand this significantly
 */
export class ViemClientManager {
  private readonly rpcUrl: string;
  private readonly chain: Chain;
  private publicClient: PublicClient | null = null;
  private walletClients: Map<string, WalletClient> = new Map();
  private accounts: Map<string, Account> = new Map();

  constructor(config: ClientConfig) {
    this.rpcUrl = config.rpcUrl;
    this.chain = config.chain ?? foundry;
  }

  /**
   * Get or create public client
   */
  getPublicClient(): PublicClient {
    if (!this.publicClient) {
      this.publicClient = createViemPublicClient({
        rpcUrl: this.rpcUrl,
        chain: this.chain,
      });
    }
    return this.publicClient;
  }

  /**
   * Get or create wallet client for an agent
   */
  getWalletClient(agentId: string, privateKey?: `0x${string}`): WalletClient {
    let client = this.walletClients.get(agentId);

    if (!client) {
      const walletConfig: AgentWalletConfig = privateKey
        ? { privateKey, generateKey: false }
        : { generateKey: true };
      const result = createAgentWallet({ rpcUrl: this.rpcUrl, chain: this.chain }, walletConfig);
      client = result.client;
      this.walletClients.set(agentId, client);
      this.accounts.set(agentId, result.account);
    }

    return client;
  }

  /**
   * Get account for an agent
   */
  getAccount(agentId: string): Account | undefined {
    return this.accounts.get(agentId);
  }

  /**
   * Get agent address
   */
  getAddress(agentId: string): `0x${string}` | undefined {
    return this.accounts.get(agentId)?.address;
  }

  /**
   * Get all agent addresses
   */
  getAllAddresses(): Map<string, `0x${string}`> {
    const addresses = new Map<string, `0x${string}`>();
    for (const [id, account] of this.accounts) {
      addresses.set(id, account.address);
    }
    return addresses;
  }

  /**
   * Reset all clients
   */
  reset(): void {
    this.publicClient = null;
    this.walletClients.clear();
    this.accounts.clear();
  }
}

/**
 * Create a client manager
 */
export function createClientManager(config: ClientConfig): ViemClientManager {
  return new ViemClientManager(config);
}

/**
 * Helper to wait for a transaction receipt
 *
 * @stub Phase 2 implementation
 */
export async function waitForTransaction(
  _client: PublicClient,
  _hash: `0x${string}`
): Promise<unknown> {
  // Phase 2: Implement with proper typing
  throw new Error('Not implemented in Phase 1');
}

/**
 * Helper to estimate gas for a transaction
 *
 * @stub Phase 2 implementation
 */
export async function estimateGas(_client: PublicClient, _tx: unknown): Promise<bigint> {
  // Phase 2: Implement
  throw new Error('Not implemented in Phase 1');
}

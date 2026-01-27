/**
 * Mock RPC client for testing adapter code
 */

export interface MockRpcCall {
  method: string;
  params: unknown[];
  timestamp: number;
}

export interface MockRpcConfig {
  /** Default block number to return */
  blockNumber?: bigint;
  /** Default chain ID to return */
  chainId?: number;
  /** Default balance to return */
  balance?: bigint;
  /** Whether to fail all calls */
  failAll?: boolean;
  /** Error message when failing */
  errorMessage?: string;
  /** Delay in ms before responding */
  delay?: number;
}

/**
 * Mock RPC client that records calls and returns configurable responses
 */
export class MockRpcClient {
  readonly calls: MockRpcCall[] = [];
  private config: MockRpcConfig;
  private responses: Map<string, unknown> = new Map();

  constructor(config: MockRpcConfig = {}) {
    this.config = {
      blockNumber: 1000n,
      chainId: 31337,
      balance: 10n ** 18n, // 1 ETH
      failAll: false,
      delay: 0,
      ...config,
    };

    this.setupDefaultResponses();
  }

  private setupDefaultResponses(): void {
    this.responses.set('eth_blockNumber', () => `0x${this.config.blockNumber?.toString(16)}`);
    this.responses.set('eth_chainId', () => `0x${this.config.chainId?.toString(16)}`);
    this.responses.set('eth_getBalance', () => `0x${this.config.balance?.toString(16)}`);
    this.responses.set('eth_gasPrice', () => '0x3b9aca00'); // 1 gwei
    this.responses.set('eth_getTransactionCount', () => '0x0');
    this.responses.set('eth_estimateGas', () => '0x5208'); // 21000
    this.responses.set('eth_sendTransaction', () => `0x${'0'.repeat(64)}`);
    this.responses.set('eth_getTransactionReceipt', () => ({
      status: '0x1',
      blockNumber: `0x${this.config.blockNumber?.toString(16)}`,
      gasUsed: '0x5208',
    }));
    this.responses.set('anvil_mine', () => null);
    this.responses.set('evm_increaseTime', () => '0x0');
    this.responses.set('evm_mine', () => null);
    this.responses.set('evm_snapshot', () => '0x1');
    this.responses.set('evm_revert', () => true);
  }

  /**
   * Set a custom response for a method
   */
  setResponse(method: string, response: unknown | (() => unknown)): void {
    this.responses.set(method, response);
  }

  /**
   * Make an RPC request
   */
  async request(args: { method: string; params?: unknown[] }): Promise<unknown> {
    const call: MockRpcCall = {
      method: args.method,
      params: args.params ?? [],
      timestamp: Date.now(),
    };
    this.calls.push(call);

    if (this.config.delay && this.config.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.config.delay));
    }

    if (this.config.failAll) {
      throw new Error(this.config.errorMessage ?? 'RPC error');
    }

    const response = this.responses.get(args.method);
    if (response === undefined) {
      throw new Error(`Unknown RPC method: ${args.method}`);
    }

    return typeof response === 'function' ? response() : response;
  }

  /**
   * Get calls for a specific method
   */
  getCallsForMethod(method: string): MockRpcCall[] {
    return this.calls.filter((c) => c.method === method);
  }

  /**
   * Check if a method was called
   */
  wasMethodCalled(method: string): boolean {
    return this.calls.some((c) => c.method === method);
  }

  /**
   * Get the count of calls for a method
   */
  getCallCount(method: string): number {
    return this.getCallsForMethod(method).length;
  }

  /**
   * Reset all recorded calls
   */
  reset(): void {
    this.calls.length = 0;
  }

  /**
   * Configure the mock
   */
  configure(config: Partial<MockRpcConfig>): void {
    this.config = { ...this.config, ...config };
    this.setupDefaultResponses();
  }
}

/**
 * Create a mock RPC client with default configuration
 */
export function createMockRpcClient(config: MockRpcConfig = {}): MockRpcClient {
  return new MockRpcClient(config);
}

/**
 * Create a mock RPC client that fails all requests
 */
export function createFailingRpcClient(errorMessage = 'RPC connection failed'): MockRpcClient {
  return new MockRpcClient({
    failAll: true,
    errorMessage,
  });
}

/**
 * Mock transport for Viem
 */
export function createMockTransport(client: MockRpcClient) {
  return () => ({
    request: (args: { method: string; params?: unknown[] }) => client.request(args),
  });
}

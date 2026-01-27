/**
 * Mock utilities for testing AgentForge
 */

// Logger mocks
export {
  createMockLogger,
  createRecordingLogger,
  type LogEntry,
  type RecordingLogger,
} from './mockLogger.js';

// Pack mocks
export {
  MockPack,
  createMockPack,
  createFailingPack,
  createConfigurablePack,
  type MockPackConfig,
} from './mockPack.js';

// Agent mocks
export {
  MockAgent,
  OrderTrackingAgent,
  createActiveAgent,
  createPassiveAgent,
  createStochasticAgent,
  createThrowingAgent,
  createMockAgents,
  type MockAgentConfig,
} from './mockAgent.js';

// RPC mocks
export {
  MockRpcClient,
  createMockRpcClient,
  createFailingRpcClient,
  createMockTransport,
  type MockRpcCall,
  type MockRpcConfig,
} from './mockRpc.js';

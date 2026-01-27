/**
 * Typed error classes for AgentForge
 *
 * These errors provide structured information about failures
 * and can be used for error classification and handling.
 */

/**
 * Base error class for AgentForge errors
 */
export abstract class AgentForgeError extends Error {
  /** Error code for programmatic handling */
  abstract readonly code: string;
  /** Whether this error is recoverable */
  abstract readonly recoverable: boolean;
  /** Original cause if wrapping another error */
  readonly errorCause?: Error | undefined;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    this.errorCause = cause;

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert to a plain object for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      recoverable: this.recoverable,
      cause: this.errorCause?.message,
      stack: this.stack,
    };
  }
}

/**
 * Error thrown when a contract call reverts
 */
export class RevertError extends AgentForgeError {
  readonly code = 'REVERT';
  readonly recoverable = true;
  /** The contract function that reverted */
  readonly functionName: string | undefined;
  /** The revert reason if available */
  readonly reason: string | undefined;
  /** The raw revert data */
  readonly data: string | undefined;

  constructor(
    message: string,
    options?: {
      functionName?: string;
      reason?: string;
      data?: string;
      cause?: Error;
    }
  ) {
    super(message, options?.cause);
    this.functionName = options?.functionName;
    this.reason = options?.reason;
    this.data = options?.data;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      functionName: this.functionName,
      reason: this.reason,
      data: this.data,
    };
  }
}

/**
 * Error thrown when an RPC call fails
 */
export class RpcError extends AgentForgeError {
  readonly code = 'RPC_ERROR';
  readonly recoverable = true;
  /** The RPC method that failed */
  readonly method: string | undefined;
  /** The RPC error code */
  readonly rpcCode: number | undefined;
  /** The RPC URL */
  readonly url: string | undefined;

  constructor(
    message: string,
    options?: {
      method?: string;
      rpcCode?: number;
      url?: string;
      cause?: Error;
    }
  ) {
    super(message, options?.cause);
    this.method = options?.method;
    this.rpcCode = options?.rpcCode;
    this.url = options?.url;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      method: this.method,
      rpcCode: this.rpcCode,
      url: this.url,
    };
  }
}

/**
 * Error thrown when an operation times out
 */
export class TimeoutError extends AgentForgeError {
  readonly code = 'TIMEOUT';
  readonly recoverable = true;
  /** The timeout duration in milliseconds */
  readonly timeoutMs: number;
  /** The operation that timed out */
  readonly operation: string | undefined;

  constructor(
    message: string,
    timeoutMs: number,
    options?: {
      operation?: string;
      cause?: Error;
    }
  ) {
    super(message, options?.cause);
    this.timeoutMs = timeoutMs;
    this.operation = options?.operation;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      timeoutMs: this.timeoutMs,
      operation: this.operation,
    };
  }
}

/**
 * Error thrown when nonce management fails
 */
export class NonceError extends AgentForgeError {
  readonly code = 'NONCE_ERROR';
  readonly recoverable = true;
  /** The expected nonce */
  readonly expected: number | undefined;
  /** The actual nonce */
  readonly actual: number | undefined;
  /** The address associated with the nonce */
  readonly address: string | undefined;

  constructor(
    message: string,
    options?: {
      expected?: number;
      actual?: number;
      address?: string;
      cause?: Error;
    }
  ) {
    super(message, options?.cause);
    this.expected = options?.expected;
    this.actual = options?.actual;
    this.address = options?.address;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      expected: this.expected,
      actual: this.actual,
      address: this.address,
    };
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends AgentForgeError {
  readonly code = 'CONFIG_ERROR';
  readonly recoverable = false;
  /** The configuration key that is invalid */
  readonly key: string | undefined;
  /** The invalid value */
  readonly value: unknown;

  constructor(
    message: string,
    options?: {
      key?: string;
      value?: unknown;
      cause?: Error;
    }
  ) {
    super(message, options?.cause);
    this.key = options?.key;
    this.value = options?.value;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      key: this.key,
      value: this.value,
    };
  }
}

/**
 * Error thrown when a precondition fails
 */
export class PreconditionError extends AgentForgeError {
  readonly code = 'PRECONDITION_FAILED';
  readonly recoverable = true;
  /** The precondition that failed */
  readonly precondition: string;
  /** Additional context about the failure */
  readonly context: Record<string, unknown> | undefined;

  constructor(
    message: string,
    precondition: string,
    options?: {
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message, options?.cause);
    this.precondition = precondition;
    this.context = options?.context;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      precondition: this.precondition,
      context: this.context,
    };
  }
}

/**
 * Error thrown when a simulation assertion fails
 */
export class AssertionError extends AgentForgeError {
  readonly code = 'ASSERTION_FAILED';
  readonly recoverable = false;
  /** The metric that failed */
  readonly metric: string;
  /** The expected value/condition */
  readonly expected: string;
  /** The actual value */
  readonly actual: unknown;

  constructor(
    message: string,
    options: {
      metric: string;
      expected: string;
      actual: unknown;
      cause?: Error;
    }
  ) {
    super(message, options.cause);
    this.metric = options.metric;
    this.expected = options.expected;
    this.actual = options.actual;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      metric: this.metric,
      expected: this.expected,
      actual: this.actual,
    };
  }
}

/**
 * Error thrown when an agent encounters an error
 */
export class AgentError extends AgentForgeError {
  readonly code = 'AGENT_ERROR';
  readonly recoverable = true;
  /** The agent ID */
  readonly agentId: string;
  /** The agent type */
  readonly agentType: string | undefined;
  /** The tick when the error occurred */
  readonly tick: number | undefined;

  constructor(
    message: string,
    agentId: string,
    options?: {
      agentType?: string;
      tick?: number;
      cause?: Error;
    }
  ) {
    super(message, options?.cause);
    this.agentId = agentId;
    this.agentType = options?.agentType;
    this.tick = options?.tick;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      agentId: this.agentId,
      agentType: this.agentType,
      tick: this.tick,
    };
  }
}

/**
 * Error thrown when Anvil operations fail
 */
export class AnvilError extends AgentForgeError {
  readonly code = 'ANVIL_ERROR';
  readonly recoverable = false;
  /** The Anvil command that failed */
  readonly command: string | undefined;
  /** The Anvil port */
  readonly port: number | undefined;

  constructor(
    message: string,
    options?: {
      command?: string;
      port?: number;
      cause?: Error;
    }
  ) {
    super(message, options?.cause);
    this.command = options?.command;
    this.port = options?.port;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      command: this.command,
      port: this.port,
    };
  }
}

/**
 * Type guard to check if an error is an AgentForge error
 */
export function isAgentForgeError(error: unknown): error is AgentForgeError {
  return error instanceof AgentForgeError;
}

/**
 * Type guard for RevertError
 */
export function isRevertError(error: unknown): error is RevertError {
  return error instanceof RevertError;
}

/**
 * Type guard for RpcError
 */
export function isRpcError(error: unknown): error is RpcError {
  return error instanceof RpcError;
}

/**
 * Type guard for TimeoutError
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Classify an error into one of the known error types
 */
export function classifyError(error: unknown): string {
  if (isAgentForgeError(error)) {
    return error.code;
  }

  if (error instanceof Error) {
    // Try to classify based on error message patterns
    const message = error.message.toLowerCase();

    if (message.includes('revert') || message.includes('execution reverted')) {
      return 'REVERT';
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'TIMEOUT';
    }
    if (message.includes('nonce')) {
      return 'NONCE_ERROR';
    }
    if (message.includes('rpc') || message.includes('connection') || message.includes('network')) {
      return 'RPC_ERROR';
    }
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Wrap an unknown error in an appropriate AgentForge error type
 */
export function wrapError(error: unknown, context?: string): AgentForgeError {
  if (isAgentForgeError(error)) {
    return error;
  }

  const errorObj = error instanceof Error ? error : new Error(String(error));
  const classification = classifyError(error);
  const message = context ? `${context}: ${errorObj.message}` : errorObj.message;

  switch (classification) {
    case 'REVERT':
      return new RevertError(message, { cause: errorObj });
    case 'TIMEOUT':
      return new TimeoutError(message, 0, { cause: errorObj });
    case 'NONCE_ERROR':
      return new NonceError(message, { cause: errorObj });
    case 'RPC_ERROR':
      return new RpcError(message, { cause: errorObj });
    default:
      return new ConfigurationError(message, { cause: errorObj });
  }
}

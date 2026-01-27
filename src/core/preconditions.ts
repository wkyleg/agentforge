import { PreconditionError } from './errors.js';
import type { TickContext, WorldState } from './types.js';

/**
 * Precondition result with optional error context
 */
export interface PreconditionResult {
  passed: boolean;
  message?: string;
  context?: Record<string, unknown>;
}

/**
 * Check if an agent has sufficient balance of a token
 */
export function hasBalance(
  world: WorldState,
  agentId: string,
  token: string,
  amount: bigint
): PreconditionResult {
  // Look for balance in world state
  const balances = world.balances as Record<string, Record<string, bigint>> | undefined;
  const agentBalances = balances?.[agentId];
  const balance = agentBalances?.[token] ?? 0n;

  if (balance >= amount) {
    return { passed: true };
  }

  return {
    passed: false,
    message: `Insufficient ${token} balance: has ${balance}, needs ${amount}`,
    context: { token, required: amount.toString(), actual: balance.toString() },
  };
}

/**
 * Check if an agent has sufficient allowance for a spender
 */
export function hasAllowance(
  world: WorldState,
  agentId: string,
  token: string,
  spender: string,
  amount: bigint
): PreconditionResult {
  // Look for allowances in world state
  const allowances = world.allowances as
    | Record<string, Record<string, Record<string, bigint>>>
    | undefined;
  const agentAllowances = allowances?.[agentId];
  const tokenAllowances = agentAllowances?.[token];
  const allowance = tokenAllowances?.[spender] ?? 0n;

  if (allowance >= amount) {
    return { passed: true };
  }

  return {
    passed: false,
    message: `Insufficient ${token} allowance for ${spender}: has ${allowance}, needs ${amount}`,
    context: {
      token,
      spender,
      required: amount.toString(),
      actual: allowance.toString(),
    },
  };
}

/**
 * Check if current timestamp is within a time window
 */
export function withinTimeWindow(
  ctx: TickContext,
  startTime: number,
  endTime: number
): PreconditionResult {
  const current = ctx.timestamp;

  if (current >= startTime && current <= endTime) {
    return { passed: true };
  }

  return {
    passed: false,
    message: `Current time ${current} is outside window [${startTime}, ${endTime}]`,
    context: { current, startTime, endTime },
  };
}

/**
 * Check if an action is not on cooldown for an agent
 */
export function notOnCooldown(
  cooldowns: Map<string, number>,
  actionName: string,
  currentTick: number
): PreconditionResult {
  const cooldownUntil = cooldowns.get(actionName);

  if (cooldownUntil === undefined || currentTick >= cooldownUntil) {
    return { passed: true };
  }

  return {
    passed: false,
    message: `Action ${actionName} is on cooldown until tick ${cooldownUntil}`,
    context: { actionName, cooldownUntil, currentTick },
  };
}

/**
 * Check if a numeric value is within a range
 */
export function inRange(
  value: number,
  min: number,
  max: number,
  label = 'value'
): PreconditionResult {
  if (value >= min && value <= max) {
    return { passed: true };
  }

  return {
    passed: false,
    message: `${label} ${value} is outside range [${min}, ${max}]`,
    context: { value, min, max },
  };
}

/**
 * Check if a value is greater than a threshold
 */
export function greaterThan(value: number, threshold: number, label = 'value'): PreconditionResult {
  if (value > threshold) {
    return { passed: true };
  }

  return {
    passed: false,
    message: `${label} ${value} is not greater than ${threshold}`,
    context: { value, threshold },
  };
}

/**
 * Check if a value is less than a threshold
 */
export function lessThan(value: number, threshold: number, label = 'value'): PreconditionResult {
  if (value < threshold) {
    return { passed: true };
  }

  return {
    passed: false,
    message: `${label} ${value} is not less than ${threshold}`,
    context: { value, threshold },
  };
}

/**
 * Combine multiple preconditions with AND logic
 */
export function all(...preconditions: PreconditionResult[]): PreconditionResult {
  for (const precondition of preconditions) {
    if (!precondition.passed) {
      return precondition;
    }
  }
  return { passed: true };
}

/**
 * Combine multiple preconditions with OR logic
 */
export function any(...preconditions: PreconditionResult[]): PreconditionResult {
  const failures: string[] = [];

  for (const precondition of preconditions) {
    if (precondition.passed) {
      return { passed: true };
    }
    if (precondition.message) {
      failures.push(precondition.message);
    }
  }

  return {
    passed: false,
    message: `All preconditions failed: ${failures.join('; ')}`,
  };
}

/**
 * Assert that a precondition passes, throwing if it fails
 */
export function assertPrecondition(result: PreconditionResult, preconditionName: string): void {
  if (!result.passed) {
    const options = result.context ? { context: result.context } : undefined;
    throw new PreconditionError(
      result.message ?? `Precondition "${preconditionName}" failed`,
      preconditionName,
      options
    );
  }
}

/**
 * Check preconditions and return a tuple of [passed, error]
 */
export function checkPreconditions(
  ...preconditions: PreconditionResult[]
): [boolean, PreconditionResult | null] {
  const result = all(...preconditions);
  return [result.passed, result.passed ? null : result];
}

/**
 * Create a precondition builder for fluent API
 */
export class PreconditionBuilder {
  private conditions: PreconditionResult[] = [];

  /**
   * Add a balance check
   */
  hasBalance(world: WorldState, agentId: string, token: string, amount: bigint): this {
    this.conditions.push(hasBalance(world, agentId, token, amount));
    return this;
  }

  /**
   * Add an allowance check
   */
  hasAllowance(
    world: WorldState,
    agentId: string,
    token: string,
    spender: string,
    amount: bigint
  ): this {
    this.conditions.push(hasAllowance(world, agentId, token, spender, amount));
    return this;
  }

  /**
   * Add a time window check
   */
  withinTimeWindow(ctx: TickContext, startTime: number, endTime: number): this {
    this.conditions.push(withinTimeWindow(ctx, startTime, endTime));
    return this;
  }

  /**
   * Add a cooldown check
   */
  notOnCooldown(cooldowns: Map<string, number>, actionName: string, currentTick: number): this {
    this.conditions.push(notOnCooldown(cooldowns, actionName, currentTick));
    return this;
  }

  /**
   * Add a custom precondition
   */
  custom(result: PreconditionResult): this {
    this.conditions.push(result);
    return this;
  }

  /**
   * Check all preconditions
   */
  check(): PreconditionResult {
    return all(...this.conditions);
  }

  /**
   * Assert all preconditions pass
   */
  assert(name: string): void {
    assertPrecondition(this.check(), name);
  }

  /**
   * Reset the builder
   */
  reset(): this {
    this.conditions = [];
    return this;
  }
}

/**
 * Create a new precondition builder
 */
export function preconditions(): PreconditionBuilder {
  return new PreconditionBuilder();
}

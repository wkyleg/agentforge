import type { BaseAgent } from './agent.js';
import type { Rng } from './rng.js';

/**
 * Scheduling strategies for agent execution order
 */
export type SchedulingStrategy = 'random' | 'round-robin' | 'priority';

/**
 * Options for the scheduler
 */
export interface SchedulerOptions {
  /** Scheduling strategy (default: 'random') */
  strategy?: SchedulingStrategy;
  /** Priority function for priority scheduling */
  priorityFn?: (agent: BaseAgent) => number;
}

/**
 * Scheduler determines the order in which agents act each tick
 *
 * Supports multiple strategies:
 * - random: Shuffle agents each tick using seeded RNG (default)
 * - round-robin: Rotate starting position each tick
 * - priority: Order by priority value (higher first)
 */
export class Scheduler {
  private readonly strategy: SchedulingStrategy;
  private readonly priorityFn: ((agent: BaseAgent) => number) | undefined;
  private roundRobinOffset = 0;

  constructor(options: SchedulerOptions = {}) {
    this.strategy = options.strategy ?? 'random';
    this.priorityFn = options.priorityFn;
  }

  /**
   * Get the execution order for agents this tick
   *
   * @param agents - All agents in the simulation
   * @param tick - Current tick number
   * @param rng - Seeded RNG for this tick
   * @returns Agents in execution order
   */
  getOrder(agents: readonly BaseAgent[], tick: number, rng: Rng): BaseAgent[] {
    // Create a copy to avoid mutating the original
    const ordered = [...agents];

    switch (this.strategy) {
      case 'random':
        return this.shuffleOrder(ordered, rng);
      case 'round-robin':
        return this.roundRobinOrder(ordered, tick);
      case 'priority':
        return this.priorityOrder(ordered);
      default:
        return this.shuffleOrder(ordered, rng);
    }
  }

  /**
   * Shuffle agents using Fisher-Yates with seeded RNG
   */
  private shuffleOrder(agents: BaseAgent[], rng: Rng): BaseAgent[] {
    return rng.shuffle(agents);
  }

  /**
   * Rotate starting position each tick
   */
  private roundRobinOrder(agents: BaseAgent[], _tick: number): BaseAgent[] {
    if (agents.length === 0) {
      return agents;
    }

    this.roundRobinOffset = (this.roundRobinOffset + 1) % agents.length;

    return [...agents.slice(this.roundRobinOffset), ...agents.slice(0, this.roundRobinOffset)];
  }

  /**
   * Order by priority value (higher first)
   */
  private priorityOrder(agents: BaseAgent[]): BaseAgent[] {
    if (!this.priorityFn) {
      return agents;
    }

    return agents.sort((a, b) => {
      // biome-ignore lint/style/noNonNullAssertion: checked above
      const priorityA = this.priorityFn!(a);
      // biome-ignore lint/style/noNonNullAssertion: checked above
      const priorityB = this.priorityFn!(b);
      return priorityB - priorityA; // Higher priority first
    });
  }

  /**
   * Reset scheduler state (useful between runs)
   */
  reset(): void {
    this.roundRobinOffset = 0;
  }
}

/**
 * Create a scheduler with the default random strategy
 */
export function createScheduler(options?: SchedulerOptions): Scheduler {
  return new Scheduler(options);
}

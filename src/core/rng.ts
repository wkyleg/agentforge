/**
 * Seeded pseudo-random number generator using xorshift128+
 * Provides deterministic randomness for reproducible simulations
 */
export class Rng {
  private state0: bigint;
  private state1: bigint;

  constructor(seed: number) {
    // Initialize state from seed using splitmix64
    let s = BigInt(seed) & 0xffffffffffffffffn;

    s = (s ^ (s >> 30n)) * 0xbf58476d1ce4e5b9n;
    s = s & 0xffffffffffffffffn;
    s = (s ^ (s >> 27n)) * 0x94d049bb133111ebn;
    s = s & 0xffffffffffffffffn;
    this.state0 = s ^ (s >> 31n);

    s = (this.state0 ^ (this.state0 >> 30n)) * 0xbf58476d1ce4e5b9n;
    s = s & 0xffffffffffffffffn;
    s = (s ^ (s >> 27n)) * 0x94d049bb133111ebn;
    s = s & 0xffffffffffffffffn;
    this.state1 = s ^ (s >> 31n);

    // Ensure non-zero state
    if (this.state0 === 0n && this.state1 === 0n) {
      this.state0 = 1n;
    }
  }

  /**
   * Create a new RNG with a derived seed for a specific tick and agent
   */
  derive(tick: number, agentId?: string): Rng {
    let derivedSeed = Number(this.state0 & 0xffffffffn) ^ tick;
    if (agentId) {
      // Simple hash of agent ID
      for (let i = 0; i < agentId.length; i++) {
        derivedSeed = ((derivedSeed << 5) - derivedSeed + agentId.charCodeAt(i)) | 0;
      }
    }
    return new Rng(derivedSeed);
  }

  /**
   * Generate next 64-bit value using xorshift128+
   */
  private next(): bigint {
    let s1 = this.state0;
    const s0 = this.state1;
    const result = (s0 + s1) & 0xffffffffffffffffn;

    this.state0 = s0;
    s1 ^= s1 << 23n;
    s1 = s1 & 0xffffffffffffffffn;
    this.state1 = s1 ^ s0 ^ (s1 >> 18n) ^ (s0 >> 5n);

    return result;
  }

  /**
   * Generate a random 32-bit unsigned integer
   */
  nextU32(): number {
    return Number(this.next() & 0xffffffffn);
  }

  /**
   * Generate a random float in [0, 1)
   */
  nextFloat(): number {
    // Use 53 bits for full double precision
    const bits = this.next() >> 11n;
    return Number(bits) / 9007199254740992; // 2^53
  }

  /**
   * Generate a random integer in [min, max] (inclusive)
   */
  nextInt(min: number, max: number): number {
    if (min > max) {
      throw new Error(`min (${min}) must be <= max (${max})`);
    }
    const range = max - min + 1;
    return min + Math.floor(this.nextFloat() * range);
  }

  /**
   * Pick a random element from an array
   */
  pickOne<T>(arr: readonly T[]): T {
    if (arr.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    const index = Math.floor(this.nextFloat() * arr.length);
    // biome-ignore lint/style/noNonNullAssertion: length check above
    return arr[index]!;
  }

  /**
   * Pick a random element using weighted probabilities
   */
  weightedPick<T>(items: readonly { item: T; weight: number }[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from empty array');
    }

    const totalWeight = items.reduce((sum, { weight }) => sum + weight, 0);
    if (totalWeight <= 0) {
      throw new Error('Total weight must be positive');
    }

    let random = this.nextFloat() * totalWeight;

    for (const { item, weight } of items) {
      random -= weight;
      if (random <= 0) {
        return item;
      }
    }

    // Fallback to last item (shouldn't happen with proper weights)
    // biome-ignore lint/style/noNonNullAssertion: length check above
    return items[items.length - 1]!.item;
  }

  /**
   * Shuffle an array in place using Fisher-Yates algorithm
   */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.nextFloat() * (i + 1));
      // biome-ignore lint/style/noNonNullAssertion: index is valid
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
  }

  /**
   * Return true with the given probability
   */
  chance(probability: number): boolean {
    return this.nextFloat() < probability;
  }

  /**
   * Generate a random boolean
   */
  nextBool(): boolean {
    return this.chance(0.5);
  }
}

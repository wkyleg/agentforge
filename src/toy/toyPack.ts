import type { Action, ActionResult, Pack, WorldState } from '../core/types.js';

/**
 * Asset in the toy market
 */
export interface ToyAsset {
  name: string;
  price: number;
  volatility: number; // Price change multiplier
  volume: number; // Total traded volume
}

/**
 * Agent balance in the toy market
 */
export interface ToyBalance {
  cash: number;
  holdings: Map<string, number>; // asset name -> quantity
}

/**
 * Toy market state
 */
export interface ToyMarketState {
  assets: Map<string, ToyAsset>;
  balances: Map<string, ToyBalance>;
  priceHistory: Map<string, number[]>;
  tick: number;
  timestamp: number;
}

/**
 * Toy world state exposed to agents
 */
export interface ToyWorldState extends WorldState {
  assets: Array<{
    name: string;
    price: number;
    volume: number;
    priceChange: number; // % change from last tick
  }>;
  agentCash: number;
  agentHoldings: Record<string, number>;
}

/**
 * Configuration for the toy pack
 */
export interface ToyPackConfig {
  /** Initial assets */
  assets?: Array<{
    name: string;
    initialPrice: number;
    volatility?: number;
  }>;
  /** Initial cash per agent */
  initialCash?: number;
  /** Price drift per tick (random walk) */
  priceDrift?: number;
}

/**
 * Default toy pack configuration
 */
const DEFAULT_CONFIG: Required<ToyPackConfig> = {
  assets: [
    { name: 'ALPHA', initialPrice: 100, volatility: 0.05 },
    { name: 'BETA', initialPrice: 50, volatility: 0.08 },
    { name: 'GAMMA', initialPrice: 25, volatility: 0.12 },
  ],
  initialCash: 10000,
  priceDrift: 0.02,
};

/**
 * Toy pack for testing simulations without real contracts
 *
 * Simulates a simple market with:
 * - Multiple assets with price movements
 * - Buy/sell actions
 * - Portfolio tracking
 */
export class ToyPack implements Pack {
  readonly name = 'ToyPack';

  private config: Required<ToyPackConfig>;
  private state: ToyMarketState;
  private currentAgentId: string | null = null;
  private rngSeed = 12345;

  constructor(config: ToyPackConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.createInitialState();
  }

  private createInitialState(): ToyMarketState {
    const assets = new Map<string, ToyAsset>();
    const priceHistory = new Map<string, number[]>();

    for (const asset of this.config.assets) {
      assets.set(asset.name, {
        name: asset.name,
        price: asset.initialPrice,
        volatility: asset.volatility ?? 0.05,
        volume: 0,
      });
      priceHistory.set(asset.name, [asset.initialPrice]);
    }

    return {
      assets,
      balances: new Map(),
      priceHistory,
      tick: 0,
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  async initialize(): Promise<void> {
    this.state = this.createInitialState();
  }

  onTick(tick: number, timestamp: number): void {
    this.advanceTick(tick, timestamp);
  }

  getWorldState(): ToyWorldState {
    const agentBalance = this.getOrCreateBalance(this.currentAgentId ?? 'unknown');

    const assets = Array.from(this.state.assets.values()).map((asset) => {
      const history = this.state.priceHistory.get(asset.name) ?? [];
      const prevPrice =
        history.length > 1 ? (history[history.length - 2] ?? asset.price) : asset.price;
      const priceChange = prevPrice > 0 ? ((asset.price - prevPrice) / prevPrice) * 100 : 0;

      return {
        name: asset.name,
        price: asset.price,
        volume: asset.volume,
        priceChange,
      };
    });

    return {
      timestamp: this.state.timestamp,
      assets,
      agentCash: agentBalance.cash,
      agentHoldings: Object.fromEntries(agentBalance.holdings),
    };
  }

  /**
   * Set the current agent context for world state queries
   */
  setCurrentAgent(agentId: string): void {
    this.currentAgentId = agentId;
  }

  async executeAction(action: Action, agentId: string): Promise<ActionResult> {
    this.currentAgentId = agentId;

    switch (action.name) {
      case 'buy':
        return this.executeBuy(action, agentId);
      case 'sell':
        return this.executeSell(action, agentId);
      case 'hold':
        return this.executeHold();
      default:
        return {
          ok: false,
          error: `Unknown action: ${action.name}`,
        };
    }
  }

  private executeBuy(action: Action, agentId: string): ActionResult {
    const assetName = action.params.asset as string;
    const amount = action.params.amount as number;

    const asset = this.state.assets.get(assetName);
    if (!asset) {
      return { ok: false, error: `Asset not found: ${assetName}` };
    }

    const cost = asset.price * amount;
    const balance = this.getOrCreateBalance(agentId);

    if (balance.cash < cost) {
      return { ok: false, error: `Insufficient cash: need ${cost}, have ${balance.cash}` };
    }

    // Execute trade
    balance.cash -= cost;
    const currentHoldings = balance.holdings.get(assetName) ?? 0;
    balance.holdings.set(assetName, currentHoldings + amount);
    asset.volume += amount;

    return {
      ok: true,
      events: [{ name: 'Buy', args: { asset: assetName, amount, price: asset.price } }],
      balanceDeltas: { cash: BigInt(-Math.floor(cost * 100)) },
    };
  }

  private executeSell(action: Action, agentId: string): ActionResult {
    const assetName = action.params.asset as string;
    const amount = action.params.amount as number;

    const asset = this.state.assets.get(assetName);
    if (!asset) {
      return { ok: false, error: `Asset not found: ${assetName}` };
    }

    const balance = this.getOrCreateBalance(agentId);
    const holdings = balance.holdings.get(assetName) ?? 0;

    if (holdings < amount) {
      return { ok: false, error: `Insufficient holdings: need ${amount}, have ${holdings}` };
    }

    // Execute trade
    const proceeds = asset.price * amount;
    balance.cash += proceeds;
    balance.holdings.set(assetName, holdings - amount);
    asset.volume += amount;

    return {
      ok: true,
      events: [{ name: 'Sell', args: { asset: assetName, amount, price: asset.price } }],
      balanceDeltas: { cash: BigInt(Math.floor(proceeds * 100)) },
    };
  }

  private executeHold(): ActionResult {
    return { ok: true };
  }

  getMetrics(): Record<string, number | bigint | string> {
    const metrics: Record<string, number | bigint | string> = {
      tick: this.state.tick,
    };

    // Asset metrics
    let totalVolume = 0;
    for (const asset of this.state.assets.values()) {
      metrics[`price_${asset.name}`] = asset.price;
      metrics[`volume_${asset.name}`] = asset.volume;
      totalVolume += asset.volume;
    }
    metrics.totalVolume = totalVolume;

    // Calculate total agent value
    let totalAgentValue = 0;
    for (const [agentId, balance] of this.state.balances) {
      let agentValue = balance.cash;
      for (const [assetName, quantity] of balance.holdings) {
        const asset = this.state.assets.get(assetName);
        if (asset) {
          agentValue += asset.price * quantity;
        }
      }
      totalAgentValue += agentValue;
      metrics[`value_${agentId}`] = agentValue;
    }
    metrics.totalAgentValue = totalAgentValue;

    return metrics;
  }

  async cleanup(): Promise<void> {
    // Nothing to clean up
  }

  /**
   * Advance the market state (called between ticks)
   */
  advanceTick(tick: number, timestamp: number): void {
    this.state.tick = tick;
    this.state.timestamp = timestamp;

    // Simple random walk for prices
    for (const asset of this.state.assets.values()) {
      const change = (this.simpleRandom() - 0.5) * 2 * asset.volatility;
      asset.price = Math.max(0.01, asset.price * (1 + change));

      const history = this.state.priceHistory.get(asset.name);
      if (history) {
        history.push(asset.price);
        // Keep last 100 prices
        if (history.length > 100) {
          history.shift();
        }
      }
    }
  }

  /**
   * Simple deterministic random for price movements
   */
  private simpleRandom(): number {
    this.rngSeed = (this.rngSeed * 1103515245 + 12345) & 0x7fffffff;
    return this.rngSeed / 0x7fffffff;
  }

  /**
   * Get or create balance for an agent
   */
  private getOrCreateBalance(agentId: string): ToyBalance {
    let balance = this.state.balances.get(agentId);
    if (!balance) {
      balance = {
        cash: this.config.initialCash,
        holdings: new Map(),
      };
      this.state.balances.set(agentId, balance);
    }
    return balance;
  }

  /**
   * Get price history for an asset
   */
  getPriceHistory(assetName: string): number[] {
    return this.state.priceHistory.get(assetName) ?? [];
  }

  /**
   * Get current price for an asset
   */
  getPrice(assetName: string): number | undefined {
    return this.state.assets.get(assetName)?.price;
  }
}

/**
 * Create a toy pack with default configuration
 */
export function createToyPack(config?: ToyPackConfig): ToyPack {
  return new ToyPack(config);
}

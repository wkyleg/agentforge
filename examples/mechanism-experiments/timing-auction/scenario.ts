import { defineScenario } from '@elata-biosciences/agentforge';
import { FastActorAgent } from './agents/FastActorAgent.js';
import { NormalBidderAgent } from './agents/NormalBidderAgent.js';
import { AuctionPack } from './pack.js';

/**
 * Timing Auction Experiment
 *
 * This scenario demonstrates how timing advantages affect auction outcomes.
 *
 * Change the `mode` to compare:
 * - 'sealed-bid': Fast actor can see other bids (information advantage)
 * - 'commit-reveal': Bids are hidden until reveal (mitigates advantage)
 */
export default defineScenario({
  name: 'timing-auction',
  seed: 42,
  ticks: 100,
  tickSeconds: 12,

  pack: new AuctionPack({
    mode: 'sealed-bid', // Try: 'commit-reveal'
    auctionDuration: 5,
    baseItemValue: 100,
    revealPhaseTicks: 2,
    initialBalance: 10000,
  }),

  agents: [
    // Fast actor with timing advantage
    {
      type: FastActorAgent,
      count: 1,
      params: {
        minMargin: 2,
        maxBidFraction: 0.95,
      },
    },
    // Normal bidders
    {
      type: NormalBidderAgent,
      count: 8,
      params: {
        bidAggressiveness: 0.7,
        participationRate: 0.85,
      },
    },
    // Conservative bidders
    {
      type: NormalBidderAgent,
      count: 4,
      params: {
        bidAggressiveness: 0.5,
        participationRate: 0.6,
      },
    },
  ],

  metrics: {
    sampleEveryTicks: 1,
    track: [
      'totalAuctions',
      'sellerRevenue',
      'winsByFastActor',
      'winsByNormalBidders',
      'fastActorWinRate',
      'fastActorProfit',
      'normalBidderProfit',
      'avgBidsPerAuction',
    ],
  },

  assertions: [
    // Ensure auctions are running
    { type: 'gt', metric: 'totalAuctions', value: 10 },
    // Ensure bids are being placed
    { type: 'gt', metric: 'avgBidsPerAuction', value: 2 },
  ],
});

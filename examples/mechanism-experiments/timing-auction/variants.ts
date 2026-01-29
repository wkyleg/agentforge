import { AuctionPack } from './pack.js';

/**
 * Variants for comparing auction mechanisms
 *
 * Use with: forge-sim matrix scenario.ts --variants variants.ts
 */
export const variants = [
  {
    name: 'baseline',
    description: 'Sealed-bid auction where fast actor can observe other bids',
    overrides: {
      pack: new AuctionPack({
        mode: 'sealed-bid',
        auctionDuration: 5,
        baseItemValue: 100,
        initialBalance: 10000,
      }),
    },
  },
  {
    name: 'mitigated',
    description: 'Commit-reveal auction that neutralizes timing advantage',
    overrides: {
      pack: new AuctionPack({
        mode: 'commit-reveal',
        auctionDuration: 5,
        baseItemValue: 100,
        revealPhaseTicks: 2,
        initialBalance: 10000,
      }),
    },
  },
  {
    name: 'aggressive-bidders',
    description: 'Sealed-bid with more aggressive normal bidders',
    overrides: {
      pack: new AuctionPack({
        mode: 'sealed-bid',
        auctionDuration: 5,
        baseItemValue: 100,
        initialBalance: 10000,
      }),
      // Note: agent params would need custom handling
    },
  },
];

export default variants;

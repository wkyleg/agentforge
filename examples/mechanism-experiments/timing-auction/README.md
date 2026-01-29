# Timing Auction Experiment

This experiment demonstrates how timing advantages affect auction outcomes and whether mitigation mechanisms help.

## The Model

A simple sealed-bid auction runs periodically. Bidders submit bids, and the highest bidder wins. The experiment introduces a "fast actor" who can observe late information before committing.

- **Normal bidders**: Submit bids based on their private valuations
- **Fast actor**: Can observe others' bids (or market conditions) before committing

## Auction Variants

### Baseline (Simple Sealed Bid)
1. All bidders submit bids in same tick
2. Highest bid wins
3. Winner pays their bid

### Mitigated (Commit-Reveal)
1. Bidders commit a hash of their bid
2. After commit phase, bidders reveal their bids
3. Highest valid reveal wins

The fast actor's advantage is neutralized in commit-reveal because they can't see others' commitments.

## What It Measures

- **Seller revenue**: Total revenue across auctions
- **Fast actor advantage**: Excess profit vs. normal bidders
- **Bidder participation**: Do bidders drop out when disadvantaged?
- **Win rate skew**: How often does the fast actor win?

## Running the Experiment

```bash
# Run baseline (fast actor has advantage)
npx forge-sim run scenario.ts --seed 42

# Run with variants
npx forge-sim matrix scenario.ts --variants variants.ts

# Generate comparative report
npx forge-sim compare baseline/timing-auction-ci mitigated/timing-auction-ci
```

## Configuring Variants

Edit `variants.ts` to compare baseline vs mitigated:

```typescript
export const variants = [
  { name: 'baseline', overrides: { pack: new AuctionPack({ mode: 'sealed-bid' }) } },
  { name: 'mitigated', overrides: { pack: new AuctionPack({ mode: 'commit-reveal' }) } },
];
```

## Expected Observations

### Baseline Results
- Fast actor wins disproportionately often
- Fast actor bids just above the highest normal bid
- Normal bidders may reduce participation over time
- Seller revenue is sub-optimal due to strategic bidding

### Mitigated Results
- Win rates are more proportional to valuations
- Fast actor cannot exploit information timing
- Bidder participation remains stable
- Seller revenue improves due to honest bidding

## Sample Output

```
## Baseline vs Mitigated Comparison

| Metric | Baseline | Mitigated | Delta |
|--------|----------|-----------|-------|
| sellerRevenue | 8,400 | 9,200 | +9.5% |
| fastActorWinRate | 0.62 | 0.18 | -71% |
| avgBidderParticipation | 0.72 | 0.89 | +24% |
| fastActorProfit | 3,200 | 1,100 | -66% |
```

## Extending the Experiment

1. **Add more auction types**: Dutch auction, English auction
2. **Multiple fast actors**: Competition among informed players
3. **Varying information quality**: Partial vs. full information
4. **Reputation effects**: Track bidder history over time

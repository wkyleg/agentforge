# Sample Report: timing-auction

This is an example of the output you'll get after running the timing-auction experiment.

## Run Metadata

| Property | Value |
|----------|-------|
| Run ID | `timing-auction-2024-01-15T10-30-00` |
| Scenario | timing-auction |
| Seed | 42 |
| Ticks | 100 |
| Tick Duration | 12s |
| Total Agents | 13 |
| Duration | 412ms |
| Status | PASSED |

### Agent Configuration

| Type | Count |
|------|-------|
| FastActorAgent | 1 |
| NormalBidderAgent | 12 |

## KPI Summary (Baseline: sealed-bid)

| Metric | Value |
|--------|-------|
| totalAuctions | 20 |
| sellerRevenue | 1,680 |
| winsByFastActor | 14 |
| winsByNormalBidders | 6 |
| fastActorWinRate | 0.70 |
| fastActorProfit | 420 |
| normalBidderProfit | 180 |
| avgBidsPerAuction | 8.5 |

## Comparison: Baseline vs Mitigated

After running both variants:

| Metric | Baseline | Mitigated | Delta |
|--------|----------|-----------|-------|
| sellerRevenue | 1,680 | 1,820 | +8.3% |
| fastActorWinRate | 0.70 | 0.15 | -78% |
| fastActorProfit | 420 | 95 | -77% |
| normalBidderProfit | 180 | 385 | +114% |
| avgBidsPerAuction | 8.5 | 9.2 | +8% |

## Key Observations

### Baseline (Sealed-Bid) Results

- Fast actor wins 70% of auctions despite being 1 of 13 bidders
- Fast actor strategy: observe highest bid, bid slightly above
- Normal bidders experience "winner's curse" frustration
- Seller revenue is suppressed by strategic bidding

### Mitigated (Commit-Reveal) Results

- Fast actor win rate drops to statistical expectation (~15%)
- Normal bidders win proportionally to their valuations
- Higher bidder participation (no discouragement)
- Seller revenue increases due to more competitive bidding

## Agent Statistics

| Agent | Type | Attempted | Succeeded | Failed | Success Rate |
|-------|------|-----------|-----------|--------|--------------|
| FastActorAgent-0 | FastActorAgent | 20 | 14 | 6 | 70.0% |
| NormalBidderAgent-0 | NormalBidderAgent | 17 | 2 | 15 | 11.8% |
| NormalBidderAgent-1 | NormalBidderAgent | 18 | 1 | 17 | 5.6% |
| ... | ... | ... | ... | ... | ... |

## Mechanism Design Insights

1. **Information asymmetry drives inequality**: The fast actor's 70% win rate with ~8% of bidders shows severe market distortion.

2. **Commit-reveal restores fairness**: Win rates become proportional to valuations, not timing advantages.

3. **Participation matters**: Higher average bids per auction in mitigated mode suggests bidders stay engaged.

4. **Seller benefits from fairness**: Revenue increases 8% in mitigated mode due to competitive bidding.

## Next Steps

1. Run variants: `forge-sim matrix scenario.ts --variants variants.ts`
2. Analyze tail outcomes: `forge-sim sweep scenario.ts --seeds 1..50`
3. Try different bidder mixes
4. Experiment with reveal phase duration

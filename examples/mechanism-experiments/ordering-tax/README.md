# Ordering Tax Experiment

This experiment demonstrates how transaction ordering policies affect value capture and leakage in a simple opportunity market.

## The Model

A toy "opportunity" appears each tick with some value. Multiple agents compete to capture it:

- **Searcher agents**: Professional actors who optimize for capturing opportunities
- **User agents**: Regular users making normal transactions

The ordering policy determines who gets to act first:

1. **Priority ordering**: Higher priority fee = earlier execution
2. **Random ordering**: Shuffled each tick (seeded, deterministic)
3. **Round-robin ordering**: Rotating first position

## What It Measures

- **Captured value**: How much value the mechanism captures (fees, taxes)
- **Searcher profit**: How much value searchers extract
- **User slippage**: Execution quality degradation for users
- **Fairness**: Distribution of outcomes across agents

## Running the Experiment

```bash
# Run with default settings (priority ordering)
npx forge-sim run scenario.ts --seed 42

# Generate report
npx forge-sim report sim/results/ordering-tax-*

# Run sweep for statistical analysis
npx forge-sim sweep scenario.ts --seeds 1..50
```

## Configuring Ordering Policy

Edit `scenario.ts` to change the ordering policy:

```typescript
// In pack configuration
orderingPolicy: 'priority',  // or 'random', 'round-robin'
```

## Expected Observations

### Priority Ordering
- Searchers with higher priority fees capture most opportunities
- User slippage is high as searchers front-run
- Mechanism captures high fees from priority bidding

### Random Ordering
- Opportunity capture is distributed more evenly
- User slippage is lower on average
- Mechanism captures less in fees

### Round-Robin Ordering
- Most fair distribution
- Predictable, may enable gaming over time

## Sample Output

After running, check `report.md` for:

```
## KPI Summary

| Metric | Value |
|--------|-------|
| totalOpportunities | 100 |
| capturedBySearchers | 72 |
| capturedByUsers | 28 |
| totalSearcherProfit | 5400 |
| averageUserSlippage | 0.034 |
| mechanismRevenue | 1200 |
```

## Extending the Experiment

1. **Add new ordering policies**: Implement custom ordering in the pack
2. **Vary searcher aggression**: Adjust searcher parameters
3. **Add more user types**: Different trading patterns
4. **Introduce latency**: Model information delay

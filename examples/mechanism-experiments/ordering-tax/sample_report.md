# Sample Report: ordering-tax

This is an example of the output you'll get after running the ordering-tax experiment.

## Run Metadata

| Property | Value |
|----------|-------|
| Run ID | `ordering-tax-2024-01-15T10-30-00` |
| Scenario | ordering-tax |
| Seed | 42 |
| Ticks | 100 |
| Tick Duration | 12s |
| Total Agents | 15 |
| Duration | 523ms |
| Status | PASSED |

### Agent Configuration

| Type | Count |
|------|-------|
| SearcherAgent | 5 |
| UserAgent | 10 |

## KPI Summary

| Metric | Value |
|--------|-------|
| totalOpportunities | 100 |
| capturedBySearchers | 71 |
| capturedByUsers | 24 |
| totalSearcherProfit | 5,680 |
| totalUserProfit | 1,920 |
| mechanismRevenue | 1,250 |
| averageSlippage | 0.0312 |
| captureRate | 0.95 |
| searcherDominance | 0.747 |

## Observations

### Priority Ordering Results

With `orderingPolicy: 'priority'`:
- Searchers capture ~75% of opportunities
- Users capture ~25% despite outnumbering searchers 2:1
- Aggressive searchers (aggression=0.8) dominate
- Mechanism revenue is high from priority fees

### Comparison Points

Run with different ordering policies to compare:

| Ordering | Searcher % | User % | Mechanism Revenue |
|----------|-----------|--------|-------------------|
| priority | 75% | 25% | 1,250 |
| random | 55% | 45% | 850 |
| round-robin | 45% | 55% | 700 |

## Agent Statistics

| Agent | Type | Attempted | Succeeded | Failed | Success Rate |
|-------|------|-----------|-----------|--------|--------------|
| SearcherAgent-0 | SearcherAgent | 100 | 32 | 68 | 32.0% |
| SearcherAgent-1 | SearcherAgent | 100 | 24 | 76 | 24.0% |
| SearcherAgent-2 | SearcherAgent | 100 | 15 | 85 | 15.0% |
| SearcherAgent-3 | SearcherAgent | 78 | 0 | 78 | 0.0% |
| SearcherAgent-4 | SearcherAgent | 65 | 0 | 65 | 0.0% |
| UserAgent-0 | UserAgent | 52 | 4 | 48 | 7.7% |
| ... | ... | ... | ... | ... | ... |

## Key Insights

1. **Priority ordering favors well-capitalized searchers** who can afford higher priority fees
2. **User participation drops** when searchers dominate, reducing overall market activity
3. **Mechanism revenue correlates with competition** - more searchers = higher priority fees
4. **Tail outcomes matter** - some runs show users capturing 0% of opportunities

## Next Steps

1. Run a seed sweep to understand variance: `forge-sim sweep scenario.ts --seeds 1..50`
2. Compare ordering policies by editing `scenario.ts`
3. Adjust searcher aggression to model different competition levels

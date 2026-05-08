# Evaluation Framework

## Dataset

### Realistic Prompts (10)

| # | Prompt | Category | Difficulty |
|---|--------|----------|------------|
| r1 | "Build a project management tool with tasks, teams, and deadlines" | Productivity | Medium |
| r2 | "E-commerce store with products, categories, cart, and orders" | E-commerce | Hard |
| r3 | "Blog platform with posts, comments, and author profiles" | Content | Easy |
| r4 | "Inventory management system for a warehouse" | Business | Medium |
| r5 | "Student grade tracking system for a school" | Education | Medium |
| r6 | "Restaurant reservation and menu management system" | Hospitality | Medium |
| r7 | "Bug tracker with issues, sprints, and team assignments" | Dev Tools | Medium |
| r8 | "Personal finance tracker with accounts, transactions, and budgets" | Finance | Medium |
| r9 | "Recipe sharing platform with ingredients, steps, and ratings" | Social | Easy |
| r10 | "HR management system with employees, departments, leave tracking, and payroll" | Business | Hard |

### Edge Case Prompts (10)

Defined in `edge_cases.md` (e1-e10). Categories: vague (e1, e3), conflicting (e2, e5, e6), incomplete (e7), overspecified (e4, e8), adversarial (e9, e10).

## Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `success` | boolean | Pipeline completed without fatal errors |
| `latency_ms` | number | Total pipeline duration |
| `tokens_input` | number | Total input tokens across all OpenAI calls |
| `tokens_output` | number | Total output tokens across all OpenAI calls |
| `cost_usd` | number | Estimated cost based on token usage |
| `validation_errors` | number | Errors detected before repair |
| `repair_attempts` | number | Number of repair cycles executed (0-3) |
| `repair_success` | boolean | All validation errors resolved after repairs |
| `runtime_score` | number | 0-100 executability score from RuntimeValidator |
| `simulation_pass_rate` | number | Percentage of simulation scenarios that passed |

## Aggregations

### By Category

Group results by prompt category and compute:
- Mean/median latency
- Success rate (% of prompts that produced a valid config)
- Mean runtime score
- Mean repair attempts

### By Difficulty

| Difficulty | Expected Success Rate | Expected Avg Score |
|------------|----------------------|-------------------|
| Easy | >95% | >85 |
| Medium | >80% | >75 |
| Hard | >60% | >65 |
| Edge Case | >50% | >50 |

## API Endpoint

```
POST /api/eval
Content-Type: application/json

{
  "filter": "all" | "realistic" | "edge_cases",
  "prompts": ["r1", "r3", "e5"]  // optional: run specific prompts
}
```

### Response

```json
{
  "run_id": "eval_abc123",
  "started_at": "2025-01-15T10:00:00Z",
  "completed_at": "2025-01-15T10:08:30Z",
  "total_prompts": 20,
  "results": [
    {
      "prompt_id": "r1",
      "prompt": "Build a project management tool...",
      "success": true,
      "latency_ms": 18200,
      "tokens_input": 1250,
      "tokens_output": 2100,
      "cost_usd": 0.0015,
      "validation_errors": 2,
      "repair_attempts": 1,
      "repair_success": true,
      "runtime_score": 87,
      "simulation_pass_rate": 0.95
    }
  ],
  "summary": {
    "success_rate": 0.85,
    "avg_latency_ms": 22000,
    "avg_runtime_score": 78,
    "avg_cost_usd": 0.0022,
    "total_cost_usd": 0.044,
    "by_category": { ... },
    "by_difficulty": { ... }
  }
}
```

## Benchmarks

| Metric | Target |
|--------|--------|
| Realistic success rate | >80% |
| Edge case success rate | >50% |
| Avg runtime score (realistic) | >75 |
| Avg runtime score (edge cases) | >50 |
| Avg latency per generation | <30s |
| Max latency per generation | <60s |
| Avg cost per generation | ~$0.002 |
| Full eval suite cost | <$0.10 |

## Cost Analysis

**Per generation (gpt-4o-mini):**
- Base (no repairs): ~$0.001
- With 1 repair cycle: ~$0.003
- With 3 repair cycles: ~$0.005

**Per eval run (20 prompts):**
- Best case: 20 x $0.001 = $0.02
- Typical: 20 x $0.003 = $0.06
- Worst case: 20 x $0.005 = $0.10

Running eval 10 times during development: ~$0.60 total.

## Latency Targets

| Stage | Target | Max |
|-------|--------|-----|
| Analysis | 2-4s | 8s |
| Generation | 5-10s | 20s |
| Validation | <100ms | 500ms |
| Repair (per cycle) | 3-8s | 15s |
| Runtime | <200ms | 1s |
| **Total (no repair)** | **8-15s** | **30s** |
| **Total (with repairs)** | **15-30s** | **60s** |

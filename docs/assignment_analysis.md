# Assignment Analysis

## Core Requirements

1. **Natural Language to Application Config** -- Accept a free-form text prompt describing an application and produce a fully validated, executable application configuration (UI, API, DB, Auth, Business Rules).

2. **Structured LLM Pipeline** -- Demonstrate controlled, multi-stage LLM usage rather than a single monolithic prompt. Each stage produces a typed intermediate representation validated by Zod schemas.

3. **Cross-Layer Validation** -- Prove that UI references resolve to API endpoints, API endpoints map to DB tables, auth roles are consistent across all layers, and business rules reference valid entities.

4. **Self-Healing Repair** -- When the LLM produces invalid output, the system must detect and fix issues automatically -- deterministic fixes first, LLM refinement second -- with bounded retries.

5. **Runtime Executability** -- The final config must pass runtime simulation: every route resolves, every page renders, every DB operation succeeds, every auth flow completes.

6. **Observability** -- Pipeline metrics (latency per stage, token usage, cost, validation error counts, repair success rate) must be tracked and surfaced.

---

## Evaluator Expectations

| Dimension | What they look for |
|---|---|
| **System Thinking** | Multi-stage pipeline with clear IR boundaries, not a prompt-and-pray approach. Typed contracts between stages. |
| **Reliability** | Zod validation at every stage boundary. Deterministic repair before LLM fallback. Bounded retry with budget tracking. |
| **LLM Control** | Low temperature (0.1), JSON response format enforcement, structured system prompts with exact schema definitions, no open-ended generation. |
| **Execution Awareness** | Runtime validator + simulator that prove the config would actually work -- not just schema-valid but operationally correct. |
| **Depth** | 7 specialized validators, two-phase repair, simulation of routes/pages/DB ops/auth flows. Not surface-level CRUD generation. |

---

## Ranking Criteria: What Separates Top 1%

### Baseline (most submissions)
- Single prompt to LLM, dump JSON, maybe validate with Zod.
- No cross-layer checks. No repair. No runtime awareness.

### Good (top 10%)
- Multi-stage pipeline with typed IRs.
- Basic validation (schema-level).
- Some error handling.

### Top 1% (our target)
- **Modular Pipeline**: 6 discrete stages with independent Zod schemas, clear input/output contracts, composable and testable in isolation.
- **Intelligent Repair**: Two-phase strategy -- deterministic fixes (missing PKs, auth fields, default roles, enum values) run instantly and reliably; LLM refinement handles complex cross-layer issues with full context injection.
- **Strong Consistency**: 7 validators checking UI-API, API-DB, DB schema, auth, UI completeness, API completeness, and business rule integrity. Cross-layer validation is the differentiator.
- **Metrics & Observability**: Per-stage latency, token usage, cost estimation, validation error/warning counts, repair attempt tracking -- all surfaced in the response.
- **Runtime Simulation**: Not just "is the JSON valid?" but "would this config actually run?" -- route resolution, page renderability, DB operation feasibility, auth flow simulation.
- **Eval Framework**: Dataset-driven evaluation with batch runner, enabling systematic quality measurement across prompt categories.

---

## Key Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| LLM outputs malformed JSON | Pipeline halts at stage boundary | `safeParseJSON` strips markdown fences; `response_format: "json_object"` enforced; Zod parse with descriptive error messages |
| LLM hallucinates entity names across stages | Cross-layer inconsistency (UI references nonexistent API entity) | 7 validators catch every cross-reference; repair engine fixes or regenerates broken references |
| Repair loop diverges | Infinite retries, cost blowout | Hard cap at 3 attempts; deterministic fixes applied first to reduce LLM repair scope; token budget tracked per cycle |
| Single-entity prompts produce trivial configs | Low quality output for simple inputs | Intent extraction infers implied features (e.g., "CRM" implies contacts, deals, pipeline); assumptions and ambiguities are explicitly documented |
| Schema drift between stages | Stage N+1 receives unexpected shape | Every stage boundary enforces Zod parsing; schemas are imported from a single source of truth (`src/schemas/`) |
| High latency from sequential LLM calls | Poor UX on generation | Streaming API endpoint (`/api/generate/stream`) with stage-by-stage updates; `gpt-4o-mini` as default model for speed/cost balance |
| Enum columns generated without values | DB schema invalid at runtime | Deterministic repair detects and patches with defaults; validator flags as error before repair |

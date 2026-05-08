# SpecForge Audit Report

## 1. Architecture Audit

### Strengths

**Modular Pipeline Architecture**
The 6-stage pipeline (intent -> design -> schema -> validation -> repair -> runtime) enforces separation of concerns. Each stage has a single responsibility, its own prompt template, and its own Zod schema. Stages communicate via typed interfaces (`PipelineState`), making the system testable and extensible without cross-stage coupling.

**Strict Zod Schemas at Every Boundary**
Every LLM response is parsed through Zod before entering the next stage. This eliminates an entire class of bugs where malformed JSON silently propagates. The schemas (`IntentSchema`, `DesignSchema`, `AppConfigSchema`) serve as both validation and documentation of the contract between stages.

**Deterministic + LLM Repair (Two-Tier)**
The repair engine (`src/repair/engine.ts`) applies deterministic fixes first (missing PKs, missing auth fields, enum defaults) before falling back to LLM refinement. This is cheaper, faster, and more predictable than sending everything back to the model. Deterministic fixes are free and instant; LLM refinement is budgeted to 3 attempts max.

**Cross-Layer Validation**
The validation engine runs 7 validators covering UI-API consistency, API-DB consistency, DB schema integrity, auth consistency, UI completeness, API completeness, and business rule validation. This catches structural issues that single-layer checks would miss (e.g., a UI page referencing an entity with no corresponding API endpoints).

**Runtime Simulation**
The simulator (`src/runtime/simulator.ts`) walks every route, page, DB operation, and auth flow to verify the config would succeed at execution time. The runtime validator (`src/runtime/validator.ts`) scores configs 0-100 across 10 checks. This goes beyond schema validation into behavioral correctness.

**Comprehensive Evaluation Framework**
20 prompts (10 realistic + 10 edge cases) with per-prompt metrics: latency, tokens, cost, validation errors, repair attempts, runtime score, simulation success. Results are aggregated by category and difficulty.

### Weaknesses and Mitigations

| Weakness | Impact | Mitigation |
|----------|--------|------------|
| **Single LLM provider dependency** | OpenAI outage = full pipeline failure | Abstract `callLLM` behind a provider interface. Add Anthropic/Gemini as fallback providers with automatic failover. The existing `callLLM` function in `src/pipeline/llm.ts` already isolates the OpenAI SDK to a single file, making this a low-effort change. |
| **No caching layer** | Identical prompts re-run the full pipeline, wasting tokens and latency | Add a content-addressable cache keyed on `hash(prompt + model + temperature)`. Store completed `PipelineState` in Prisma. Check cache before Stage 1. Cache hit = skip to runtime validation. Invalidate on schema version changes. |
| **In-memory repair (not persisted mid-cycle)** | If the process crashes during repair, all progress is lost. No audit trail of intermediate states. | Persist each repair iteration to a `pipeline_runs` table with JSONB columns for intermediate configs. This also enables debugging failed repairs post-hoc. |
| **Simulation doesn't cover all runtime edge cases** | Concurrent writes, pagination, file uploads, webhook callbacks, and rate limiting are not simulated | Add targeted simulators for: (1) concurrent mutation conflicts, (2) pagination boundary conditions, (3) file upload endpoint validation. Prioritize based on frequency in generated configs. |

---

## 2. Security Audit

### Input Sanitization
- **Prompt input**: Validated server-side in `route.ts` -- rejects empty/non-string inputs with 400.
- **JSON parsing**: `safeParseJSON` strips markdown code blocks before parsing. Invalid JSON returns a typed error, never throws uncaught.
- **Zod parsing**: All LLM outputs pass through `.safeParse()`. Malformed responses are caught and surfaced as pipeline errors, not crashes.
- **No code execution from user input**: The pipeline generates JSON configuration, never executable code. No `eval()`, no `Function()`, no shell execution. The simulator is read-only traversal of config objects.

### API Key Protection
- `OPENAI_API_KEY` is loaded from `process.env` only in `src/pipeline/llm.ts`. Never logged, never included in responses, never exposed to the client.
- The SSE stream sends only stage names and final results -- no internal state, no API keys, no system prompts.

### Prompt Injection
- System prompts are hardcoded per stage, not user-controllable.
- User input is passed as the `user` message, not interpolated into system prompts.
- LLM output is always parsed through Zod schemas, so even if the model returns unexpected content, it gets rejected at the schema boundary.

### Remaining Risks
- No rate limiting on the `/api/generate` endpoint. Mitigation: add middleware with IP-based rate limiting (e.g., Vercel's built-in or `next-rate-limit`).
- No authentication on the API routes. Acceptable for a demo/evaluation tool, but would need auth headers for production.

---

## 3. Performance Audit

### Pipeline Latency Breakdown (Typical)

| Stage | Typical Latency | Notes |
|-------|----------------|-------|
| Intent Extraction | 1-2s | Single LLM call, small output (~200 tokens) |
| System Design | 2-4s | Single LLM call, medium output (~500 tokens) |
| Schema Generation | 3-6s | Single LLM call, large output (~2000 tokens) |
| Validation | <10ms | Pure computation, 7 validators, no I/O |
| Repair (if triggered) | 2-8s per attempt | 0-3 LLM calls + deterministic fixes |
| Runtime Validation | <5ms | Pure computation, 10 checks |
| **Total (no repair)** | **6-12s** | 3 LLM calls |
| **Total (with repair)** | **8-20s** | 4-6 LLM calls |

### Token Efficiency
- Model: `gpt-4o-mini` at temperature `0.1` -- lowest cost tier with deterministic-leaning output.
- `max_tokens: 4096` per call. Typical usage: 500-2500 tokens per response.
- Estimated cost per generation: $0.001-0.003 (no repair) to $0.005-0.010 (with repair).
- `responseFormat: "json_object"` forces structured output, reducing wasted tokens on markdown/explanation.

### Bottlenecks
- Schema generation is the slowest stage (largest output). Could be parallelized by generating UI, API, DB, and Auth schemas concurrently, then merging.
- SSE streaming adds no overhead -- stages are streamed as they complete, not buffered.

---

## 4. Reliability Audit

### Retry Budget
- **Repair engine**: Max 3 attempts (`MAX_REPAIR_ATTEMPTS = 3`). Each attempt runs deterministic fixes first (free), then LLM refinement (1 call).
- **Total worst-case LLM calls**: 6 (3 pipeline + 3 repair).
- **No infinite loops**: The repair loop is bounded by `MAX_REPAIR_ATTEMPTS` and terminates early if all blocking errors are resolved.

### Graceful Degradation
- **LLM failure**: Caught in the orchestrator's try/catch. State is set to `failed` with error message. Metrics are still computed and returned. Client receives a typed error event via SSE.
- **Repair failure**: If repair exhausts its budget, the pipeline returns `status: "failed"` with the partially-repaired config and remaining issues. The client can still inspect the output.
- **Zod parse failure**: Returns a typed error with the parse issues. Does not crash the pipeline.
- **Validator crash**: Each validator runs in its own try/catch inside the validation engine. A crashing validator produces an error issue but doesn't block other validators.

### Error Boundaries
- **API route level**: The SSE stream handler wraps the entire pipeline in try/catch and sends an error event before closing the stream.
- **Stage level**: Each stage in the orchestrator is sequential with shared error handling.
- **Validator level**: Individual validator failures are caught and reported as validation issues.
- **Repair level**: Each repair attempt is independently try/caught. A failing LLM call during repair logs the failure as a non-applied action and continues to the next attempt.

### Missing Reliability Features
- No circuit breaker for repeated LLM failures (mitigate with exponential backoff + circuit breaker pattern on `callLLM`).
- No request timeout per LLM call (mitigate with `AbortController` signal passed to the OpenAI SDK).
- No dead-letter queue for failed generations (mitigate with Prisma persistence of failed runs for later retry).

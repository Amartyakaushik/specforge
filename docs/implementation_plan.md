# Implementation Plan

## Day 1: Foundation

### Schemas & Types
- [ ] Define Zod schemas: `AppConfig`, `Entity`, `Page`, `Navigation`, `Auth`, `Database`, `Widget`
- [ ] Generate TypeScript types from Zod schemas
- [ ] Define pipeline stage types: `PipelineStage`, `StageResult`, `PipelineContext`
- [ ] Define error types and validation result types

### Pipeline Stages
- [ ] `AnalysisStage` — extracts intent, entities, features from prompt
- [ ] `GenerationStage` — produces raw `AppConfig` via OpenAI
- [ ] `ValidationStage` — runs validators, collects errors
- [ ] `RepairStage` — fixes validation failures
- [ ] `RuntimeStage` — structural + simulation checks

### Orchestrator
- [ ] `PipelineOrchestrator` class with `execute(prompt: string): Promise<PipelineResult>`
- [ ] Stage sequencing with error propagation
- [ ] SSE event emission at each stage transition
- [ ] Retry logic: max 3 validation-repair cycles, max 2 runtime-repair cycles
- [ ] Timeout handling: 60s per stage, 120s total

**Dependencies:** None — this is the foundation layer.

---

## Day 2: Validation & Repair

### Validation Engine (7 Validators)
- [ ] `SchemaValidator` — Zod parse against `AppConfig`
- [ ] `EntityValidator` — field types, required fields, relationships
- [ ] `PageValidator` — route uniqueness, component references
- [ ] `NavigationValidator` — nav items reference existing pages
- [ ] `AuthValidator` — role consistency, protected route coverage
- [ ] `DatabaseValidator` — table-entity alignment, FK integrity
- [ ] `CrossReferenceValidator` — inter-entity references, widget data sources

### Repair Engine
- [ ] `DeterministicRepair` — rule-based fixes for common issues:
  - Missing `id` fields → inject UUID primary key
  - Duplicate routes → append suffix
  - Missing CRUD pages → generate from entity definition
  - Type mismatches → coerce to nearest valid type
- [ ] `LLMRepair` — sends failed validations + current config to GPT-4o-mini for targeted fixes
- [ ] Repair prioritization: deterministic first, LLM for remaining
- [ ] Diff tracking: record what each repair changed

**Dependencies:** Day 1 schemas and types.

---

## Day 3: Runtime & API

### Runtime Validator
- [ ] Implement 10 structural checks (see `runtime_design.md`)
- [ ] Scoring engine: weighted check results → 0-100 score
- [ ] Feedback formatter: convert failures to repair instructions

### Runtime Simulator
- [ ] Route resolution simulator
- [ ] Page render tree walker
- [ ] DB operation tracer
- [ ] Auth flow simulator
- [ ] Aggregate simulation results

### API Routes
- [ ] `POST /api/generate` — full pipeline execution, returns final result
- [ ] `POST /api/generate/stream` — SSE stream of pipeline progress + final result
- [ ] `POST /api/eval` — runs evaluation dataset, returns metrics

### API Implementation Details
- Request validation with Zod
- Structured error responses
- Rate limiting (10 req/min for generate, 1 req/min for eval)
- Request/response logging

**Dependencies:** Day 1 orchestrator, Day 2 validation/repair.

---

## Day 4: Frontend

### Components
- [ ] `PromptInput` — textarea with submit, character count, example prompts
- [ ] `PipelineStatus` — real-time stage progress via SSE (analysis → generation → validation → repair → runtime)
- [ ] `OutputViewer` — tabbed view:
  - Config tab: syntax-highlighted JSON with collapsible sections
  - Entities tab: entity relationship diagram (text-based)
  - Pages tab: route tree with page details
  - Validation tab: check results with pass/fail indicators
- [ ] `MetricsPanel` — latency, tokens used, cost, validation score, runtime score

### SSE Streaming
- [ ] `useEventSource` hook for SSE consumption
- [ ] Event types: `stage_start`, `stage_complete`, `stage_error`, `pipeline_complete`
- [ ] Reconnection handling
- [ ] Progress state management with `useReducer`

### Layout
- [ ] Single-page layout: prompt top, status middle, output bottom
- [ ] Responsive: stack on mobile, side-by-side on desktop
- [ ] Dark mode support via Tailwind

**Dependencies:** Day 3 API routes (for integration).

---

## Day 5: Evaluation & Polish

### Evaluation Framework
- [ ] 20 test prompts (10 realistic, 10 edge cases)
- [ ] Automated runner: executes all prompts, collects metrics
- [ ] Metric aggregation: by category, by difficulty
- [ ] Results persistence to database
- [ ] Summary report generation

### Testing
- [ ] Unit tests: validators, repair engine, runtime checks
- [ ] Integration tests: full pipeline with fixture prompts
- [ ] API tests: endpoint contracts, error handling, streaming

### Deployment
- [ ] Vercel deployment configuration
- [ ] Supabase database setup with Prisma
- [ ] Environment variable configuration
- [ ] Production build verification

### Documentation
- [ ] API documentation
- [ ] Architecture overview
- [ ] Setup instructions

**Dependencies:** All previous days.

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM output doesn't match schema | Pipeline fails at validation | Repair loop with max 3 retries; deterministic fixes for common issues |
| Generation exceeds timeout | User sees error | 120s Vercel limit; stream partial results; cache analysis stage |
| Rate limiting by OpenAI | Eval suite fails mid-run | Sequential execution with 500ms delay; retry with exponential backoff |
| Complex prompts produce oversized configs | Memory/token limits | Cap entities at 20, pages at 30; truncate and warn |
| Repair loop doesn't converge | Infinite retries | Hard cap at 3 validation + 2 runtime cycles; return best attempt with score |

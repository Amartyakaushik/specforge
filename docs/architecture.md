# System Architecture

## Overview

SpecForge is an AI-powered application compiler that converts natural language prompts into validated, executable application configurations. It operates as a multi-stage pipeline where each stage produces a typed intermediate representation (IR), validated by Zod schemas, before passing to the next stage.

The system is a Next.js 15 application with a React frontend, API routes for pipeline execution, PostgreSQL for persistence, and OpenAI as the LLM backend.

---

## Component Diagram

```
+------------------------------------------------------------------+
|                        Next.js Frontend                          |
|  [Prompt Input] → [Stage Progress] → [Config Viewer] → [Export] |
+------------------------------------------------------------------+
          |                                          ^
          | POST /api/generate                       | SSE /api/generate/stream
          v                                          |
+------------------------------------------------------------------+
|                       API Layer (Route Handlers)                 |
|  /api/generate         - sync pipeline execution                 |
|  /api/generate/stream  - streaming stage updates                 |
|  /api/eval             - batch evaluation runner                 |
+------------------------------------------------------------------+
          |
          v
+------------------------------------------------------------------+
|                      Pipeline Orchestrator                       |
|  Manages stage execution, metrics collection, error handling     |
+------------------------------------------------------------------+
          |
          v
+--------+--------+--------+-----------+---------+---------+
| Stage 1| Stage 2| Stage 3|  Stage 4  | Stage 5 | Stage 6 |
| Intent | Design | Schema | Validate  | Repair  | Runtime |
| Extract| Gen    | Gen    |           |         | Check   |
+--------+--------+--------+-----------+---------+---------+
    |        |        |          |           |         |
    v        v        v          |           |         |
+--------+--------+--------+    |           |         |
|  LLM   |  LLM   |  LLM   |   |           |         |
| Client | Client | Client |   |           |         |
+--------+--------+--------+   |           |         |
    \        |        /         |           |         |
     +-------+-------+         |           |         |
             |                  |           |         |
             v                  v           v         v
+------------------------------------------------------------------+
|                     Zod Schema Registry                          |
|  IntentSchema | DesignSchema | AppConfigSchema | PipelineState   |
+------------------------------------------------------------------+
          |
          v
+------------------------------------------------------------------+
|                    PostgreSQL (via Prisma)                        |
|  Generation (JSONB: intent, design, schema, validation, metrics) |
|  EvalRun (JSONB: results, summary)                               |
+------------------------------------------------------------------+
```

---

## Data Flow

```
NL Prompt
    |
    v
[Intent Extraction] ──→ IntentSchema (appName, appType, features, targetUsers, assumptions)
    |
    v
[System Design] ──→ DesignSchema (entities, roles, flows, authStrategy, authFields)
    |
    v
[Schema Generation] ──→ AppConfigSchema (ui, api, db, auth, businessRules)
    |
    v
[Validation] ──→ ValidationIssue[] (severity, layer, message, path, suggestion)
    |
    v
[Repair] ──→ Fixed AppConfig + RepairAction[] (deterministic fixes + LLM refinement)
    |
    v
[Runtime Validation] ──→ RuntimeValidationResult (score, checks) + SimulationResult (routes, pages, dbOps, authFlows)
```

Each arrow represents a Zod-validated boundary. No stage accepts unvalidated input from a prior stage.

---

## Technology Choices

| Technology | Role | Justification |
|---|---|---|
| **Next.js 15** | Full-stack framework | API routes + React frontend in one deployment. App Router for streaming support. |
| **TypeScript** | Type safety | End-to-end type inference from Zod schemas to API responses. Eliminates runtime type surprises. |
| **Zod** | Schema validation | Runtime validation + static type inference. Single source of truth for data contracts. `.safeParse()` returns structured errors instead of throwing. |
| **OpenAI API (gpt-4o-mini)** | LLM backend | Best cost/quality ratio for structured JSON generation. `response_format: "json_object"` eliminates markdown wrapper issues. |
| **PostgreSQL** | Persistence | JSONB columns for storing pipeline IRs without schema migration per config shape. Indexed on status and timestamp. |
| **Prisma** | ORM | Type-safe database access, migration management, JSONB support for flexible IR storage. |
| **Radix UI + Tailwind** | UI components | Accessible, unstyled primitives with utility-first styling. No component library lock-in. |

---

## Module Boundaries and Contracts

### `src/schemas/`
Single source of truth for all data shapes. No business logic. Every other module imports from here.

- `intent.ts` -- IntentSchema, FeatureSchema
- `design.ts` -- DesignSchema, EntitySchema, RoleSchema, FlowSchema, FieldDefSchema
- `app-config.ts` -- AppConfigSchema, UIConfigSchema, APIConfigSchema, DBConfigSchema, AuthConfigSchema
- `pipeline.ts` -- PipelineStateSchema, ValidationIssueSchema, RepairActionSchema, PipelineMetricsSchema

### `src/pipeline/`
LLM interaction and orchestration. Each stage module exports a single async function.

- `llm.ts` -- OpenAI client, `callLLM()`, `safeParseJSON()`, `estimateCost()`
- `intent.ts` -- `extractIntent(prompt) → { intent, llmResult }`
- `design.ts` -- `generateDesign(intent) → { design, llmResult }`
- `schema-gen.ts` -- `generateSchema(intent, design) → { appConfig, llmResult }`
- `refine.ts` -- `refineConfig(config, issues) → { appConfig, llmResult }`
- `orchestrator.ts` -- `runPipeline(prompt, onStageUpdate?) → PipelineResult`

### `src/validators/`
Pure functions. No LLM calls. No side effects. Deterministic.

- `engine.ts` -- 7 validators + `validateConfig()`, `hasBlockingErrors()`, `issueSummary()`

### `src/repair/`
Two-phase repair: deterministic then LLM.

- `engine.ts` -- `repairConfig(config, issues) → RepairResult`

### `src/runtime/`
Execution feasibility checks. No LLM calls.

- `validator.ts` -- `validateRuntimeExecutability(config) → RuntimeValidationResult`
- `simulator.ts` -- `simulateExecution(config) → SimulationResult`

### `src/eval/`
Batch evaluation framework.

- `datasets.ts` -- Test prompt definitions
- `runner.ts` -- Batch execution + scoring

---

## Key Architectural Decisions

### 1. JSONB Storage for Pipeline IRs
Each pipeline stage output is stored as a JSONB column in the `Generation` table. This avoids schema migrations when IR shapes evolve and allows querying into nested config structures.

### 2. Modular Pipeline over Monolithic Prompt
A single prompt asking an LLM to generate UI + API + DB + Auth + Business Rules produces inconsistent cross-references. Splitting into Intent → Design → Schema gives each stage a focused scope and enables targeted repair when one layer fails.

### 3. Deterministic Prompting
All system prompts include the exact JSON schema the LLM must produce. Temperature is set to 0.1. `response_format: "json_object"` is enforced. This minimizes output variance and makes validation failures actionable (schema mismatch, not random text).

### 4. Staged Generation with Intermediate Validation
Rather than generating everything and validating at the end, each stage boundary runs Zod validation. This catches errors early -- a malformed Intent is caught before Design generation wastes an LLM call.

### 5. Validation-Driven Repair
The repair engine does not blindly regenerate. It receives the specific `ValidationIssue[]` array with severity, layer, path, and suggestion. Deterministic fixes handle known patterns (missing PK, missing auth fields). Only unresolved errors trigger LLM refinement with the full issue list injected as context.

### 6. Runtime Simulation as Final Gate
Schema validity does not equal runtime executability. A config can be valid JSON but have routes pointing to nonexistent tables. The runtime validator and simulator check operational correctness: route resolution, page renderability, CRUD coverage, auth flow completeness.

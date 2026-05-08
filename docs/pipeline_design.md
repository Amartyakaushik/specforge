# Pipeline Design

## Why Multi-Stage Beats Single-Prompt

A single prompt asking an LLM to produce a complete application config (UI pages + API endpoints + DB tables + auth rules + business logic) fails in predictable ways:

1. **Cross-reference drift** -- The LLM generates a UI page referencing entity "Product" but names the DB table "items". No single-pass validation catches this because the LLM doesn't self-check referential integrity.

2. **Context window saturation** -- A complete app config can be 2000+ lines of JSON. Generating it in one pass pushes the model toward shortcuts: missing fields, truncated arrays, duplicated structures.

3. **Untargeted repair** -- When a single-pass config fails validation, the only option is to regenerate everything. Multi-stage allows repairing just the broken layer while preserving valid layers.

4. **No progressive refinement** -- Intent extraction can surface ambiguities and assumptions before the system commits to a design. This is lost in single-pass generation.

The SpecForge pipeline decomposes generation into 6 stages with typed intermediate representations at each boundary.

---

## Stage 1: Intent Extraction

**Input**: Raw natural language prompt (string)
**Output**: `IntentSchema` (appName, appType, features[], hasAuth, hasPayments, hasAnalytics, targetUsers[], assumptions[], ambiguities[])

**LLM Configuration**:
- Model: `gpt-4o-mini`
- Temperature: `0.1`
- Max tokens: `2048`
- Response format: `json_object`

**Validation Strategy**: Zod `safeParse` against `IntentSchema`. Checks:
- At least 1 feature extracted
- Valid `appType` enum value
- Feature categories from allowed set
- Feature priorities from `core | secondary | optional`

**Failure Handling**: If JSON parse fails or Zod validation fails, throw with descriptive error. No retry at this stage -- a bad prompt is a bad prompt.

**Determinism Strategy**: System prompt includes the exact JSON structure with field descriptions. Temperature 0.1 minimizes variance. The LLM is instructed to infer implied features (e.g., "CRM" implies contacts + deals + pipeline) to reduce ambiguity.

**Data Contract**:
```typescript
interface IntentResult {
  intent: Intent;      // Validated IntentSchema
  llmResult: LLMCallResult;  // tokens, latency
}
```

---

## Stage 2: System Design

**Input**: Validated `Intent`
**Output**: `DesignSchema` (entities[], roles[], flows[], authStrategy, authFields[])

**LLM Configuration**:
- Model: `gpt-4o-mini`
- Temperature: `0.1`
- Max tokens: `4096`
- Response format: `json_object`

**Validation Strategy**: Zod `safeParse` against `DesignSchema`. Checks:
- At least 1 entity with at least 1 field
- Entity names in PascalCase
- Relation fields reference existing entity names
- Roles have valid permission structures
- Flows have at least 1 step

**Failure Handling**: Throw on parse/validation failure. The orchestrator catches and sets pipeline status to `failed`.

**Repair Strategy**: N/A at this stage. Design is regenerated if invalid.

**Determinism Strategy**: The full Intent JSON is passed as context. System prompt specifies exact entity field types (`string | number | boolean | email | date | text | password | enum | relation | json`) and relation types (`one-to-one | one-to-many | many-to-many`).

**Data Contract**:
```typescript
interface DesignResult {
  design: Design;
  llmResult: LLMCallResult;
}
```

---

## Stage 3: Schema Generation

**Input**: Validated `Intent` + Validated `Design`
**Output**: `AppConfigSchema` (ui, api, db, auth, businessRules)

**LLM Configuration**:
- Model: `gpt-4o-mini`
- Temperature: `0.1`
- Max tokens: `4096`
- Response format: `json_object`

**Validation Strategy**: Zod `safeParse` against `AppConfigSchema`. This is the most complex schema with nested sub-schemas for UI (pages, columns, fields, widgets), API (endpoints, params), DB (tables, columns, indexes, references), Auth (roles, rules, fields), and Business Rules.

**Failure Handling**: Throw on parse/validation failure.

**Determinism Strategy**: Both Intent and Design are injected as full JSON context. The system prompt specifies every enum value, every field type, every structural constraint. The LLM's job is translation (Design IR → AppConfig), not creative generation.

**Data Contract**:
```typescript
interface SchemaResult {
  appConfig: AppConfig;
  llmResult: LLMCallResult;
}
```

---

## Stage 4: Validation

**Input**: `AppConfig`
**Output**: `ValidationIssue[]`

**No LLM call**. Pure deterministic validation.

Runs 7 validators in sequence (see `validation_engine.md`):
1. UI-API Consistency
2. API-DB Consistency
3. DB Schema Integrity
4. Auth Consistency
5. UI Completeness
6. API Completeness
7. Business Rules Validation

**Failure Handling**: Each validator is wrapped in try/catch. If a validator throws, the error is captured as a `ValidationIssue` with severity `error` and layer `cross-layer`.

**Data Contract**:
```typescript
function validateConfig(config: AppConfig): ValidationIssue[]
function hasBlockingErrors(issues: ValidationIssue[]): boolean
function issueSummary(issues: ValidationIssue[]): { errors: number; warnings: number; info: number }
```

---

## Stage 5: Repair

**Input**: `AppConfig` + `ValidationIssue[]`
**Output**: Fixed `AppConfig` + `RepairAction[]`

**Triggered only if** `hasBlockingErrors(issues)` returns `true`.

**Two-phase approach per attempt**:

Phase 1 -- Deterministic fixes (no LLM, instant):
- Missing primary key → prepend `id` column with `primaryKey: true`
- Missing auth email field → append email field to `auth.fields`
- Missing auth password field → append password field to `auth.fields`
- No default role → set `isDefault: true` on the `user` role (or last role)
- Enum column without values → set `enumValues: ["default"]`

Phase 2 -- LLM refinement (only if errors remain after Phase 1):
- Inject current config + remaining error issues into refinement prompt
- LLM returns complete fixed config
- Result validated with `AppConfigSchema.safeParse()`

**Max attempts**: 3. Each attempt runs Phase 1 then Phase 2 (if needed). Re-validates after each attempt.

**Failure Handling**: If all 3 attempts fail, pipeline status is set to `failed` with remaining error count in the error message.

**Data Contract**:
```typescript
interface RepairResult {
  config: AppConfig;
  actions: RepairAction[];
  attempts: number;
  success: boolean;
  remainingIssues: ValidationIssue[];
  totalTokens: number;
  totalLatencyMs: number;
}
```

---

## Stage 6: Runtime Validation

**Input**: `AppConfig`
**Output**: `RuntimeValidationResult` + `SimulationResult`

**No LLM call**. Pure deterministic checks.

**Runtime Validator** -- 10 checks scoring 0-100:
1. Navigation renderable (has pages with `showInNav`)
2. Table pages have columns
3. Form pages have fields
4. Dashboards have widgets
5. CRUD coverage (UI entities have list+create endpoints)
6. DB backing (all API entities have DB tables)
7. Auth completeness (roles, rules, fields present)
8. Unique page paths
9. Tables have 2+ columns (id + at least 1 field)
10. No orphan endpoints

**Simulator** -- Walks every execution path:
- API routes: resolves entity → DB table for every endpoint
- Pages: checks renderability based on type-specific requirements
- DB operations: verifies required columns exist for create operations
- Auth flows: simulates registration, login, role authorization

**Data Contract**:
```typescript
interface RuntimeValidationResult {
  executable: boolean;
  score: number;  // 0-100
  checks: RuntimeCheck[];
}

interface SimulationResult {
  success: boolean;
  routes: SimulatedRoute[];
  pages: SimulatedPage[];
  dbOperations: SimulatedDBOp[];
  authFlows: SimulatedAuthFlow[];
  errors: string[];
}
```

---

## Orchestrator Design

The orchestrator (`src/pipeline/orchestrator.ts`) is a linear state machine:

```
intent → design → schema → validation → [repair if errors] → complete
```

**Responsibilities**:
- Initializes `PipelineState` with unique ID
- Executes stages sequentially, capturing latency per stage
- Accumulates token usage and LLM call counts across stages
- Fires `StageCallback` on each stage transition (enables streaming)
- Catches exceptions and sets `status: "failed"` with error message
- Builds `PipelineMetrics` with cost estimation on completion

**State Management**:
```typescript
interface PipelineState {
  id: string;
  prompt: string;
  currentStage: PipelineStage;
  status: "running" | "completed" | "failed";
  intent: Intent | null;
  design: Design | null;
  appConfig: AppConfig | null;
  validationIssues: ValidationIssue[];
  repairActions: RepairAction[];
  metrics: PipelineMetrics | null;
  error: string | null;
}
```

The orchestrator does not retry individual stages. If a stage throws, the pipeline fails. Repair is the only stage with internal retries (max 3), and it is only invoked when validation surfaces blocking errors.

**Metrics collected**:
- `totalLatencyMs` -- wall clock time for entire pipeline
- `stageLatencies` -- per-stage breakdown
- `llmCalls` -- total OpenAI API calls
- `tokensUsed` -- total tokens across all calls
- `validationErrors` / `validationWarnings` -- final counts
- `repairAttempts` / `repairSuccesses` -- repair effectiveness
- `estimatedCostUsd` -- based on model and token count

# Runtime Design

## Overview

The runtime layer validates that generated application configurations are structurally sound and can produce working applications. It operates after the validation/repair loop and provides the final executability assessment.

## RuntimeValidator

Performs 10 structural checks against the generated `AppConfig`. Each check returns a pass/fail with severity (critical/warning) and a message.

| # | Check | Severity | Description |
|---|-------|----------|-------------|
| 1 | Navigation Integrity | Critical | Every nav item references an existing page/route |
| 2 | Column References | Critical | All table columns reference valid entity fields |
| 3 | Field Completeness | Critical | Form fields map to entity properties with correct types |
| 4 | Widget Data Binding | Warning | Dashboard widgets reference valid data sources |
| 5 | CRUD Coverage | Warning | Every entity has at minimum list + create operations |
| 6 | DB Backing | Critical | All entities have a corresponding database table definition |
| 7 | Auth Completeness | Critical | If auth is defined: login page, protected routes, and role definitions all exist |
| 8 | Unique Paths | Critical | No duplicate route paths across pages |
| 9 | Table-Field Alignment | Critical | DB table columns match entity field definitions in type and name |
| 10 | No Orphan Entities | Warning | No entities exist without at least one page referencing them |

### Scoring

Each check contributes to a 0-100 executability score:

```
score = 100 - (critical_failures * 15) - (warning_failures * 5)
score = Math.max(0, Math.min(100, score))
```

Threshold: configs scoring below 60 are rejected. Configs between 60-80 pass with warnings. Above 80 is production-ready.

### Implementation

```typescript
interface RuntimeCheckResult {
  check: string;
  passed: boolean;
  severity: 'critical' | 'warning';
  message: string;
  details?: Record<string, unknown>;
}

interface RuntimeValidationResult {
  score: number;
  passed: boolean;
  checks: RuntimeCheckResult[];
  failedCritical: number;
  failedWarnings: number;
}
```

## RuntimeSimulator

Simulates application execution without spinning up an actual server. Tests four categories:

### 1. Route Handling
- Resolves every defined route path
- Validates dynamic route parameters (e.g., `/users/:id`) have corresponding data loaders
- Checks redirect chains for cycles
- Verifies auth guards on protected routes

### 2. Page Rendering
- Walks the component tree for each page
- Validates all referenced components exist in the config
- Checks prop bindings resolve to valid data sources
- Ensures layout slots are filled

### 3. DB Operations
- Traces CRUD operations from UI actions to DB table definitions
- Validates query field references against table schemas
- Checks relationship traversals (foreign keys exist, join paths valid)
- Verifies cascade delete rules don't create orphans

### 4. Auth Flows
- Simulates login → session → protected route access
- Validates role-based access control paths
- Checks that permission matrices are complete (no undefined role-route combinations)
- Verifies logout clears session state

### Simulation Output

```typescript
interface SimulationResult {
  category: 'route' | 'render' | 'db' | 'auth';
  scenario: string;
  success: boolean;
  error?: string;
  trace: string[]; // execution path
}
```

## Why Simulation Over Actual Server Spinup

| Factor | Simulation | Server Spinup |
|--------|-----------|---------------|
| Speed | ~100ms | 5-30s minimum |
| Dependencies | None | Node, DB, file system |
| Cost | Zero | Compute + DB resources |
| Determinism | Fully deterministic | Environment-dependent |
| Parallelism | Trivially parallelizable | Resource-constrained |
| CI/CD | Runs anywhere | Requires Docker or equivalent |
| Failure isolation | Pinpoints exact structural issue | Opaque runtime errors |

Simulation catches ~95% of structural issues that would cause runtime failures. The remaining 5% (CSS rendering, browser-specific behavior, third-party API integration) are outside scope for config validation.

## Feedback Loop

Runtime results feed back into the pipeline:

```
Generate → Validate → Repair → Runtime Check
                ↑                      │
                └──────────────────────┘
                  (if score < threshold)
```

1. RuntimeValidator runs all 10 checks
2. If score < 60, failed checks are formatted as repair instructions
3. Repair engine receives the specific failures and patches the config
4. Re-validation runs (max 2 runtime repair cycles to prevent infinite loops)
5. Final score is recorded regardless of pass/fail

The runtime feedback is distinct from the validation repair loop. Validation catches schema/structural issues. Runtime catches semantic/logical issues that are syntactically valid but would fail at execution time.

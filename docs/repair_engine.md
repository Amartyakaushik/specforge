# Repair Engine

## Overview

The repair engine transforms an invalid `AppConfig` into a valid one by applying targeted fixes driven by `ValidationIssue[]`. It uses a two-phase strategy: deterministic fixes first, LLM refinement second. Maximum 3 retry attempts with full budget tracking.

Entry point: `repairConfig(config, issues) → RepairResult`

---

## Why Targeted Repair > Brute Force Retry

Brute force retry means re-running schema generation from scratch when validation fails. This approach has three problems:

1. **Cost** -- Each LLM call costs tokens. Regenerating a full AppConfig (2000+ lines) costs ~2000-4000 tokens. Targeted repair sends only the broken sections + issue list, costing ~500-1000 tokens.

2. **Regression** -- Full regeneration can fix one issue and introduce three new ones. The LLM has no memory of what was valid before. Targeted repair preserves valid sections via `structuredClone` and only modifies broken paths.

3. **Non-determinism** -- Re-running the same prompt can produce a completely different config. Deterministic fixes (Phase 1) are guaranteed to produce the same result every time. LLM refinement (Phase 2) is constrained to fix specific issues, reducing variance.

---

## Two-Phase Repair

### Phase 1: Deterministic Fixes

No LLM call. Instant. Guaranteed correct. Runs on a `structuredClone` of the config.

| Pattern | Detection | Fix |
|---|---|---|
| Missing primary key | `issue.message.includes("no primary key")` | Prepend `{ name: "id", type: "string", primaryKey: true, nullable: false, unique: true }` to the table's columns |
| Missing auth email field | `issue.message.includes("Auth fields missing 'email'")` | Append `{ name: "email", type: "email", required: true }` to `auth.fields` |
| Missing auth password field | `issue.message.includes("Auth fields missing 'password'")` | Append `{ name: "password", type: "password", required: true }` to `auth.fields` |
| No default role | `issue.message.includes("No default role")` | Set `isDefault: true` on the role named "user", or the last role if no "user" role exists |
| Enum without values | `issue.message.includes("Enum column") && issue.message.includes("no enumValues")` | Parse table and column name from message, set `enumValues: ["default"]` |

After deterministic fixes, the config is re-validated. If no blocking errors remain, repair is complete without any LLM call.

### Phase 2: LLM Refinement

Triggered only when Phase 1 leaves unresolved `error`-severity issues.

**Refinement prompt structure**:
```
System: You are a configuration refinement engine. Fix issues while preserving valid parts.
Rules:
1. Only modify what is broken
2. Fix cross-layer inconsistencies
3. Add missing required fields with sensible defaults
4. Remove hallucinated fields
5. Ensure referential integrity
6. Preserve original intent and structure
7. Output COMPLETE fixed configuration

User: Fix this config based on these validation issues:
[Full current config JSON]
[Numbered list of error-severity issues with layer, message, path, suggestion]
```

**LLM Configuration**:
- Model: `gpt-4o-mini`
- Temperature: `0.05` (lower than generation stages for maximum consistency)
- Max tokens: `8192` (full config output)
- Response format: `json_object`

**Post-refinement**: Output is parsed with `safeParseJSON` and validated with `AppConfigSchema.safeParse()`. If either fails, the attempt is recorded as failed and the next attempt begins.

---

## Retry Loop

```
attempt = 0
while hasBlockingErrors(issues) AND attempt < 3:
    attempt++

    // Phase 1: deterministic
    config = applyDeterministicFixes(config, issues)
    issues = validateConfig(config)
    if no blocking errors: break

    // Phase 2: LLM
    config = refineConfig(config, issues)
    issues = validateConfig(config)
```

Each iteration:
1. Applies all deterministic fixes that match current issues
2. Re-validates
3. If errors remain, calls LLM refinement
4. Re-validates again

This means deterministic fixes are re-applied each iteration, catching any new fixable issues introduced by LLM refinement.

---

## Repair Actions Logging

Every fix is recorded as a `RepairAction`:

```typescript
interface RepairAction {
  issueIndex: number;     // Index in the original issues array (-1 for LLM failures)
  layer: string;          // Which layer was affected
  action: "fix-field" | "add-missing" | "remove-invalid" | "regenerate-section" | "align-cross-layer";
  description: string;    // Human-readable description of what was done
  applied: boolean;       // Whether the fix was successfully applied
}
```

Deterministic fixes use action `"fix-field"` with `applied: true`.
LLM refinements use action `"regenerate-section"` with `applied: true` on success.
Failed LLM attempts use `applied: false` with the error in `description`.

These actions are stored in `PipelineState.repairActions` and persisted to the database, enabling post-hoc analysis of repair patterns.

---

## Max 3 Retry Attempts with Budget Tracking

The hard cap of 3 attempts balances reliability against cost:

- **Attempt 1**: Most deterministic fixes apply here. LLM refinement handles remaining cross-layer issues. Resolves ~80% of cases.
- **Attempt 2**: Catches issues introduced by LLM refinement in attempt 1. Resolves ~15% of remaining cases.
- **Attempt 3**: Final attempt. If this fails, the pipeline reports failure with the remaining error count.

**Budget tracking per repair cycle**:
- `totalTokens` -- accumulated across all LLM refinement calls
- `totalLatencyMs` -- accumulated wall clock time
- `attempts` -- number of iterations executed
- These are rolled into `PipelineMetrics` by the orchestrator

---

## Consistency Preservation Across Repair Cycles

The repair engine maintains consistency through several mechanisms:

1. **`structuredClone`** -- Deterministic fixes operate on a deep clone, preventing partial mutations if a fix fails midway.

2. **Full config output** -- LLM refinement returns the complete config, not patches. This avoids merge conflicts between the original and repaired sections.

3. **Re-validation after every phase** -- Both Phase 1 and Phase 2 trigger a full `validateConfig()` run. This catches regressions immediately rather than propagating them.

4. **Deterministic fixes re-run each iteration** -- If LLM refinement introduces a missing PK (unlikely but possible), the next iteration's Phase 1 catches and fixes it before Phase 2 runs again.

5. **Low temperature refinement** -- Temperature `0.05` (vs `0.1` for generation) minimizes creative deviation. The LLM's job is to fix, not redesign.

6. **Targeted context injection** -- The refinement prompt includes only error-severity issues, not warnings. This focuses the LLM on what actually needs fixing and reduces the chance of unnecessary changes to warning-level items.

---

## RepairResult Contract

```typescript
interface RepairResult {
  config: AppConfig;              // Final config (fixed or best-effort)
  actions: RepairAction[];        // All repair actions taken across all attempts
  attempts: number;               // Total attempts executed (1-3)
  success: boolean;               // true if no blocking errors remain
  remainingIssues: ValidationIssue[];  // Issues still present after repair
  totalTokens: number;            // Total tokens used by LLM refinement
  totalLatencyMs: number;         // Total wall clock time for repair
}
```

If `success` is `false`, `remainingIssues` contains the errors that could not be resolved. The orchestrator uses this to set `PipelineState.status = "failed"` with a message indicating the remaining error count.

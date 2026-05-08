# Validation Engine

## Overview

The validation engine runs 7 specialized validators against the generated `AppConfig`. Each validator is a pure function `(config: AppConfig) => ValidationIssue[]` with no side effects and no LLM calls. Validators execute sequentially, and all issues are aggregated into a single array.

The engine exposes three functions:
- `validateConfig(config)` -- runs all 7 validators, returns combined issues
- `hasBlockingErrors(issues)` -- returns `true` if any issue has severity `error`
- `issueSummary(issues)` -- returns `{ errors, warnings, info }` counts

---

## Issue Schema

```typescript
interface ValidationIssue {
  severity: "error" | "warning" | "info";
  layer: "ui" | "api" | "db" | "auth" | "cross-layer" | "business-logic";
  message: string;
  path?: string;       // JSON path to problematic field
  suggestion?: string; // Actionable fix suggestion
}
```

---

## Issue Categorization

| Severity | Meaning | Blocks pipeline? | Triggers repair? |
|---|---|---|---|
| `error` | Config is structurally broken or would fail at runtime | Yes | Yes |
| `warning` | Config is functional but incomplete or suboptimal | No | No |
| `info` | Observation, no action needed | No | No |

Only `error`-severity issues trigger the repair engine. Warnings and info are surfaced in metrics but do not block pipeline completion.

---

## Validator 1: UI-API Consistency

**What it checks**:
- Every UI page with an `entity` field has at least one matching API endpoint for that entity.
- Table page columns map to actual DB columns in the backing table (loose match: camelCase and snake_case both checked).

**Severity levels**:
- `error` -- UI page references an entity with zero API endpoints.
- `warning` -- Table column field name does not match any DB column (may be a naming convention mismatch).

**Example issues**:
- `UI page "Orders" references entity "Order" but no API endpoints exist for it` (error, cross-layer)
- `UI column "customerName" on page "Orders" may not match any DB column in table "orders"` (warning, cross-layer)

---

## Validator 2: API-DB Consistency

**What it checks**:
- Every API endpoint's `entity` has a corresponding DB table. Matches are attempted as: snake_case plural, lowercase + "s", and lowercase.

**Severity levels**:
- `error` -- API endpoint references an entity with no matching DB table.

**Example issues**:
- `API endpoint "GET /api/products" references entity "Product" but no matching DB table found` (error, cross-layer)

---

## Validator 3: DB Schema Integrity

**What it checks**:
- Every table has a primary key column.
- Foreign key references point to existing tables.
- Enum columns have a non-empty `enumValues` array.

**Severity levels**:
- `error` -- Missing primary key, broken foreign key reference, or enum without values.

**Example issues**:
- `Table "orders" has no primary key column` (error, db)
- `Column "orders.user_id" references non-existent table "users_accounts"` (error, db)
- `Enum column "orders.status" has no enumValues defined` (error, db)

---

## Validator 4: Auth Consistency

**What it checks**:
- Auth rules reference existing roles (defined in `auth.roles`).
- UI pages with `requiredRole` reference existing roles.
- API endpoints with `requiredRole` reference existing roles.
- At least one role has `isDefault: true`.
- Auth fields include `email` and `password`.

**Severity levels**:
- `error` -- Role reference to nonexistent role, missing email/password fields.
- `warning` -- No default role defined.

**Example issues**:
- `Auth rule references non-existent role "moderator"` (error, auth)
- `Page "Admin Dashboard" requires non-existent role "superadmin"` (error, auth)
- `Auth fields missing 'password' field` (error, auth)
- `No default role defined - new users won't have a role assigned` (warning, auth)

---

## Validator 5: UI Completeness

**What it checks**:
- Table pages have at least one column.
- Form pages have at least one field.
- Dashboard pages have at least one widget.
- Dashboard widgets reference entities that map to existing DB tables.
- At least one page has `showInNav: true`.

**Severity levels**:
- `error` -- Empty columns/fields/widgets on typed pages.
- `warning` -- Widget references unresolvable entity, no navigable pages.

**Example issues**:
- `Table page "Users" has no columns defined` (error, ui)
- `Dashboard page "Overview" has no widgets defined` (error, ui)
- `Widget "Total Revenue" references entity "Payment" which may not match any DB table` (warning, ui)
- `No pages have showInNav=true - navigation will be empty` (warning, ui)

---

## Validator 6: API Completeness

**What it checks**:
- Every entity exposed through the API has at least a `list` endpoint.
- Every entity exposed through the API has at least a `create` endpoint.

**Severity levels**:
- `warning` -- Missing `list` or `create` endpoint for an entity.

**Example issues**:
- `Entity "Product" has no list endpoint` (warning, api)
- `Entity "Order" has no create endpoint` (warning, api)

---

## Validator 7: Business Rules Validation

**What it checks**:
- Every business rule's `entity` field maps to an existing DB table (loose match: snake_case plural, lowercase + "s", lowercase).

**Severity levels**:
- `warning` -- Business rule references an unresolvable entity.

**Example issues**:
- `Business rule "auto_assign_agent" references entity "Ticket" which may not match any DB table` (warning, business-logic)

---

## Cross-Layer Validation Strategy

The key differentiator of this validation engine is cross-layer checking. Most validators don't just check their own layer in isolation -- they verify references across the stack:

```
UI Layer ──references──→ API Layer ──references──→ DB Layer
   |                        |                        |
   └──── Auth Layer ────────┘────────────────────────┘
```

**Validator 1** checks UI → API and UI → DB (column matching).
**Validator 2** checks API → DB (table existence).
**Validator 4** checks Auth → UI (page roles) and Auth → API (endpoint roles).
**Validator 5** checks UI → DB (widget entity resolution).
**Validator 7** checks Business Rules → DB (entity resolution).

This ensures that a UI page referencing entity "Product" guarantees:
1. An API endpoint exists for "Product" (Validator 1)
2. A DB table exists for "Product" (Validator 2, triggered by the endpoint)
3. If the page has `requiredRole`, that role exists in auth config (Validator 4)

---

## How Validation Feeds Into Repair

1. `validateConfig(config)` produces `ValidationIssue[]`.
2. `hasBlockingErrors(issues)` determines if repair is needed.
3. If `true`, the repair engine receives the full issue array.
4. Deterministic fixes pattern-match on `issue.message` to apply known fixes (missing PK, missing auth fields, etc.).
5. Remaining errors (those not handled deterministically) are passed to the LLM refinement step with their `message`, `path`, and `suggestion` fields as context.
6. After each repair attempt, `validateConfig()` is re-run to check if errors are resolved.
7. This loop runs up to 3 times.

Each validator is wrapped in try/catch inside the engine. If a validator itself throws (e.g., due to unexpected config shape), the exception is captured as a `ValidationIssue` with severity `error` and layer `cross-layer`, ensuring the pipeline never silently drops validation.

import { type AppConfig } from "@/schemas/app-config";
import { type ValidationIssue, type RepairAction } from "@/schemas/pipeline";
import { refineConfig } from "@/pipeline/refine";
import { validateConfig, hasBlockingErrors } from "@/validators/engine";
import type { LLMCallResult } from "@/pipeline/llm";

const MAX_REPAIR_ATTEMPTS = 3;

export interface RepairResult {
  config: AppConfig;
  actions: RepairAction[];
  attempts: number;
  success: boolean;
  remainingIssues: ValidationIssue[];
  totalTokens: number;
  totalLatencyMs: number;
}

// Deterministic repairs that don't need LLM
function applyDeterministicFixes(config: AppConfig, issues: ValidationIssue[]): {
  config: AppConfig;
  fixedIndices: Set<number>;
} {
  const fixedIndices = new Set<number>();
  let patched = structuredClone(config);

  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    if (issue.severity !== "error") continue;

    // Fix: missing primary key
    if (issue.message.includes("no primary key")) {
      const tableName = extractQuoted(issue.message);
      const table = patched.db.tables.find((t) => t.name === tableName);
      if (table && !table.columns.some((c) => c.primaryKey)) {
        table.columns.unshift({
          name: "id",
          type: "string",
          primaryKey: true,
          nullable: false,
          unique: true,
        });
        fixedIndices.add(i);
      }
    }

    // Fix: missing auth email field
    if (issue.message.includes("Auth fields missing 'email'")) {
      if (!patched.auth.fields.find((f) => f.name.toLowerCase() === "email")) {
        patched.auth.fields.push({ name: "email", type: "email", required: true });
        fixedIndices.add(i);
      }
    }

    // Fix: missing auth password field
    if (issue.message.includes("Auth fields missing 'password'")) {
      if (!patched.auth.fields.find((f) => f.name.toLowerCase() === "password")) {
        patched.auth.fields.push({ name: "password", type: "password", required: true });
        fixedIndices.add(i);
      }
    }

    // Fix: no default role
    if (issue.message.includes("No default role")) {
      if (patched.auth.roles.length > 0 && !patched.auth.roles.some((r) => r.isDefault)) {
        const userRole = patched.auth.roles.find((r) => r.name.toLowerCase() === "user");
        if (userRole) {
          userRole.isDefault = true;
        } else {
          patched.auth.roles[patched.auth.roles.length - 1].isDefault = true;
        }
        fixedIndices.add(i);
      }
    }

    // Fix: enum column missing values - set sensible default
    if (issue.message.includes("Enum column") && issue.message.includes("no enumValues")) {
      const match = issue.message.match(/"([^"]+)\.([^"]+)"/);
      if (match) {
        const [, tableName, colName] = match;
        const table = patched.db.tables.find((t) => t.name === tableName);
        const col = table?.columns.find((c) => c.name === colName);
        if (col && col.type === "enum") {
          col.enumValues = ["default"];
          fixedIndices.add(i);
        }
      }
    }
  }

  return { config: patched, fixedIndices };
}

export async function repairConfig(
  config: AppConfig,
  issues: ValidationIssue[]
): Promise<RepairResult> {
  let currentConfig = config;
  let currentIssues = issues;
  let allActions: RepairAction[] = [];
  let totalTokens = 0;
  let totalLatencyMs = 0;
  let attempts = 0;

  while (hasBlockingErrors(currentIssues) && attempts < MAX_REPAIR_ATTEMPTS) {
    attempts++;

    // Step 1: Apply deterministic fixes first (free, instant, reliable)
    const { config: deterministicFixed, fixedIndices } = applyDeterministicFixes(
      currentConfig,
      currentIssues
    );

    for (const idx of fixedIndices) {
      allActions.push({
        issueIndex: idx,
        layer: currentIssues[idx].layer,
        action: "fix-field",
        description: `Deterministic fix: ${currentIssues[idx].message}`,
        applied: true,
      });
    }

    currentConfig = deterministicFixed;

    // Re-validate after deterministic fixes
    currentIssues = validateConfig(currentConfig);

    if (!hasBlockingErrors(currentIssues)) break;

    // Step 2: Remaining errors need LLM-based refinement
    const remainingErrors = currentIssues.filter((i) => i.severity === "error");

    try {
      const result = await refineConfig(currentConfig, currentIssues);
      totalTokens += result.llmResult.tokensUsed;
      totalLatencyMs += result.llmResult.latencyMs;

      for (let i = 0; i < remainingErrors.length; i++) {
        allActions.push({
          issueIndex: i,
          layer: remainingErrors[i].layer,
          action: "regenerate-section",
          description: `LLM refinement attempt ${attempts}: ${remainingErrors[i].message}`,
          applied: true,
        });
      }

      currentConfig = result.appConfig;
      currentIssues = validateConfig(currentConfig);
    } catch (err) {
      allActions.push({
        issueIndex: -1,
        layer: "cross-layer",
        action: "regenerate-section",
        description: `LLM refinement attempt ${attempts} failed: ${(err as Error).message}`,
        applied: false,
      });
    }
  }

  return {
    config: currentConfig,
    actions: allActions,
    attempts,
    success: !hasBlockingErrors(currentIssues),
    remainingIssues: currentIssues,
    totalTokens,
    totalLatencyMs,
  };
}

function extractQuoted(s: string): string {
  const match = s.match(/"([^"]+)"/);
  return match?.[1] ?? "";
}

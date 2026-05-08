import { type PipelineState, type PipelineMetrics } from "@/schemas/pipeline";
import { extractIntent } from "./intent";
import { generateDesign } from "./design";
import { generateSchema } from "./schema-gen";
import { validateConfig, hasBlockingErrors, issueSummary } from "@/validators/engine";
import { repairConfig } from "@/repair/engine";
import { validateRuntimeExecutability } from "@/runtime/validator";
import { simulateExecution } from "@/runtime/simulator";
import { estimateCost, rateLimitDelay } from "./llm";

export type StageCallback = (stage: string, state: Partial<PipelineState>) => void;

export interface PipelineResult {
  state: PipelineState;
}

export async function runPipeline(
  prompt: string,
  onStageUpdate?: StageCallback
): Promise<PipelineResult> {
  const id = generateId();
  const pipelineStart = Date.now();
  const stageLatencies: Record<string, number> = {};
  let totalTokens = 0;
  let totalLLMCalls = 0;
  let retryCount = 0;

  const state: PipelineState = {
    id,
    prompt,
    currentStage: "intent",
    status: "running",
    intent: null,
    design: null,
    appConfig: null,
    validationIssues: [],
    repairActions: [],
    metrics: null,
    error: null,
  };

  try {
    // ── Stage 1: Intent Extraction ──
    onStageUpdate?.("intent", { currentStage: "intent" });
    const intentStart = Date.now();
    const { intent, llmResult: intentLLM } = await extractIntent(prompt);
    stageLatencies.intent = Date.now() - intentStart;
    totalTokens += intentLLM.tokensUsed;
    totalLLMCalls++;
    state.intent = intent;

    await rateLimitDelay(); // 5s pause to avoid Gemini rate limits

    // ── Stage 2: System Design ──
    onStageUpdate?.("design", { currentStage: "design", intent });
    const designStart = Date.now();
    const { design, llmResult: designLLM } = await generateDesign(intent);
    stageLatencies.design = Date.now() - designStart;
    totalTokens += designLLM.tokensUsed;
    totalLLMCalls++;
    state.design = design;

    await rateLimitDelay(); // 5s pause to avoid Gemini rate limits

    // ── Stage 3: Schema Generation ──
    onStageUpdate?.("schema", { currentStage: "schema", design });
    const schemaStart = Date.now();
    const { appConfig, llmResult: schemaLLM } = await generateSchema(intent, design);
    stageLatencies.schema = Date.now() - schemaStart;
    totalTokens += schemaLLM.tokensUsed;
    totalLLMCalls += 2; // schema gen makes 2 calls (DB+Auth, then UI+API)
    state.appConfig = appConfig;

    // ── Stage 4: Validation ──
    onStageUpdate?.("validation", { currentStage: "validation", appConfig });
    const validationStart = Date.now();
    const validationIssues = validateConfig(appConfig);
    stageLatencies.validation = Date.now() - validationStart;
    state.validationIssues = validationIssues;

    // ── Stage 5: Repair (if needed) ──
    if (hasBlockingErrors(validationIssues)) {
      onStageUpdate?.("repair", { currentStage: "repair", validationIssues });
      const repairStart = Date.now();
      const repairResult = await repairConfig(appConfig, validationIssues);
      stageLatencies.repair = Date.now() - repairStart;
      totalTokens += repairResult.totalTokens;
      totalLLMCalls += repairResult.attempts;
      retryCount = repairResult.attempts;

      state.appConfig = repairResult.config;
      state.repairActions = repairResult.actions;
      state.validationIssues = repairResult.remainingIssues;

      if (!repairResult.success) {
        state.status = "failed";
        state.error = `Repair failed after ${repairResult.attempts} attempts. ${repairResult.remainingIssues.filter((i) => i.severity === "error").length} errors remain.`;
      }
    }

    // ── Stage 6: Runtime Validation ──
    if (state.status !== "failed" && state.appConfig) {
      const rtValidation = validateRuntimeExecutability(state.appConfig);
      const simulation = simulateExecution(state.appConfig);

      if (!rtValidation.executable) {
        // Add runtime issues as warnings (don't fail, but report)
        for (const check of rtValidation.checks.filter((c) => !c.passed)) {
          state.validationIssues.push({
            severity: "warning",
            layer: "cross-layer",
            message: `Runtime check "${check.name}" failed: ${check.details}`,
          });
        }
      }

      if (!simulation.success) {
        for (const err of simulation.errors) {
          state.validationIssues.push({
            severity: "warning",
            layer: "cross-layer",
            message: `Simulation: ${err}`,
          });
        }
      }

      state.currentStage = "complete";
      state.status = "completed";
    } else if (state.status !== "failed") {
      state.currentStage = "complete";
      state.status = "completed";
    }

    // ── Build metrics ──
    const summary = issueSummary(state.validationIssues);
    state.metrics = {
      totalLatencyMs: Date.now() - pipelineStart,
      stageLatencies,
      llmCalls: totalLLMCalls,
      tokensUsed: totalTokens,
      validationErrors: summary.errors,
      validationWarnings: summary.warnings,
      repairAttempts: retryCount,
      repairSuccesses: state.repairActions.filter((a) => a.applied).length,
      retryCount,
      estimatedCostUsd: estimateCost("gemini-2.5-flash-lite", totalTokens),
    };

    onStageUpdate?.(state.currentStage, state);
  } catch (err) {
    state.status = "failed";
    state.error = (err as Error).message;
    state.metrics = {
      totalLatencyMs: Date.now() - pipelineStart,
      stageLatencies,
      llmCalls: totalLLMCalls,
      tokensUsed: totalTokens,
      validationErrors: 0,
      validationWarnings: 0,
      repairAttempts: retryCount,
      repairSuccesses: 0,
      retryCount,
      estimatedCostUsd: estimateCost("gemini-2.5-flash-lite", totalTokens),
    };
    onStageUpdate?.("failed", state);
  }

  return { state };
}

function generateId(): string {
  return `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

import { runPipeline } from "@/pipeline/orchestrator";
import { validateRuntimeExecutability } from "@/runtime/validator";
import { simulateExecution } from "@/runtime/simulator";
import { ALL_PROMPTS, REALISTIC_PROMPTS, EDGE_CASE_PROMPTS, type EvalPrompt } from "./datasets";

export interface EvalResult {
  promptId: string;
  prompt: string;
  category: string;
  status: "success" | "failure" | "skipped";
  pipelineStatus: string;
  latencyMs: number;
  llmCalls: number;
  tokensUsed: number;
  costUsd: number;
  validationErrors: number;
  validationWarnings: number;
  repairAttempts: number;
  repairSuccesses: number;
  runtimeScore: number;
  runtimeExecutable: boolean;
  simulationSuccess: boolean;
  error?: string;
}

export interface EvalSummary {
  totalPrompts: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  successRate: number;
  avgLatencyMs: number;
  avgTokensUsed: number;
  avgCostUsd: number;
  avgRuntimeScore: number;
  avgRepairAttempts: number;
  totalCostUsd: number;
  byCategory: Record<string, { total: number; success: number; rate: number }>;
  byDifficulty: Record<string, { total: number; success: number; rate: number }>;
}

export async function runEvaluation(
  prompts?: EvalPrompt[],
  onResult?: (result: EvalResult) => void
): Promise<{ results: EvalResult[]; summary: EvalSummary }> {
  const dataset = prompts ?? ALL_PROMPTS;
  const results: EvalResult[] = [];

  for (const evalPrompt of dataset) {
    // Skip empty/adversarial prompts
    if (!evalPrompt.prompt || evalPrompt.prompt.trim().length === 0) {
      const result: EvalResult = {
        promptId: evalPrompt.id,
        prompt: evalPrompt.prompt,
        category: evalPrompt.category,
        status: "skipped",
        pipelineStatus: "skipped",
        latencyMs: 0,
        llmCalls: 0,
        tokensUsed: 0,
        costUsd: 0,
        validationErrors: 0,
        validationWarnings: 0,
        repairAttempts: 0,
        repairSuccesses: 0,
        runtimeScore: 0,
        runtimeExecutable: false,
        simulationSuccess: false,
        error: "Empty prompt",
      };
      results.push(result);
      onResult?.(result);
      continue;
    }

    try {
      const { state } = await runPipeline(evalPrompt.prompt);

      let runtimeScore = 0;
      let runtimeExecutable = false;
      let simulationSuccess = false;

      if (state.appConfig) {
        const rtValidation = validateRuntimeExecutability(state.appConfig);
        runtimeScore = rtValidation.score;
        runtimeExecutable = rtValidation.executable;

        const simulation = simulateExecution(state.appConfig);
        simulationSuccess = simulation.success;
      }

      const result: EvalResult = {
        promptId: evalPrompt.id,
        prompt: evalPrompt.prompt,
        category: evalPrompt.category,
        status: state.status === "completed" ? "success" : "failure",
        pipelineStatus: state.status,
        latencyMs: state.metrics?.totalLatencyMs ?? 0,
        llmCalls: state.metrics?.llmCalls ?? 0,
        tokensUsed: state.metrics?.tokensUsed ?? 0,
        costUsd: state.metrics?.estimatedCostUsd ?? 0,
        validationErrors: state.metrics?.validationErrors ?? 0,
        validationWarnings: state.metrics?.validationWarnings ?? 0,
        repairAttempts: state.metrics?.repairAttempts ?? 0,
        repairSuccesses: state.metrics?.repairSuccesses ?? 0,
        runtimeScore,
        runtimeExecutable,
        simulationSuccess,
        error: state.error ?? undefined,
      };

      results.push(result);
      onResult?.(result);
    } catch (err) {
      const result: EvalResult = {
        promptId: evalPrompt.id,
        prompt: evalPrompt.prompt,
        category: evalPrompt.category,
        status: "failure",
        pipelineStatus: "crashed",
        latencyMs: 0,
        llmCalls: 0,
        tokensUsed: 0,
        costUsd: 0,
        validationErrors: 0,
        validationWarnings: 0,
        repairAttempts: 0,
        repairSuccesses: 0,
        runtimeScore: 0,
        runtimeExecutable: false,
        simulationSuccess: false,
        error: (err as Error).message,
      };
      results.push(result);
      onResult?.(result);
    }
  }

  const summary = computeSummary(results);
  return { results, summary };
}

function computeSummary(results: EvalResult[]): EvalSummary {
  const nonSkipped = results.filter((r) => r.status !== "skipped");
  const successes = nonSkipped.filter((r) => r.status === "success");

  const byCategory: Record<string, { total: number; success: number; rate: number }> = {};
  const byDifficulty: Record<string, { total: number; success: number; rate: number }> = {};

  for (const r of nonSkipped) {
    // By category
    if (!byCategory[r.category]) byCategory[r.category] = { total: 0, success: 0, rate: 0 };
    byCategory[r.category].total++;
    if (r.status === "success") byCategory[r.category].success++;

    // By difficulty (from dataset)
    const prompt = ALL_PROMPTS.find((p) => p.id === r.promptId);
    if (prompt) {
      if (!byDifficulty[prompt.difficulty]) byDifficulty[prompt.difficulty] = { total: 0, success: 0, rate: 0 };
      byDifficulty[prompt.difficulty].total++;
      if (r.status === "success") byDifficulty[prompt.difficulty].success++;
    }
  }

  for (const cat of Object.values(byCategory)) cat.rate = cat.total ? cat.success / cat.total : 0;
  for (const diff of Object.values(byDifficulty)) diff.rate = diff.total ? diff.success / diff.total : 0;

  return {
    totalPrompts: results.length,
    successCount: successes.length,
    failureCount: nonSkipped.filter((r) => r.status === "failure").length,
    skippedCount: results.filter((r) => r.status === "skipped").length,
    successRate: nonSkipped.length ? successes.length / nonSkipped.length : 0,
    avgLatencyMs: avg(nonSkipped.map((r) => r.latencyMs)),
    avgTokensUsed: avg(nonSkipped.map((r) => r.tokensUsed)),
    avgCostUsd: avg(nonSkipped.map((r) => r.costUsd)),
    avgRuntimeScore: avg(successes.map((r) => r.runtimeScore)),
    avgRepairAttempts: avg(nonSkipped.map((r) => r.repairAttempts)),
    totalCostUsd: nonSkipped.reduce((s, r) => s + r.costUsd, 0),
    byCategory,
    byDifficulty,
  };
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

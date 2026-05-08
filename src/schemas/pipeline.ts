import { z } from "zod";
import { IntentSchema } from "./intent";
import { DesignSchema } from "./design";
import { AppConfigSchema } from "./app-config";

// Pipeline orchestration types

export const PipelineStageEnum = z.enum([
  "intent",
  "design",
  "schema",
  "refinement",
  "validation",
  "repair",
  "complete",
]);

export const ValidationIssueSchema = z.object({
  severity: z.enum(["error", "warning", "info"]),
  layer: z.enum(["ui", "api", "db", "auth", "cross-layer", "business-logic"]),
  message: z.string(),
  path: z.string().optional().describe("JSON path to the problematic field"),
  suggestion: z.string().optional(),
});

export const RepairActionSchema = z.object({
  issueIndex: z.number(),
  layer: z.string(),
  action: z.enum(["fix-field", "add-missing", "remove-invalid", "regenerate-section", "align-cross-layer"]),
  description: z.string(),
  applied: z.boolean().default(false),
});

export const PipelineMetricsSchema = z.object({
  totalLatencyMs: z.number(),
  stageLatencies: z.record(z.string(), z.number()),
  llmCalls: z.number(),
  tokensUsed: z.number(),
  validationErrors: z.number(),
  validationWarnings: z.number(),
  repairAttempts: z.number(),
  repairSuccesses: z.number(),
  retryCount: z.number(),
  estimatedCostUsd: z.number(),
});

export const PipelineStateSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  currentStage: PipelineStageEnum,
  status: z.enum(["running", "completed", "failed"]),
  intent: IntentSchema.nullable().default(null),
  design: DesignSchema.nullable().default(null),
  appConfig: AppConfigSchema.nullable().default(null),
  validationIssues: z.array(ValidationIssueSchema).default([]),
  repairActions: z.array(RepairActionSchema).default([]),
  metrics: PipelineMetricsSchema.nullable().default(null),
  error: z.string().nullable().default(null),
});

export type PipelineStage = z.infer<typeof PipelineStageEnum>;
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
export type RepairAction = z.infer<typeof RepairActionSchema>;
export type PipelineMetrics = z.infer<typeof PipelineMetricsSchema>;
export type PipelineState = z.infer<typeof PipelineStateSchema>;

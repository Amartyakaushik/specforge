import { AppConfigSchema, type AppConfig } from "@/schemas/app-config";
import { type ValidationIssue } from "@/schemas/pipeline";
import { callLLM, safeParseJSON, type LLMCallResult } from "./llm";

const SYSTEM_PROMPT = `You are a configuration refinement engine. Given an application config and a list of validation issues, fix the issues while preserving all valid parts.

RULES:
1. Only modify what is broken - do NOT restructure valid sections
2. Fix cross-layer inconsistencies (UI fields must map to API endpoints which must map to DB columns)
3. Add missing required fields with sensible defaults
4. Remove hallucinated fields that don't match the schema
5. Ensure referential integrity (all entity references must exist)
6. Preserve the original intent and structure
7. Output the COMPLETE fixed configuration (not just the changes)

Output ONLY valid JSON matching the full AppConfig schema.`;

export interface RefineResult {
  appConfig: AppConfig;
  llmResult: LLMCallResult;
  issuesAddressed: number;
}

export async function refineConfig(
  config: AppConfig,
  issues: ValidationIssue[]
): Promise<RefineResult> {
  const errorIssues = issues.filter((i) => i.severity === "error");
  if (errorIssues.length === 0) {
    return {
      appConfig: config,
      llmResult: { content: "", tokensUsed: 0, latencyMs: 0 },
      issuesAddressed: 0,
    };
  }

  const userPrompt = `Fix this application configuration based on the validation issues.

Current Config:
${JSON.stringify(config, null, 2)}

Issues to fix (errors only):
${errorIssues.map((i, idx) => `${idx + 1}. [${i.layer}] ${i.message}${i.path ? ` (at ${i.path})` : ""}${i.suggestion ? ` - Suggestion: ${i.suggestion}` : ""}`).join("\n")}

Return the COMPLETE fixed configuration.`;

  const llmResult = await callLLM(SYSTEM_PROMPT, userPrompt, {
    model: "gemini-2.5-flash-lite",
    temperature: 0.05,
    maxTokens: 8192,
    responseFormat: "json",
  });

  const parsed = safeParseJSON(llmResult.content);
  if (!parsed.success) {
    throw new Error(`Refinement failed: invalid JSON - ${parsed.error}`);
  }

  const validated = AppConfigSchema.safeParse(parsed.data);
  if (!validated.success) {
    throw new Error(
      `Refinement failed: schema validation - ${validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`
    );
  }

  return {
    appConfig: validated.data,
    llmResult,
    issuesAddressed: errorIssues.length,
  };
}

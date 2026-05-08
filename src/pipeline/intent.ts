import { IntentSchema, type Intent } from "@/schemas/intent";
import { callLLM, safeParseJSON, type LLMCallResult } from "./llm";

const SYSTEM_PROMPT = `You are a software requirements analyst. Your job is to extract structured intent from natural language application descriptions.

You MUST output valid JSON matching this exact structure:
{
  "appName": "string - inferred name for the app",
  "appType": "crm|cms|ecommerce|saas|dashboard|marketplace|social|productivity|erp|custom",
  "description": "one-line description",
  "features": [
    {
      "name": "feature_id",
      "description": "what it does",
      "priority": "core|secondary|optional",
      "category": "auth|crud|dashboard|payment|notification|analytics|search|file-management|messaging|settings|other"
    }
  ],
  "hasAuth": boolean,
  "hasPayments": boolean,
  "hasAnalytics": boolean,
  "targetUsers": ["user type strings"],
  "assumptions": ["assumptions made where info was missing"],
  "ambiguities": ["detected ambiguities in the prompt"]
}

Rules:
- Extract ALL features mentioned or implied
- If auth is mentioned or implied (roles, login, permissions), set hasAuth=true
- If payments/billing/premium/plans mentioned, set hasPayments=true
- If dashboard/analytics/metrics mentioned, set hasAnalytics=true
- Always identify target user types (admin, user, etc.)
- Document ANY assumptions you make
- Flag ambiguities (conflicting requirements, unclear scope)
- Infer implied features (e.g. "CRM" implies contacts, deals)
- MAX 8 features. Pick the most important ones.
- Keep descriptions SHORT (under 10 words each)
- Output ONLY valid JSON. No explanations.`;

export interface IntentResult {
  intent: Intent;
  llmResult: LLMCallResult;
}

export async function extractIntent(prompt: string): Promise<IntentResult> {
  const llmResult = await callLLM(SYSTEM_PROMPT, prompt, {
    temperature: 0.1,
    maxTokens: 2048,
    responseFormat: "json",
  });

  const parsed = safeParseJSON(llmResult.content);
  if (!parsed.success) {
    throw new Error(`Intent extraction failed: invalid JSON - ${parsed.error}`);
  }

  const validated = IntentSchema.safeParse(parsed.data);
  if (!validated.success) {
    throw new Error(
      `Intent extraction failed: schema validation - ${validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`
    );
  }

  return { intent: validated.data, llmResult };
}

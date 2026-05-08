import { DesignSchema, type Design } from "@/schemas/design";
import { type Intent } from "@/schemas/intent";
import { callLLM, safeParseJSON, type LLMCallResult } from "./llm";

const SYSTEM_PROMPT = `You are a software architect. Output a COMPACT system design as JSON.

STRICT RULES:
- MAX 6 entities. Pick the most important ones.
- MAX 5 fields per entity (plus id). No verbose descriptions.
- MAX 2 roles. Keep permissions minimal.
- MAX 2 flows with MAX 3 steps each.
- Every entity MUST have an "id" field of type "string"
- Do NOT include password fields in entities
- OMIT optional/null fields entirely instead of including them
- Be EXTREMELY concise. No long descriptions.

Output this JSON structure:
{
  "entities": [{"name":"Name","description":"short","fields":[{"name":"id","type":"string","required":true,"unique":true},{"name":"field","type":"string","required":true}],"timestamps":true}],
  "roles": [{"name":"user","description":"default user","permissions":[{"entity":"Name","actions":["create","read","update","delete","list"]}],"isDefault":true}],
  "flows": [{"name":"flow","description":"short","trigger":"action","steps":[{"action":"do thing","description":"short"}]}],
  "authStrategy": "email-password",
  "authFields": [{"name":"email","type":"email","required":true},{"name":"password","type":"password","required":true}]
}`;

export interface DesignResult {
  design: Design;
  llmResult: LLMCallResult;
}

export async function generateDesign(intent: Intent): Promise<DesignResult> {
  const userPrompt = `Design for: ${intent.appName} (${intent.appType})
Features: ${intent.features.slice(0, 8).map((f) => f.name).join(", ")}
Auth: ${intent.hasAuth}, Payments: ${intent.hasPayments}, Analytics: ${intent.hasAnalytics}
Users: ${intent.targetUsers.join(", ")}
Keep it COMPACT. Max 6 entities, 5 fields each.`;

  const llmResult = await callLLM(SYSTEM_PROMPT, userPrompt, {
    temperature: 0.05,
    maxTokens: 8192,
    responseFormat: "json",
  });

  const parsed = safeParseJSON(llmResult.content);
  if (!parsed.success) {
    throw new Error(`Design generation failed: invalid JSON - ${parsed.error}`);
  }

  const validated = DesignSchema.safeParse(parsed.data);
  if (!validated.success) {
    throw new Error(
      `Design generation failed: schema validation - ${validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`
    );
  }

  return { design: validated.data, llmResult };
}

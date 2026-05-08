import { DesignSchema, type Design } from "@/schemas/design";
import { type Intent } from "@/schemas/intent";
import { callLLM, safeParseJSON, type LLMCallResult } from "./llm";

const SYSTEM_PROMPT = `You are a software architect. Given structured intent, produce a system design with entities, roles, and flows.

Output valid JSON matching this structure:
{
  "entities": [
    {
      "name": "PascalCase",
      "description": "what this entity represents",
      "fields": [
        {
          "name": "camelCase field name",
          "type": "string|number|boolean|email|date|text|password|enum|relation|json",
          "required": true/false,
          "unique": true/false,
          "enumValues": ["only if type=enum"],
          "relationTo": "EntityName if type=relation",
          "relationType": "one-to-one|one-to-many|many-to-many",
          "validation": { "min": N, "max": N, "minLength": N, "maxLength": N }
        }
      ],
      "timestamps": true,
      "softDelete": false,
      "ownerScoped": false
    }
  ],
  "roles": [
    {
      "name": "role_name",
      "description": "role description",
      "permissions": [
        {
          "entity": "EntityName",
          "actions": ["create","read","update","delete","list"],
          "condition": "own or null"
        }
      ],
      "isDefault": true/false
    }
  ],
  "flows": [
    {
      "name": "flow_name",
      "description": "what this flow does",
      "trigger": "what starts it",
      "steps": [
        {
          "action": "action description",
          "entity": "EntityName",
          "description": "step detail",
          "requiresAuth": true/false,
          "requiredRole": "role_name or null"
        }
      ]
    }
  ],
  "authStrategy": "none|email-password|oauth|api-key",
  "authFields": [
    { "name": "field", "type": "string|email|password|enum", "required": true, "enumValues": [] }
  ]
}

Rules:
- Every entity MUST have an "id" field of type "string"
- Include realistic fields (not just id/name)
- Relations must reference existing entities
- If auth is needed, include appropriate roles
- Default role should be the basic user role
- Flows should cover key user journeys
- Auth fields define registration form (always include email + password if auth is enabled)
- Do NOT include password fields in entity definitions - auth is handled separately
- Output ONLY valid JSON.`;

export interface DesignResult {
  design: Design;
  llmResult: LLMCallResult;
}

export async function generateDesign(intent: Intent): Promise<DesignResult> {
  const userPrompt = `Generate system design for this application:

App: ${intent.appName} (${intent.appType})
Description: ${intent.description}

Features:
${intent.features.map((f) => `- [${f.priority}] ${f.name}: ${f.description} (${f.category})`).join("\n")}

Auth required: ${intent.hasAuth}
Payments: ${intent.hasPayments}
Analytics: ${intent.hasAnalytics}
Target users: ${intent.targetUsers.join(", ")}
Assumptions: ${intent.assumptions.join("; ")}`;

  const llmResult = await callLLM(SYSTEM_PROMPT, userPrompt, {
    temperature: 0.1,
    maxTokens: 4096,
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

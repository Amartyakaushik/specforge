import { AppConfigSchema, type AppConfig } from "@/schemas/app-config";
import { type Intent } from "@/schemas/intent";
import { type Design } from "@/schemas/design";
import { callLLM, safeParseJSON, rateLimitDelay, type LLMCallResult } from "./llm";

const DB_AUTH_PROMPT = `You generate database and auth configurations as JSON. Be COMPACT — use short descriptions, minimal fields.

Output this EXACT JSON structure (no extra text):
{
  "db": {
    "tables": [
      {
        "name": "snake_case_plural",
        "columns": [
          {"name":"id","type":"string","primaryKey":true},
          {"name":"field_name","type":"string|integer|float|boolean|text|datetime|enum","nullable":false,"unique":false}
        ],
        "timestamps": true
      }
    ]
  },
  "auth": {
    "enabled": true,
    "strategy": "email-password",
    "roles": [{"name":"user","isDefault":true}],
    "fields": [{"name":"email","type":"email","required":true},{"name":"password","type":"password","required":true}],
    "rules": [{"role":"user","entity":"tableName","actions":["create","read","update","delete","list"],"scope":"all"}],
    "sessionDuration": "7d"
  },
  "businessRules": [{"name":"rule_id","description":"desc","trigger":"before-create","entity":"Entity","condition":"cond","action":"act"}]
}

RULES:
- Every table MUST have "id" column with primaryKey:true
- Use snake_case plural for table names
- Keep it COMPACT. No verbose descriptions.
- If auth not needed, set enabled:false with empty arrays
- Enum columns must have enumValues array`;

const UI_API_PROMPT = `You generate UI pages and API endpoints as JSON. Be COMPACT.

You will receive the DB schema. Generate UI and API that match these tables exactly.

Output this EXACT JSON structure (no extra text):
{
  "ui": {
    "appName": "App Name",
    "pages": [
      {
        "name": "page_id",
        "path": "/path",
        "type": "table|form|dashboard",
        "entity": "EntityName",
        "title": "Title",
        "showInNav": true,
        "columns": [{"field":"col","label":"Label"}],
        "actions": [{"label":"Add","action":"create"}],
        "widgets": [{"type":"stat","label":"Total","entity":"Entity","operation":"count"}]
      }
    ]
  },
  "api": {
    "basePath": "/api",
    "endpoints": [
      {"method":"GET","path":"/api/items","entity":"items","action":"list","requiresAuth":false,"pagination":true},
      {"method":"POST","path":"/api/items","entity":"items","action":"create","requiresAuth":false},
      {"method":"PUT","path":"/api/items/:id","entity":"items","action":"update","requiresAuth":false},
      {"method":"DELETE","path":"/api/items/:id","entity":"items","action":"delete","requiresAuth":false}
    ]
  }
}

RULES:
- Table pages need "columns" array. Form pages need "fields" array. Dashboard pages need "widgets" array.
- ONLY reference entities that exist in the DB schema provided
- Keep endpoint list minimal: list, create, update, delete per entity
- Be COMPACT. Short labels, no verbose descriptions.
- Omit null/optional fields instead of including them as null`;

export interface SchemaGenResult {
  appConfig: AppConfig;
  llmResult: LLMCallResult;
}

export async function generateSchema(intent: Intent, design: Design): Promise<SchemaGenResult> {
  // Step 1: Generate DB + Auth
  const dbAuthPrompt = `Generate DB tables and auth config for:
App: ${intent.appName} (${intent.appType})
Entities: ${design.entities.map((e) => `${e.name}(${e.fields.map((f) => f.name + ":" + f.type).join(",")})`).join("; ")}
Auth: ${design.authStrategy}, Roles: ${design.roles.map((r) => r.name).join(",")}
${intent.hasPayments ? "Has payments/billing" : ""}`;

  const dbAuthResult = await callLLM(DB_AUTH_PROMPT, dbAuthPrompt, {
    temperature: 0.05,
    maxTokens: 8192,
    responseFormat: "json",
  });

  const dbAuthParsed = safeParseJSON(dbAuthResult.content);
  if (!dbAuthParsed.success) {
    throw new Error(`Schema generation (DB) failed: invalid JSON - ${dbAuthParsed.error}`);
  }

  const dbAuth = dbAuthParsed.data as Record<string, unknown>;

  await rateLimitDelay();

  // Step 2: Generate UI + API (informed by DB schema)
  const tableNames = ((dbAuth.db as Record<string, unknown>)?.tables as Array<Record<string, unknown>>)
    ?.map((t) => t.name as string) ?? [];

  const uiApiPrompt = `Generate UI pages and API for:
App: ${intent.appName}
DB Tables: ${tableNames.join(", ")}
Features: ${intent.features.map((f) => f.name).join(", ")}
Auth enabled: ${intent.hasAuth}
Has analytics: ${intent.hasAnalytics}
Roles: ${design.roles.map((r) => r.name).join(",")}`;

  const uiApiResult = await callLLM(UI_API_PROMPT, uiApiPrompt, {
    temperature: 0.05,
    maxTokens: 8192,
    responseFormat: "json",
  });

  const uiApiParsed = safeParseJSON(uiApiResult.content);
  if (!uiApiParsed.success) {
    throw new Error(`Schema generation (UI) failed: invalid JSON - ${uiApiParsed.error}`);
  }

  const uiApi = uiApiParsed.data as Record<string, unknown>;

  // Merge into full config
  const merged = {
    version: "1.0.0",
    ui: uiApi.ui,
    api: uiApi.api,
    db: dbAuth.db,
    auth: dbAuth.auth,
    businessRules: dbAuth.businessRules ?? [],
  };

  const totalTokens = dbAuthResult.tokensUsed + uiApiResult.tokensUsed;
  const totalLatency = dbAuthResult.latencyMs + uiApiResult.latencyMs;

  const validated = AppConfigSchema.safeParse(merged);
  if (!validated.success) {
    throw new Error(
      `Schema generation failed: schema validation - ${validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`
    );
  }

  return {
    appConfig: validated.data,
    llmResult: { content: "", tokensUsed: totalTokens, latencyMs: totalLatency },
  };
}

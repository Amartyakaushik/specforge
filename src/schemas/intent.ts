import { z } from "zod";

// Stage 1: Intent Extraction IR
// Parses raw natural language into structured intent

export const FeatureSchema = z.object({
  name: z.string(),
  description: z.string(),
  priority: z.string().default("core"), // core, secondary, optional — but accept anything
  category: z.string().default("other"), // auth, crud, dashboard, etc — but accept anything
});

export const IntentSchema = z.object({
  appName: z.string(),
  appType: z.string().default("custom"),
  description: z.string(),
  features: z.array(FeatureSchema).min(1),
  hasAuth: z.boolean().default(false),
  hasPayments: z.boolean().default(false),
  hasAnalytics: z.boolean().default(false),
  targetUsers: z.array(z.string()).default(["user"]),
  assumptions: z.array(z.string()).default([]),
  ambiguities: z.array(z.string()).default([]),
}).passthrough(); // accept extra fields the LLM might add

export type Intent = z.infer<typeof IntentSchema>;
export type Feature = z.infer<typeof FeatureSchema>;

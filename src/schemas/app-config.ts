import { z } from "zod";

// Stage 3: Full Application Configuration Schema
// This is the final executable output consumed by the runtime
// Intentionally permissive on enums — LLMs output variations we can't predict.
// The validation engine catches semantic issues; Zod just ensures structural correctness.

// --- UI Schema ---

export const UIFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.string().default("text"),
  placeholder: z.string().optional().nullable(),
  required: z.boolean().default(false),
  options: z.array(z.object({ label: z.string(), value: z.string() }).passthrough()).optional().nullable(),
  defaultValue: z.any().optional().nullable(),
}).passthrough();

export const WidgetSchema = z.object({
  type: z.string().default("stat"),
  label: z.string(),
  entity: z.string(),
  field: z.string().optional().nullable(),
  operation: z.string().optional().nullable(),
}).passthrough();

export const ColumnSchema = z.object({
  field: z.string(),
  label: z.string(),
  sortable: z.boolean().default(true),
  type: z.string().default("text"),
}).passthrough();

export const PageActionSchema = z.object({
  label: z.string(),
  action: z.string(),
  icon: z.string().optional().nullable(),
}).passthrough();

export const PageSchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.string().default("table"),
  entity: z.string().optional().nullable(),
  title: z.string(),
  icon: z.string().optional().nullable(),
  requiredRole: z.string().optional().nullable(),
  columns: z.array(ColumnSchema).optional().nullable(),
  fields: z.array(UIFieldSchema).optional().nullable(),
  actions: z.array(PageActionSchema).optional().nullable(),
  widgets: z.array(WidgetSchema).optional().nullable(),
  showInNav: z.boolean().default(true),
}).passthrough();

export const UIConfigSchema = z.object({
  appName: z.string(),
  theme: z.string().default("light"),
  primaryColor: z.string().default("#3b82f6"),
  pages: z.array(PageSchema).min(1),
  navigation: z.object({
    type: z.string().default("sidebar"),
    logo: z.string().optional().nullable(),
  }).passthrough().optional().default({ type: "sidebar" }),
}).passthrough();

// --- API Schema ---

export const APIParamSchema = z.object({
  name: z.string(),
  type: z.string().default("string"),
  required: z.boolean().default(true),
  in: z.string().default("body"),
  description: z.string().optional().nullable(),
}).passthrough();

export const EndpointSchema = z.object({
  method: z.string(),
  path: z.string(),
  description: z.string().default(""),
  entity: z.string().optional().nullable(),
  action: z.string().default("custom"),
  params: z.array(APIParamSchema).optional().nullable(),
  requiresAuth: z.boolean().default(false),
  requiredRole: z.string().optional().nullable(),
  pagination: z.boolean().default(false),
}).passthrough();

export const APIConfigSchema = z.object({
  basePath: z.string().default("/api"),
  endpoints: z.array(EndpointSchema).min(1),
}).passthrough();

// --- DB Schema ---

export const DBColumnSchema = z.object({
  name: z.string(),
  type: z.string().default("string"),
  primaryKey: z.boolean().default(false),
  nullable: z.boolean().default(false),
  unique: z.boolean().default(false),
  defaultValue: z.any().optional().nullable(),
  enumValues: z.array(z.string()).optional().nullable(),
  references: z
    .object({
      table: z.string(),
      column: z.string(),
      onDelete: z.string().default("cascade"),
    })
    .passthrough()
    .optional()
    .nullable(),
}).passthrough();

export const DBTableSchema = z.object({
  name: z.string(),
  columns: z.array(DBColumnSchema).min(1),
  indexes: z
    .array(
      z.object({
        columns: z.array(z.string()),
        unique: z.boolean().default(false),
      }).passthrough()
    )
    .optional()
    .nullable(),
  timestamps: z.boolean().default(true),
}).passthrough();

export const DBConfigSchema = z.object({
  tables: z.array(DBTableSchema).min(1),
}).passthrough();

// --- Auth Schema ---

export const AuthRuleSchema = z.object({
  role: z.string(),
  entity: z.string(),
  actions: z.array(z.string()),
  scope: z.string().default("all"),
}).passthrough();

export const AuthConfigSchema = z.object({
  enabled: z.boolean(),
  strategy: z.string().default("email-password"),
  roles: z.array(
    z.object({
      name: z.string(),
      isDefault: z.boolean().default(false),
    }).passthrough()
  ).default([]),
  fields: z.array(
    z.object({
      name: z.string(),
      type: z.string().default("string"),
      required: z.boolean().default(true),
      enumValues: z.array(z.string()).optional().nullable(),
    }).passthrough()
  ).default([]),
  rules: z.array(AuthRuleSchema).default([]),
  sessionDuration: z.string().default("7d"),
}).passthrough();

// --- Business Logic ---

export const BusinessRuleSchema = z.object({
  name: z.string(),
  description: z.string().default(""),
  trigger: z.string(),
  entity: z.string(),
  condition: z.string().default(""),
  action: z.string().default(""),
}).passthrough();

// --- Full Application Config ---

export const AppConfigSchema = z.object({
  version: z.string().default("1.0.0"),
  ui: UIConfigSchema,
  api: APIConfigSchema,
  db: DBConfigSchema,
  auth: AuthConfigSchema,
  businessRules: z.array(BusinessRuleSchema).optional().nullable(),
}).passthrough();

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type UIConfig = z.infer<typeof UIConfigSchema>;
export type APIConfig = z.infer<typeof APIConfigSchema>;
export type DBConfig = z.infer<typeof DBConfigSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Endpoint = z.infer<typeof EndpointSchema>;
export type DBTable = z.infer<typeof DBTableSchema>;
export type DBColumn = z.infer<typeof DBColumnSchema>;

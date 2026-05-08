import { z } from "zod";

// Stage 2: System Design IR
// Converts intent into app architecture: entities, roles, flows

export const FieldDefSchema = z.object({
  name: z.string(),
  type: z.string().default("string"), // string, number, boolean, email, date, text, password, enum, relation, json, etc
  required: z.boolean().default(true),
  unique: z.boolean().default(false),
  defaultValue: z.any().optional().nullable(),
  enumValues: z.array(z.string()).optional().nullable(),
  relationTo: z.string().optional().nullable(),
  relationType: z.string().optional().nullable(), // one-to-one, one-to-many, many-to-many, many-to-one
  validation: z.record(z.any()).optional().nullable(), // accept any validation shape
}).passthrough();

export const EntitySchema = z.object({
  name: z.string(),
  description: z.string().default(""),
  fields: z.array(FieldDefSchema).min(1),
  timestamps: z.boolean().default(true),
  softDelete: z.boolean().default(false),
  ownerScoped: z.boolean().default(false),
}).passthrough();

export const PermissionSchema = z.object({
  entity: z.string(),
  actions: z.array(z.string()), // create, read, update, delete, list, etc
  condition: z.any().optional().nullable(),
}).passthrough();

export const RoleSchema = z.object({
  name: z.string(),
  description: z.string().default(""),
  permissions: z.array(PermissionSchema).default([]),
  isDefault: z.boolean().default(false),
}).passthrough();

export const FlowStepSchema = z.object({
  action: z.string(),
  entity: z.string().optional().nullable(),
  description: z.string().default(""),
  requiresAuth: z.boolean().default(false),
  requiredRole: z.string().optional().nullable(),
}).passthrough();

export const FlowSchema = z.object({
  name: z.string(),
  description: z.string().default(""),
  trigger: z.string().default("user_action"),
  steps: z.array(FlowStepSchema).default([]),
}).passthrough();

export const DesignSchema = z.object({
  entities: z.array(EntitySchema).min(1),
  roles: z.array(RoleSchema).default([]),
  flows: z.array(FlowSchema).default([]),
  authStrategy: z.string().default("email-password"),
  authFields: z
    .array(
      z.object({
        name: z.string(),
        type: z.string().default("string"),
        required: z.boolean().default(true),
        enumValues: z.array(z.string()).optional().nullable(),
      }).passthrough()
    )
    .optional()
    .nullable(),
}).passthrough();

export type Design = z.infer<typeof DesignSchema>;
export type Entity = z.infer<typeof EntitySchema>;
export type FieldDef = z.infer<typeof FieldDefSchema>;
export type Role = z.infer<typeof RoleSchema>;
export type Flow = z.infer<typeof FlowSchema>;

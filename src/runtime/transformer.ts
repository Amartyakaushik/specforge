import { type AppConfig } from "@/schemas/app-config";

/**
 * AppForge-compatible config format.
 * Transforms SpecForge's multi-layer config into AppForge's flat runtime format.
 */
export interface AppForgeConfig {
  appName: string;
  auth: {
    enabled: boolean;
    fields: Array<{
      name: string;
      type: string;
      required: boolean;
      enum?: string[];
    }>;
    methods: string[];
  };
  entities: Record<
    string,
    {
      fields: Record<
        string,
        {
          type: string;
          required?: boolean;
          label?: string;
          default?: unknown;
          enum?: string[];
          min?: number;
          max?: number;
        }
      >;
    }
  >;
  pages: Array<{
    name: string;
    type: string;
    entity?: string;
    columns?: string[];
    actions?: string[];
    widgets?: Array<{
      type: string;
      label: string;
      entity: string;
      field?: string;
      operation?: string;
    }>;
  }>;
  notifications: {
    onCreate: string;
    onUpdate: string;
    onDelete: string;
  };
}

export function transformToAppForge(config: AppConfig): AppForgeConfig {
  // --- Build entities from DB tables ---
  const entities: AppForgeConfig["entities"] = {};

  for (const table of config.db.tables) {
    const fields: AppForgeConfig["entities"][string]["fields"] = {};

    for (const col of table.columns) {
      // Skip auto-generated columns
      if (col.name === "id" || col.name === "created_at" || col.name === "updated_at") continue;
      if (col.primaryKey) continue;

      const fieldDef: AppForgeConfig["entities"][string]["fields"][string] = {
        type: col.enumValues && col.enumValues.length > 0 ? "string" : mapDBTypeToFieldType(col.type),
        required: !col.nullable,
        label: inferLabel(col.name),
      };

      if (col.defaultValue !== undefined && col.defaultValue !== null) {
        fieldDef.default = col.defaultValue;
      }

      if (col.enumValues && col.enumValues.length > 0) {
        fieldDef.enum = col.enumValues;
      }

      fields[col.name] = fieldDef;
    }

    // Use table name as entity key (AppForge uses lowercase plural)
    entities[table.name] = { fields };
  }

  // --- Build pages from UI config ---
  const pages: AppForgeConfig["pages"] = [];

  for (const page of config.ui.pages) {
    const pageDef: AppForgeConfig["pages"][0] = {
      name: page.title || page.name,
      type: mapPageType(page.type),
    };

    if (page.entity) {
      // Find matching entity key in our entities map
      const entityKey = findEntityKey(page.entity, entities);
      if (entityKey) pageDef.entity = entityKey;
    }

    if (page.type === "table" && page.columns) {
      pageDef.columns = page.columns.map((c) => c.field);
    }

    if (page.actions) {
      pageDef.actions = page.actions.map((a) => mapAction(a.action));
    } else {
      pageDef.actions = ["create", "edit", "delete"];
    }

    if (page.type === "dashboard" && page.widgets) {
      pageDef.widgets = page.widgets.map((w) => ({
        type: w.type || "stat",
        label: w.label,
        entity: findEntityKey(w.entity, entities) || w.entity,
        ...(w.field ? { field: w.field } : {}),
        operation: w.operation || "count",
      }));
    }

    pages.push(pageDef);
  }

  // --- Build auth config ---
  const auth: AppForgeConfig["auth"] = {
    enabled: config.auth.enabled,
    fields: config.auth.fields.map((f) => ({
      name: f.name,
      type: f.type || "string",
      required: f.required ?? true,
      ...(f.enumValues && f.enumValues.length > 0 ? { enum: f.enumValues } : {}),
    })),
    methods: ["email"],
  };

  return {
    appName: config.ui.appName,
    auth,
    entities,
    pages,
    notifications: {
      onCreate: "{{entity}} created successfully",
      onUpdate: "{{entity}} updated",
      onDelete: "{{entity}} deleted",
    },
  };
}

function mapDBTypeToFieldType(dbType: string): string {
  const map: Record<string, string> = {
    string: "string",
    integer: "number",
    float: "number",
    boolean: "boolean",
    text: "text",
    datetime: "date",
    date: "date",
    timestamp: "date",
    json: "string",
    enum: "string",
    uuid: "string",
  };
  return map[dbType] || "string";
}

function mapPageType(type: string): string {
  if (["table", "form", "dashboard"].includes(type)) return type;
  return "table";
}

function mapAction(action: string): string {
  const map: Record<string, string> = {
    create: "create",
    edit: "edit",
    update: "edit",
    delete: "delete",
    export: "export",
    import: "import",
    get: "edit",
    view: "edit",
  };
  return map[action] || action;
}

function inferLabel(fieldName: string): string {
  return fieldName
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function findEntityKey(
  entity: string,
  entities: Record<string, unknown>
): string | null {
  if (entities[entity]) return entity;

  // Try lowercase
  const lower = entity.toLowerCase();
  if (entities[lower]) return lower;

  // Try snake_case plural
  const snake = entity.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
  const plural = snake.endsWith("s") ? snake : snake + "s";
  if (entities[plural]) return plural;

  // Try lowercase + s
  if (entities[lower + "s"]) return lower + "s";

  // Fuzzy: find first match that starts with entity name
  for (const key of Object.keys(entities)) {
    if (key.toLowerCase().startsWith(lower)) return key;
  }

  return null;
}

import { type AppConfig } from "@/schemas/app-config";
import { type ValidationIssue } from "@/schemas/pipeline";

type Validator = (config: AppConfig) => ValidationIssue[];

// --- Individual validators ---

const validateUIAPIConsistency: Validator = (config) => {
  const issues: ValidationIssue[] = [];
  const apiEntities = new Set(config.api.endpoints.map((e) => e.entity).filter(Boolean));

  for (const page of config.ui.pages) {
    if (page.entity && !apiEntities.has(page.entity)) {
      issues.push({
        severity: "error",
        layer: "cross-layer",
        message: `UI page "${page.name}" references entity "${page.entity}" but no API endpoints exist for it`,
        path: `ui.pages[${page.name}].entity`,
        suggestion: `Add CRUD endpoints for "${page.entity}" to api.endpoints`,
      });
    }

    if (page.type === "table" && page.columns && page.entity) {
      const table = config.db.tables.find(
        (t) => t.name === toSnakePlural(page.entity!) || t.name === page.entity!.toLowerCase() + "s"
      );
      if (table) {
        for (const col of page.columns) {
          const dbCol = table.columns.find(
            (c) => c.name === col.field || c.name === toSnakeCase(col.field)
          );
          if (!dbCol && col.field !== "id" && col.field !== "createdAt" && col.field !== "updatedAt") {
            issues.push({
              severity: "warning",
              layer: "cross-layer",
              message: `UI column "${col.field}" on page "${page.name}" may not match any DB column in table "${table.name}"`,
              path: `ui.pages[${page.name}].columns[${col.field}]`,
            });
          }
        }
      }
    }
  }

  return issues;
};

const validateAPIDBConsistency: Validator = (config) => {
  const issues: ValidationIssue[] = [];
  const tableNames = new Set(config.db.tables.map((t) => t.name));

  for (const endpoint of config.api.endpoints) {
    const entity = endpoint.entity;
    if (!entity) continue; // skip endpoints without entity (auth, health, etc)

    const expectedTable = toSnakePlural(entity);
    const altTable = entity.toLowerCase() + "s";
    if (!tableNames.has(expectedTable) && !tableNames.has(altTable) && !tableNames.has(entity.toLowerCase())) {
      issues.push({
        severity: "error",
        layer: "cross-layer",
        message: `API endpoint "${endpoint.method} ${endpoint.path}" references entity "${entity}" but no matching DB table found`,
        path: `api.endpoints[${endpoint.path}].entity`,
        suggestion: `Add DB table "${expectedTable}" or fix entity reference`,
      });
    }
  }

  return issues;
};

const validateDBSchema: Validator = (config) => {
  const issues: ValidationIssue[] = [];
  const tableNames = new Set(config.db.tables.map((t) => t.name));

  for (const table of config.db.tables) {
    const hasPK = table.columns.some((c) => c.primaryKey);
    if (!hasPK) {
      issues.push({
        severity: "error",
        layer: "db",
        message: `Table "${table.name}" has no primary key column`,
        path: `db.tables[${table.name}]`,
        suggestion: `Add an "id" column with primaryKey: true`,
      });
    }

    for (const col of table.columns) {
      if (col.references && !tableNames.has(col.references.table)) {
        issues.push({
          severity: "error",
          layer: "db",
          message: `Column "${table.name}.${col.name}" references non-existent table "${col.references.table}"`,
          path: `db.tables[${table.name}].columns[${col.name}].references`,
          suggestion: `Create table "${col.references.table}" or remove the reference`,
        });
      }
    }

    for (const col of table.columns) {
      if (col.type === "enum" && (!col.enumValues || col.enumValues.length === 0)) {
        issues.push({
          severity: "error",
          layer: "db",
          message: `Enum column "${table.name}.${col.name}" has no enumValues defined`,
          path: `db.tables[${table.name}].columns[${col.name}]`,
          suggestion: `Add enumValues array`,
        });
      }
    }
  }

  return issues;
};

const validateAuthConsistency: Validator = (config) => {
  const issues: ValidationIssue[] = [];

  if (!config.auth.enabled) return issues;

  const roleNames = new Set(config.auth.roles.map((r) => r.name));

  for (const rule of config.auth.rules) {
    if (!roleNames.has(rule.role)) {
      issues.push({
        severity: "error",
        layer: "auth",
        message: `Auth rule references non-existent role "${rule.role}"`,
        path: `auth.rules[${rule.role}]`,
        suggestion: `Add role "${rule.role}" to auth.roles or fix rule`,
      });
    }
  }

  for (const page of config.ui.pages) {
    if (page.requiredRole && !roleNames.has(page.requiredRole)) {
      issues.push({
        severity: "error",
        layer: "auth",
        message: `Page "${page.name}" requires non-existent role "${page.requiredRole}"`,
        path: `ui.pages[${page.name}].requiredRole`,
        suggestion: `Add role "${page.requiredRole}" to auth.roles`,
      });
    }
  }

  for (const endpoint of config.api.endpoints) {
    if (endpoint.requiredRole && !roleNames.has(endpoint.requiredRole)) {
      issues.push({
        severity: "error",
        layer: "auth",
        message: `Endpoint "${endpoint.method} ${endpoint.path}" requires non-existent role "${endpoint.requiredRole}"`,
        path: `api.endpoints[${endpoint.path}].requiredRole`,
      });
    }
  }

  const hasDefault = config.auth.roles.some((r) => r.isDefault);
  if (!hasDefault && config.auth.roles.length > 0) {
    issues.push({
      severity: "warning",
      layer: "auth",
      message: "No default role defined - new users won't have a role assigned",
      suggestion: "Set isDefault: true on one role",
    });
  }

  const fieldNames = config.auth.fields.map((f) => f.name.toLowerCase());
  if (!fieldNames.includes("email")) {
    issues.push({
      severity: "error",
      layer: "auth",
      message: "Auth fields missing 'email' field",
      suggestion: "Add email field to auth.fields",
    });
  }
  if (!fieldNames.includes("password")) {
    issues.push({
      severity: "error",
      layer: "auth",
      message: "Auth fields missing 'password' field",
      suggestion: "Add password field to auth.fields",
    });
  }

  return issues;
};

const validateUICompleteness: Validator = (config) => {
  const issues: ValidationIssue[] = [];

  for (const page of config.ui.pages) {
    if (page.type === "table" && (!page.columns || page.columns.length === 0)) {
      issues.push({
        severity: "error",
        layer: "ui",
        message: `Table page "${page.name}" has no columns defined`,
        path: `ui.pages[${page.name}].columns`,
        suggestion: "Add column definitions based on the entity fields",
      });
    }

    if (page.type === "form" && (!page.fields || page.fields.length === 0)) {
      issues.push({
        severity: "error",
        layer: "ui",
        message: `Form page "${page.name}" has no fields defined`,
        path: `ui.pages[${page.name}].fields`,
        suggestion: "Add field definitions based on the entity fields",
      });
    }

    if (page.type === "dashboard" && (!page.widgets || page.widgets.length === 0)) {
      issues.push({
        severity: "error",
        layer: "ui",
        message: `Dashboard page "${page.name}" has no widgets defined`,
        path: `ui.pages[${page.name}].widgets`,
        suggestion: "Add stat/chart widgets",
      });
    }

    if (page.widgets) {
      const entityNames = config.db.tables.map((t) => t.name);
      for (const widget of page.widgets) {
        const match = entityNames.some(
          (t) =>
            t === toSnakePlural(widget.entity) ||
            t === widget.entity.toLowerCase() + "s" ||
            t === widget.entity.toLowerCase()
        );
        if (!match) {
          issues.push({
            severity: "warning",
            layer: "ui",
            message: `Widget "${widget.label}" references entity "${widget.entity}" which may not match any DB table`,
            path: `ui.pages[${page.name}].widgets[${widget.label}]`,
          });
        }
      }
    }
  }

  const navPages = config.ui.pages.filter((p) => p.showInNav);
  if (navPages.length === 0) {
    issues.push({
      severity: "warning",
      layer: "ui",
      message: "No pages have showInNav=true - navigation will be empty",
    });
  }

  return issues;
};

const validateAPICompleteness: Validator = (config) => {
  const issues: ValidationIssue[] = [];

  const byEntity = new Map<string, string[]>();
  for (const ep of config.api.endpoints) {
    if (!ep.entity) continue;
    const actions = byEntity.get(ep.entity) ?? [];
    actions.push(ep.action);
    byEntity.set(ep.entity, actions);
  }

  for (const [entity, actions] of byEntity) {
    if (!actions.includes("list")) {
      issues.push({
        severity: "warning",
        layer: "api",
        message: `Entity "${entity}" has no list endpoint`,
        suggestion: `Add GET endpoint for listing ${entity}`,
      });
    }
    if (!actions.includes("create")) {
      issues.push({
        severity: "warning",
        layer: "api",
        message: `Entity "${entity}" has no create endpoint`,
        suggestion: `Add POST endpoint for creating ${entity}`,
      });
    }
  }

  return issues;
};

const validateBusinessRules: Validator = (config) => {
  const issues: ValidationIssue[] = [];
  if (!config.businessRules) return issues;

  const entityNames = config.db.tables.map((t) => t.name);

  for (const rule of config.businessRules) {
    const match = entityNames.some(
      (t) =>
        t === toSnakePlural(rule.entity) ||
        t === rule.entity.toLowerCase() + "s" ||
        t === rule.entity.toLowerCase()
    );
    if (!match) {
      issues.push({
        severity: "warning",
        layer: "business-logic",
        message: `Business rule "${rule.name}" references entity "${rule.entity}" which may not match any DB table`,
        path: `businessRules[${rule.name}]`,
      });
    }
  }

  return issues;
};

// --- Helpers ---

function toSnakeCase(s: string): string {
  return s.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
}

function toSnakePlural(s: string): string {
  const snake = toSnakeCase(s);
  if (snake.endsWith("s")) return snake;
  if (snake.endsWith("y")) return snake.slice(0, -1) + "ies";
  return snake + "s";
}

// --- Validation Engine ---

const ALL_VALIDATORS: Validator[] = [
  validateUIAPIConsistency,
  validateAPIDBConsistency,
  validateDBSchema,
  validateAuthConsistency,
  validateUICompleteness,
  validateAPICompleteness,
  validateBusinessRules,
];

export function validateConfig(config: AppConfig): ValidationIssue[] {
  const allIssues: ValidationIssue[] = [];

  for (const validator of ALL_VALIDATORS) {
    try {
      const issues = validator(config);
      allIssues.push(...issues);
    } catch (err) {
      allIssues.push({
        severity: "error",
        layer: "cross-layer",
        message: `Validator threw: ${(err as Error).message}`,
      });
    }
  }

  return allIssues;
}

export function hasBlockingErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}

export function issueSummary(issues: ValidationIssue[]): { errors: number; warnings: number; info: number } {
  return {
    errors: issues.filter((i) => i.severity === "error").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
    info: issues.filter((i) => i.severity === "info").length,
  };
}

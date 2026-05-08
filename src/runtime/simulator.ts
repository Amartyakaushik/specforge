import { type AppConfig } from "@/schemas/app-config";

export interface SimulationResult {
  success: boolean;
  routes: SimulatedRoute[];
  pages: SimulatedPage[];
  dbOperations: SimulatedDBOp[];
  authFlows: SimulatedAuthFlow[];
  errors: string[];
}

interface SimulatedRoute {
  method: string;
  path: string;
  entity: string;
  status: "ok" | "error";
  error?: string;
}

interface SimulatedPage {
  name: string;
  path: string;
  type: string;
  renderable: boolean;
  componentCount: number;
  error?: string;
}

interface SimulatedDBOp {
  table: string;
  operation: string;
  status: "ok" | "error";
  error?: string;
}

interface SimulatedAuthFlow {
  flow: string;
  steps: string[];
  status: "ok" | "error";
  error?: string;
}

export function simulateExecution(config: AppConfig): SimulationResult {
  const errors: string[] = [];
  const routes: SimulatedRoute[] = [];
  const pages: SimulatedPage[] = [];
  const dbOperations: SimulatedDBOp[] = [];
  const authFlows: SimulatedAuthFlow[] = [];

  const dbTableMap = new Map(config.db.tables.map((t) => [t.name, t]));

  // Simulate API routes
  for (const endpoint of config.api.endpoints) {
    const entity = endpoint.entity;
    if (!entity) {
      // Auth/health endpoints without entity are fine
      routes.push({
        method: endpoint.method,
        path: endpoint.path,
        entity: "none",
        status: "ok",
      });
      continue;
    }

    const tableName = findTable(entity, dbTableMap);
    if (!tableName) {
      routes.push({
        method: endpoint.method,
        path: endpoint.path,
        entity,
        status: "error",
        error: `No DB table for entity ${entity}`,
      });
      errors.push(`Route ${endpoint.method} ${endpoint.path}: missing DB table`);
      continue;
    }

    routes.push({
      method: endpoint.method,
      path: endpoint.path,
      entity,
      status: "ok",
    });

    const opMap: Record<string, string> = {
      list: "list",
      get: "read",
      create: "create",
      update: "update",
      delete: "delete",
      stats: "read",
      custom: "read",
    };
    const op = opMap[endpoint.action] ?? "read";
    dbOperations.push({ table: tableName, operation: op, status: "ok" });
  }

  // Simulate page rendering
  for (const page of config.ui.pages) {
    let renderable = true;
    let componentCount = 0;
    let error: string | undefined;

    switch (page.type) {
      case "table":
        componentCount = (page.columns?.length ?? 0) + (page.actions?.length ?? 0);
        if (!page.columns || page.columns.length === 0) {
          renderable = false;
          error = "Table page has no columns";
        }
        break;
      case "form":
        componentCount = page.fields?.length ?? 0;
        if (!page.fields || page.fields.length === 0) {
          renderable = false;
          error = "Form page has no fields";
        }
        break;
      case "dashboard":
        componentCount = page.widgets?.length ?? 0;
        if (!page.widgets || page.widgets.length === 0) {
          renderable = false;
          error = "Dashboard page has no widgets";
        }
        break;
      default:
        componentCount = 1;
    }

    if (!renderable && error) errors.push(`Page ${page.name}: ${error}`);

    pages.push({ name: page.name, path: page.path, type: page.type, renderable, componentCount, error });
  }

  // Simulate auth flows
  if (config.auth.enabled) {
    const regFields = config.auth.fields.map((f) => f.name);
    const hasEmail = regFields.some((f) => f.toLowerCase() === "email");
    const hasPassword = regFields.some((f) => f.toLowerCase() === "password");

    authFlows.push({
      flow: "registration",
      steps: ["collect_fields", "validate_input", "create_user", "assign_default_role", "return_token"],
      status: hasEmail && hasPassword ? "ok" : "error",
      error: !hasEmail || !hasPassword ? "Missing email or password field" : undefined,
    });

    authFlows.push({
      flow: "login",
      steps: ["collect_credentials", "verify_password", "generate_token", "return_user"],
      status: hasEmail && hasPassword ? "ok" : "error",
    });

    const protectedPages = config.ui.pages.filter((p) => p.requiredRole);
    if (protectedPages.length > 0) {
      const roleNames = new Set(config.auth.roles.map((r) => r.name));
      const allRolesExist = protectedPages.every((p) => roleNames.has(p.requiredRole!));
      authFlows.push({
        flow: "role_authorization",
        steps: ["extract_token", "decode_user", "check_role", "allow_or_deny"],
        status: allRolesExist ? "ok" : "error",
        error: !allRolesExist ? "Some pages reference non-existent roles" : undefined,
      });
    }

    if (authFlows.some((f) => f.status === "error")) {
      errors.push("Auth flow simulation detected issues");
    }
  }

  return { success: errors.length === 0, routes, pages, dbOperations, authFlows, errors };
}

function findTable(entity: string, tableMap: Map<string, unknown>): string | null {
  if (tableMap.has(entity)) return entity;

  const snake = entity.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
  const plural = snake.endsWith("s") ? snake : snake.endsWith("y") ? snake.slice(0, -1) + "ies" : snake + "s";
  if (tableMap.has(plural)) return plural;

  const lower = entity.toLowerCase() + "s";
  if (tableMap.has(lower)) return lower;

  if (tableMap.has(entity.toLowerCase())) return entity.toLowerCase();

  return null;
}

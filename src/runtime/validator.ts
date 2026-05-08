import { type AppConfig } from "@/schemas/app-config";

export interface RuntimeValidationResult {
  executable: boolean;
  score: number;
  checks: RuntimeCheck[];
}

export interface RuntimeCheck {
  name: string;
  passed: boolean;
  details: string;
}

export function validateRuntimeExecutability(config: AppConfig): RuntimeValidationResult {
  const checks: RuntimeCheck[] = [];

  // 1. Can render navigation
  checks.push({
    name: "navigation_renderable",
    passed: config.ui.pages.filter((p) => p.showInNav).length > 0,
    details: `${config.ui.pages.filter((p) => p.showInNav).length} navigable pages`,
  });

  // 2. Every table page has columns
  const tablePages = config.ui.pages.filter((p) => p.type === "table");
  const tablesWithCols = tablePages.filter((p) => p.columns && p.columns.length > 0);
  checks.push({
    name: "tables_have_columns",
    passed: tablePages.length === 0 || tablesWithCols.length === tablePages.length,
    details: `${tablesWithCols.length}/${tablePages.length} table pages have columns`,
  });

  // 3. Every form page has fields
  const formPages = config.ui.pages.filter((p) => p.type === "form");
  const formsWithFields = formPages.filter((p) => p.fields && p.fields.length > 0);
  checks.push({
    name: "forms_have_fields",
    passed: formPages.length === 0 || formsWithFields.length === formPages.length,
    details: `${formsWithFields.length}/${formPages.length} form pages have fields`,
  });

  // 4. Every dashboard has widgets
  const dashPages = config.ui.pages.filter((p) => p.type === "dashboard");
  const dashWithWidgets = dashPages.filter((p) => p.widgets && p.widgets.length > 0);
  checks.push({
    name: "dashboards_have_widgets",
    passed: dashPages.length === 0 || dashWithWidgets.length === dashPages.length,
    details: `${dashWithWidgets.length}/${dashPages.length} dashboards have widgets`,
  });

  // 5. CRUD coverage
  const uiEntities = new Set(
    config.ui.pages.filter((p) => p.entity).map((p) => p.entity!)
  );
  const endpointMap = new Map<string, Set<string>>();
  for (const ep of config.api.endpoints) {
    if (!ep.entity) continue;
    if (!endpointMap.has(ep.entity)) endpointMap.set(ep.entity, new Set());
    endpointMap.get(ep.entity)!.add(ep.action);
  }

  let crudComplete = 0;
  for (const entity of uiEntities) {
    const actions = endpointMap.get(entity);
    if (actions && actions.has("list") && actions.has("create")) {
      crudComplete++;
    }
  }
  checks.push({
    name: "crud_coverage",
    passed: uiEntities.size === 0 || crudComplete === uiEntities.size,
    details: `${crudComplete}/${uiEntities.size} UI entities have list+create endpoints`,
  });

  // 6. DB tables for all API entities
  const dbTableNames = new Set(config.db.tables.map((t) => t.name.toLowerCase()));
  const apiEntities = new Set(
    config.api.endpoints.map((e) => e.entity).filter((e): e is string => !!e)
  );
  let dbMatch = 0;
  for (const entity of apiEntities) {
    const snake = toSnakePlural(entity).toLowerCase();
    if (
      dbTableNames.has(snake) ||
      dbTableNames.has(entity.toLowerCase() + "s") ||
      dbTableNames.has(entity.toLowerCase())
    ) {
      dbMatch++;
    }
  }
  checks.push({
    name: "db_backing",
    passed: apiEntities.size === 0 || dbMatch === apiEntities.size,
    details: `${dbMatch}/${apiEntities.size} API entities have DB tables`,
  });

  // 7. Auth consistency
  if (config.auth.enabled) {
    const hasRoles = config.auth.roles.length > 0;
    const hasRules = config.auth.rules.length > 0;
    const hasFields = config.auth.fields.length >= 2;
    checks.push({
      name: "auth_complete",
      passed: hasRoles && hasRules && hasFields,
      details: `roles: ${config.auth.roles.length}, rules: ${config.auth.rules.length}, fields: ${config.auth.fields.length}`,
    });
  }

  // 8. Unique page paths
  const paths = config.ui.pages.map((p) => p.path);
  const uniquePaths = new Set(paths);
  checks.push({
    name: "unique_paths",
    passed: paths.length === uniquePaths.size,
    details: `${uniquePaths.size} unique paths out of ${paths.length}`,
  });

  // 9. Every DB table has at least id + 1 field
  const minFieldTables = config.db.tables.filter((t) => t.columns.length >= 2);
  checks.push({
    name: "tables_have_fields",
    passed: minFieldTables.length === config.db.tables.length,
    details: `${minFieldTables.length}/${config.db.tables.length} tables have 2+ columns`,
  });

  // 10. No orphan endpoints
  checks.push({
    name: "no_orphan_endpoints",
    passed: dbMatch === apiEntities.size,
    details: `All API endpoints backed by DB tables`,
  });

  const passed = checks.filter((c) => c.passed).length;
  const score = Math.round((passed / checks.length) * 100);

  return {
    executable: checks.filter((c) => !c.passed).length === 0,
    score,
    checks,
  };
}

function toSnakePlural(s: string): string {
  const snake = s.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
  if (snake.endsWith("s")) return snake;
  if (snake.endsWith("y")) return snake.slice(0, -1) + "ies";
  return snake + "s";
}

"use client";

import { useState } from "react";

interface Props {
  result: {
    intent: unknown;
    design: unknown;
    appConfig: unknown;
    appForgeConfig?: unknown;
    validationIssues: Array<{ severity: string; layer: string; message: string; path?: string; suggestion?: string }>;
    repairActions: Array<{ action: string; description: string; applied: boolean; layer: string }>;
    error: string | null;
  };
}

type Tab = "runtime" | "config" | "intent" | "design" | "validation" | "repairs";

export function OutputViewer({ result }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("runtime");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "runtime", label: "Runtime Config" },
    { id: "config", label: "Raw Config" },
    { id: "intent", label: "Intent" },
    { id: "design", label: "Design" },
    {
      id: "validation",
      label: "Validation",
      badge: result.validationIssues.length,
    },
    {
      id: "repairs",
      label: "Repairs",
      badge: result.repairActions.length,
    },
  ];

  const toggleSection = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const copyJSON = (data: unknown, label: string) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const renderJSON = (data: unknown, label: string) => {
    const isOpen = !collapsed[label];
    return (
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50">
          <button
            onClick={() => toggleSection(label)}
            className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            <span>{label}</span>
            <span className="text-slate-400">{isOpen ? "▾" : "▸"}</span>
          </button>
          <button
            onClick={() => copyJSON(data, label)}
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
              copied === label
                ? "bg-green-100 text-green-700"
                : "bg-slate-200 text-slate-600 hover:bg-slate-300"
            }`}
          >
            {copied === label ? "Copied!" : "Copy"}
          </button>
        </div>
        {isOpen && (
          <pre className="p-4 text-xs font-mono overflow-x-auto bg-slate-950 text-green-400 max-h-[500px] overflow-y-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      {/* Tab bar */}
      <div className="border-b border-slate-200 px-4">
        <nav className="flex gap-1 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                  tab.id === "validation"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-blue-100 text-blue-700"
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="p-4">
        {result.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {result.error}
          </div>
        )}

        {activeTab === "runtime" && result.appForgeConfig ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                This is the executable config ready for AppForge runtime. Copy and paste it directly.
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(result.appForgeConfig, null, 2));
                  alert("Copied to clipboard!");
                }}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Copy JSON
              </button>
            </div>
            {renderJSON(result.appForgeConfig, "AppForge Runtime Config")}
          </div>
        ) : activeTab === "runtime" ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            No runtime config generated
          </div>
        ) : null}

        {activeTab === "config" && result.appConfig ? (
          <div className="space-y-3">
            {renderJSON((result.appConfig as Record<string, unknown>).ui, "UI Configuration")}
            {renderJSON((result.appConfig as Record<string, unknown>).api, "API Configuration")}
            {renderJSON((result.appConfig as Record<string, unknown>).db, "Database Schema")}
            {renderJSON((result.appConfig as Record<string, unknown>).auth, "Auth Configuration")}
            {(result.appConfig as Record<string, unknown>).businessRules
              ? renderJSON((result.appConfig as Record<string, unknown>).businessRules, "Business Rules")
              : null}
          </div>
        ) : null}

        {activeTab === "intent" && result.intent ? renderJSON(result.intent, "Extracted Intent") : null}

        {activeTab === "design" && result.design ? renderJSON(result.design, "System Design") : null}

        {activeTab === "validation" && (
          <div className="space-y-2">
            {result.validationIssues.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                No validation issues detected
              </div>
            ) : (
              result.validationIssues.map((issue, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border text-sm ${
                    issue.severity === "error"
                      ? "bg-red-50 border-red-200 text-red-800"
                      : issue.severity === "warning"
                        ? "bg-amber-50 border-amber-200 text-amber-800"
                        : "bg-blue-50 border-blue-200 text-blue-800"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-white/50 uppercase">
                      {issue.layer}
                    </span>
                    <span>{issue.message}</span>
                  </div>
                  {issue.path && (
                    <div className="mt-1 text-xs opacity-75 font-mono">
                      Path: {issue.path}
                    </div>
                  )}
                  {issue.suggestion && (
                    <div className="mt-1 text-xs opacity-75">
                      Fix: {issue.suggestion}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "repairs" && (
          <div className="space-y-2">
            {result.repairActions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                No repairs were needed
              </div>
            ) : (
              result.repairActions.map((action, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border text-sm ${
                    action.applied
                      ? "bg-green-50 border-green-200 text-green-800"
                      : "bg-red-50 border-red-200 text-red-800"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                      action.applied ? "bg-green-200" : "bg-red-200"
                    }`}>
                      {action.applied ? "APPLIED" : "FAILED"}
                    </span>
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-white/50 uppercase">
                      {action.layer}
                    </span>
                    <span className="text-xs font-mono opacity-75">{action.action}</span>
                  </div>
                  <p className="mt-1">{action.description}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

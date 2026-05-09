"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Code,
  FileSearch,
  Layers,
  ShieldCheck,
  Wrench,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  result: {
    intent: unknown;
    design: unknown;
    appConfig: unknown;
    appForgeConfig?: unknown;
    validationIssues: Array<{
      severity: string;
      layer: string;
      message: string;
      path?: string;
      suggestion?: string;
    }>;
    repairActions: Array<{
      action: string;
      description: string;
      applied: boolean;
      layer: string;
    }>;
    error: string | null;
  };
}

function syntaxHighlight(json: string): React.ReactNode[] {
  const lines = json.split("\n");
  return lines.map((line, lineIndex) => {
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let keyIndex = 0;

    while (remaining.length > 0) {
      // Match key (quoted string followed by colon)
      const keyMatch = remaining.match(/^(\s*)"([^"]*)"(\s*:)/);
      if (keyMatch) {
        parts.push(<span key={`ws-${lineIndex}-${keyIndex}`}>{keyMatch[1]}</span>);
        parts.push(
          <span key={`k-${lineIndex}-${keyIndex}`} className="text-blue-400">
            &quot;{keyMatch[2]}&quot;
          </span>
        );
        parts.push(<span key={`c-${lineIndex}-${keyIndex}`}>{keyMatch[3]}</span>);
        remaining = remaining.slice(keyMatch[0].length);
        keyIndex++;
        continue;
      }

      // Match string value
      const stringMatch = remaining.match(/^(\s*)"([^"]*)"(,?\s*)/);
      if (stringMatch) {
        parts.push(<span key={`ws-${lineIndex}-${keyIndex}`}>{stringMatch[1]}</span>);
        parts.push(
          <span key={`s-${lineIndex}-${keyIndex}`} className="text-green-400">
            &quot;{stringMatch[2]}&quot;
          </span>
        );
        parts.push(<span key={`t-${lineIndex}-${keyIndex}`}>{stringMatch[3]}</span>);
        remaining = remaining.slice(stringMatch[0].length);
        keyIndex++;
        continue;
      }

      // Match number
      const numberMatch = remaining.match(/^(\s*)(-?\d+\.?\d*)(,?\s*)/);
      if (numberMatch) {
        parts.push(<span key={`ws-${lineIndex}-${keyIndex}`}>{numberMatch[1]}</span>);
        parts.push(
          <span key={`n-${lineIndex}-${keyIndex}`} className="text-amber-400">
            {numberMatch[2]}
          </span>
        );
        parts.push(<span key={`t-${lineIndex}-${keyIndex}`}>{numberMatch[3]}</span>);
        remaining = remaining.slice(numberMatch[0].length);
        keyIndex++;
        continue;
      }

      // Match boolean/null
      const boolMatch = remaining.match(/^(\s*)(true|false|null)(,?\s*)/);
      if (boolMatch) {
        parts.push(<span key={`ws-${lineIndex}-${keyIndex}`}>{boolMatch[1]}</span>);
        parts.push(
          <span key={`b-${lineIndex}-${keyIndex}`} className="text-purple-400">
            {boolMatch[2]}
          </span>
        );
        parts.push(<span key={`t-${lineIndex}-${keyIndex}`}>{boolMatch[3]}</span>);
        remaining = remaining.slice(boolMatch[0].length);
        keyIndex++;
        continue;
      }

      // No match -- push rest as plain text and break
      parts.push(
        <span key={`r-${lineIndex}-${keyIndex}`} className="text-slate-300">
          {remaining}
        </span>
      );
      break;
    }

    return (
      <span key={`line-${lineIndex}`}>
        {parts}
        {lineIndex < lines.length - 1 ? "\n" : ""}
      </span>
    );
  });
}

function CopyButton({
  data,
  size = "sm",
}: {
  data: unknown;
  size?: "sm" | "icon";
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [data]);

  if (size === "icon") {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={handleCopy}
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-500" />
        ) : (
          <Copy className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant={copied ? "secondary" : "outline"}
      size="sm"
      onClick={handleCopy}
      className={cn(
        "gap-1.5 transition-colors",
        copied && "bg-emerald-50 text-emerald-700 border-emerald-200"
      )}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          Copy
        </>
      )}
    </Button>
  );
}

function CollapsibleJSON({
  data,
  label,
  defaultOpen = false,
}: {
  data: unknown;
  label: string;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (data === undefined || data === null) return null;

  const jsonString = JSON.stringify(data, null, 2);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-4 pb-0">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex items-center gap-2 text-sm font-semibold hover:text-foreground/80 transition-colors"
          >
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
            {label}
          </button>
          <CopyButton data={data} size="icon" />
        </div>
      </CardHeader>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <CardContent className="p-4 pt-3">
              <pre className="rounded-lg bg-slate-950 p-4 text-xs font-mono overflow-x-auto max-h-[500px] overflow-y-auto leading-relaxed">
                {syntaxHighlight(jsonString)}
              </pre>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

const severityConfig = {
  error: {
    border: "border-l-red-500",
    icon: AlertTriangle,
    iconColor: "text-red-500",
    badgeVariant: "destructive" as const,
  },
  warning: {
    border: "border-l-amber-500",
    icon: AlertCircle,
    iconColor: "text-amber-500",
    badgeVariant: "warning" as const,
  },
  info: {
    border: "border-l-blue-500",
    icon: Info,
    iconColor: "text-blue-500",
    badgeVariant: "info" as const,
  },
} as const;

export function OutputViewer({ result }: Props) {
  const validationCount = result.validationIssues.length;
  const repairsCount = result.repairActions.length;

  const tabItems = [
    { value: "runtime", label: "Runtime Config", icon: Play },
    { value: "config", label: "Raw Config", icon: Code },
    { value: "intent", label: "Intent", icon: FileSearch },
    { value: "design", label: "Design", icon: Layers },
    { value: "validation", label: "Validation", icon: ShieldCheck, count: validationCount },
    { value: "repairs", label: "Repairs", icon: Wrench, count: repairsCount },
  ];

  return (
    <Card className="overflow-hidden">
      <Tabs defaultValue="runtime" className="w-full">
        <div className="border-b px-2 pt-2">
          <TabsList className="h-auto w-full justify-start gap-1 bg-transparent p-0 flex-wrap">
            {tabItems.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="gap-1.5 rounded-b-none border-b-2 border-transparent px-3 py-2.5 data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <Badge
                      variant={tab.value === "validation" ? "warning" : "info"}
                      className="ml-1 h-5 min-w-[20px] justify-center px-1.5 text-[10px]"
                    >
                      {tab.count}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <div className="p-4 sm:p-6">
          {result.error && (
            <Card className="mb-4 border-red-200 bg-red-50">
              <CardContent className="flex items-start gap-3 p-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                <p className="text-sm text-red-800">{result.error}</p>
              </CardContent>
            </Card>
          )}

          {/* Runtime Config */}
          <TabsContent value="runtime">
            {result.appForgeConfig ? (
              <div className="space-y-4">
                <Card>
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <CardDescription className="text-sm">
                      Executable config ready for AppForge runtime. Copy and use it directly.
                    </CardDescription>
                    <CopyButton data={result.appForgeConfig} />
                  </CardContent>
                </Card>
                <div className="rounded-lg bg-slate-950 p-4 overflow-x-auto max-h-[600px] overflow-y-auto">
                  <pre className="text-xs font-mono leading-relaxed">
                    {syntaxHighlight(JSON.stringify(result.appForgeConfig, null, 2))}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Play className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">No runtime config generated</p>
              </div>
            )}
          </TabsContent>

          {/* Raw Config */}
          <TabsContent value="config">
            {result.appConfig ? (
              <div className="space-y-3">
                <CollapsibleJSON
                  data={(result.appConfig as Record<string, unknown>).ui}
                  label="UI Configuration"
                  defaultOpen
                />
                <CollapsibleJSON
                  data={(result.appConfig as Record<string, unknown>).api}
                  label="API Configuration"
                />
                <CollapsibleJSON
                  data={(result.appConfig as Record<string, unknown>).db}
                  label="Database Schema"
                />
                <CollapsibleJSON
                  data={(result.appConfig as Record<string, unknown>).auth}
                  label="Auth Configuration"
                />
                <CollapsibleJSON
                  data={(result.appConfig as Record<string, unknown>).businessRules}
                  label="Business Rules"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Code className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">No raw config available</p>
              </div>
            )}
          </TabsContent>

          {/* Intent */}
          <TabsContent value="intent">
            {result.intent ? (
              <CollapsibleJSON
                data={result.intent}
                label="Extracted Intent"
                defaultOpen
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <FileSearch className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">No intent data available</p>
              </div>
            )}
          </TabsContent>

          {/* Design */}
          <TabsContent value="design">
            {result.design ? (
              <CollapsibleJSON
                data={result.design}
                label="System Design"
                defaultOpen
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Layers className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">No design data available</p>
              </div>
            )}
          </TabsContent>

          {/* Validation */}
          <TabsContent value="validation">
            {validationCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <CheckCircle className="h-10 w-10 mb-3 text-emerald-400" />
                <p className="text-sm font-medium text-foreground">
                  No validation issues detected
                </p>
                <p className="text-xs mt-1">All checks passed successfully</p>
              </div>
            ) : (
              <div className="space-y-3">
                {result.validationIssues.map((issue, i) => {
                  const config =
                    severityConfig[issue.severity as keyof typeof severityConfig] ??
                    severityConfig.info;
                  const SeverityIcon = config.icon;
                  return (
                    <Card
                      key={i}
                      className={cn("border-l-4 overflow-hidden", config.border)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <SeverityIcon
                            className={cn("h-5 w-5 shrink-0 mt-0.5", config.iconColor)}
                          />
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={config.badgeVariant} className="text-[10px] uppercase">
                                {issue.layer}
                              </Badge>
                              <span className="text-sm text-foreground">
                                {issue.message}
                              </span>
                            </div>
                            {issue.path && (
                              <p className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded w-fit">
                                {issue.path}
                              </p>
                            )}
                            {issue.suggestion && (
                              <p className="text-xs italic text-muted-foreground">
                                {issue.suggestion}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Repairs */}
          <TabsContent value="repairs">
            {repairsCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Wrench className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium text-foreground">
                  No repairs were needed
                </p>
                <p className="text-xs mt-1">
                  Configuration generated without requiring fixes
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {result.repairActions.map((repair, i) => (
                  <Card
                    key={i}
                    className={cn(
                      "border-l-4 overflow-hidden",
                      repair.applied
                        ? "border-l-emerald-500"
                        : "border-l-red-500"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {repair.applied ? (
                          <CheckCircle className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant={repair.applied ? "success" : "destructive"}
                              className="text-[10px] uppercase"
                            >
                              {repair.action}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {repair.layer}
                            </Badge>
                          </div>
                          <p className="text-sm text-foreground">
                            {repair.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </Card>
  );
}

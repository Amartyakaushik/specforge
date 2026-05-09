"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Cpu,
  Hash,
  DollarSign,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Props {
  metrics: {
    totalLatencyMs: number;
    stageLatencies: Record<string, number>;
    llmCalls: number;
    tokensUsed: number;
    validationErrors: number;
    validationWarnings: number;
    repairAttempts: number;
    repairSuccesses: number;
    estimatedCostUsd: number;
  };
}

interface MetricCardDef {
  key: string;
  label: string;
  value: string;
  rawValue: number;
  icon: LucideIcon;
  borderColor: string;
  iconColor: string;
  tooltip: string;
}

function AnimatedNumber({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 600;
    const start = performance.now();
    const from = 0;
    const to = value;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }, [value]);

  const formatted =
    decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString();

  return (
    <span>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

const STAGE_COLORS: Record<string, string> = {
  intent: "bg-blue-500",
  design: "bg-violet-500",
  schema: "bg-indigo-500",
  validation: "bg-amber-500",
  repair: "bg-orange-500",
  complete: "bg-emerald-500",
};

export function MetricsPanel({ metrics }: Props) {
  const stats: MetricCardDef[] = [
    {
      key: "latency",
      label: "Total Latency",
      value: `${(metrics.totalLatencyMs / 1000).toFixed(1)}s`,
      rawValue: metrics.totalLatencyMs / 1000,
      icon: Clock,
      borderColor: "border-l-blue-500",
      iconColor: "text-blue-500",
      tooltip: `${metrics.totalLatencyMs.toLocaleString()}ms total pipeline execution time`,
    },
    {
      key: "llm",
      label: "LLM Calls",
      value: metrics.llmCalls.toString(),
      rawValue: metrics.llmCalls,
      icon: Cpu,
      borderColor: "border-l-violet-500",
      iconColor: "text-violet-500",
      tooltip: `${metrics.llmCalls} calls made to the language model`,
    },
    {
      key: "tokens",
      label: "Tokens Used",
      value: metrics.tokensUsed.toLocaleString(),
      rawValue: metrics.tokensUsed,
      icon: Hash,
      borderColor: "border-l-indigo-500",
      iconColor: "text-indigo-500",
      tooltip: `${metrics.tokensUsed.toLocaleString()} tokens consumed across all LLM calls`,
    },
    {
      key: "cost",
      label: "Est. Cost",
      value: `$${metrics.estimatedCostUsd.toFixed(4)}`,
      rawValue: metrics.estimatedCostUsd,
      icon: DollarSign,
      borderColor: "border-l-emerald-500",
      iconColor: "text-emerald-500",
      tooltip: `Estimated cost: $${metrics.estimatedCostUsd.toFixed(4)} USD`,
    },
    {
      key: "errors",
      label: "Errors",
      value: metrics.validationErrors.toString(),
      rawValue: metrics.validationErrors,
      icon: AlertTriangle,
      borderColor:
        metrics.validationErrors > 0
          ? "border-l-red-500"
          : "border-l-emerald-500",
      iconColor:
        metrics.validationErrors > 0 ? "text-red-500" : "text-emerald-500",
      tooltip: `${metrics.validationErrors} validation errors detected`,
    },
    {
      key: "warnings",
      label: "Warnings",
      value: metrics.validationWarnings.toString(),
      rawValue: metrics.validationWarnings,
      icon: AlertCircle,
      borderColor: "border-l-amber-500",
      iconColor: "text-amber-500",
      tooltip: `${metrics.validationWarnings} validation warnings detected`,
    },
    {
      key: "repairs",
      label: "Repair Attempts",
      value: metrics.repairAttempts.toString(),
      rawValue: metrics.repairAttempts,
      icon: RefreshCw,
      borderColor: "border-l-orange-500",
      iconColor: "text-orange-500",
      tooltip: `${metrics.repairAttempts} automatic repair attempts made`,
    },
    {
      key: "applied",
      label: "Repairs Applied",
      value: metrics.repairSuccesses.toString(),
      rawValue: metrics.repairSuccesses,
      icon: CheckCircle,
      borderColor: "border-l-teal-500",
      iconColor: "text-teal-500",
      tooltip: `${metrics.repairSuccesses} of ${metrics.repairAttempts} repairs successfully applied`,
    },
  ];

  const maxLatency = Math.max(
    ...Object.values(metrics.stageLatencies),
    1
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
          Pipeline Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Metric cards grid */}
        <TooltipProvider delayDuration={200}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <Tooltip key={stat.key}>
                  <TooltipTrigger asChild>
                    <motion.div
                      className={cn(
                        "rounded-lg border border-border bg-card p-3 border-l-4 cursor-default",
                        stat.borderColor
                      )}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.35,
                        delay: i * 0.05,
                        ease: "easeOut",
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={cn("w-4 h-4", stat.iconColor)} />
                      </div>
                      <div className="text-xl font-bold tracking-tight text-foreground">
                        {stat.key === "latency" ? (
                          <AnimatedNumber
                            value={stat.rawValue}
                            decimals={1}
                            suffix="s"
                          />
                        ) : stat.key === "cost" ? (
                          <AnimatedNumber
                            value={stat.rawValue}
                            decimals={4}
                            prefix="$"
                          />
                        ) : (
                          <AnimatedNumber value={stat.rawValue} />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {stat.label}
                      </div>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent side="top">{stat.tooltip}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>

        {/* Stage latencies bar chart */}
        {Object.keys(metrics.stageLatencies).length > 0 && (
          <div className="border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
              Stage Latencies
            </p>
            <div className="space-y-2">
              {Object.entries(metrics.stageLatencies).map(
                ([stage, ms], i) => {
                  const pct = (ms / maxLatency) * 100;
                  const barColor =
                    STAGE_COLORS[stage] ?? "bg-slate-400";

                  return (
                    <motion.div
                      key={stage}
                      className="flex items-center gap-3"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.3,
                        delay: i * 0.06,
                      }}
                    >
                      <span className="text-xs font-medium text-muted-foreground capitalize w-20 shrink-0 text-right">
                        {stage}
                      </span>
                      <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className={cn(
                            "h-full rounded-full",
                            barColor
                          )}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{
                            duration: 0.6,
                            delay: i * 0.06 + 0.1,
                            ease: "easeOut",
                          }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground w-14 shrink-0">
                        {(ms / 1000).toFixed(1)}s
                      </span>
                    </motion.div>
                  );
                }
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

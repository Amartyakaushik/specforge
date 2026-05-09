"use client";

import { motion } from "framer-motion";
import {
  FileSearch,
  Layers,
  Database,
  ShieldCheck,
  Wrench,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = [
  { id: "intent", label: "Intent", icon: FileSearch },
  { id: "design", label: "Design", icon: Layers },
  { id: "schema", label: "Schema", icon: Database },
  { id: "validation", label: "Validation", icon: ShieldCheck },
  { id: "repair", label: "Repair", icon: Wrench },
  { id: "complete", label: "Complete", icon: CheckCircle2 },
] as const;

type StageState = "pending" | "active" | "completed" | "failed";

interface Props {
  currentStage: string; // "idle" | "intent" | "design" | "schema" | "validation" | "repair" | "complete" | "failed"
  stageLatencies?: Record<string, number>; // stage name -> ms
}

export function PipelineStatus({ currentStage, stageLatencies }: Props) {
  const currentIndex = STAGES.findIndex((s) => s.id === currentStage);
  const isFailed = currentStage === "failed";
  const isIdle = currentStage === "idle";

  function getStageState(index: number): StageState {
    if (isIdle) return "pending";
    if (isFailed) {
      // When failed, find the last stage that was active before failure.
      // We mark stages before it as completed, the failed stage itself as failed,
      // and everything after as pending.
      // If currentIndex is -1 (failed doesn't match any stage), treat the last known stage as failed.
      const failedAt = currentIndex >= 0 ? currentIndex : STAGES.length - 1;
      if (index < failedAt) return "completed";
      if (index === failedAt) return "failed";
      return "pending";
    }
    if (index < currentIndex) return "completed";
    if (index === currentIndex) return "active";
    return "pending";
  }

  function formatLatency(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  return (
    <div className="relative flex flex-col">
      {STAGES.map((stage, i) => {
        const state = getStageState(i);
        const Icon = stage.icon;
        const isLast = i === STAGES.length - 1;
        const latency = stageLatencies?.[stage.id];

        return (
          <div key={stage.id} className="relative flex items-center gap-3 py-2">
            {/* Vertical connecting line */}
            {!isLast && (
              <div className="absolute left-[3.5px] top-[calc(50%+4px)] h-[calc(100%-4px)] w-px">
                <motion.div
                  className={cn(
                    "w-full h-full",
                    state === "completed"
                      ? "bg-emerald-500"
                      : "bg-slate-700"
                  )}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.1 }}
                  style={{ transformOrigin: "top" }}
                />
              </div>
            )}

            {/* Status dot */}
            <div className="relative z-10 flex-shrink-0">
              {state === "active" ? (
                <motion.div
                  className="w-2 h-2 rounded-full bg-blue-500"
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              ) : (
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    state === "pending" && "bg-slate-600",
                    state === "completed" && "bg-emerald-500",
                    state === "failed" && "bg-red-500"
                  )}
                />
              )}
            </div>

            {/* Icon + label */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0",
                  state === "pending" && "text-muted-foreground",
                  state === "active" && "text-blue-500",
                  state === "completed" && "text-emerald-500",
                  state === "failed" && "text-red-500"
                )}
              />
              <span
                className={cn(
                  "text-sm",
                  state === "pending" && "text-muted-foreground",
                  state === "active" && "text-blue-400",
                  state === "completed" && "text-emerald-400",
                  state === "failed" && "text-red-400"
                )}
              >
                {stage.label}
              </span>
            </div>

            {/* Right side: latency or spinner */}
            <div className="flex-shrink-0 w-12 text-right">
              {state === "active" && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 ml-auto" />
              )}
              {state === "completed" && latency != null && (
                <span className="text-xs text-muted-foreground">
                  {formatLatency(latency)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

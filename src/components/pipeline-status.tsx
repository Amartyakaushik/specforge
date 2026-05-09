"use client";

import { motion } from "framer-motion";
import {
  FileSearch,
  Layers,
  Database,
  ShieldCheck,
  Wrench,
  CheckCircle2,
  Check,
  X,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STAGES = [
  {
    id: "intent",
    label: "Intent",
    description: "Parsing natural language into structured intent",
    icon: FileSearch,
  },
  {
    id: "design",
    label: "Design",
    description: "Converting intent to app architecture",
    icon: Layers,
  },
  {
    id: "schema",
    label: "Schema",
    description: "Generating UI, API, DB, Auth configs",
    icon: Database,
  },
  {
    id: "validation",
    label: "Validation",
    description: "Cross-layer consistency checks",
    icon: ShieldCheck,
  },
  {
    id: "repair",
    label: "Repair",
    description: "Fixing detected issues",
    icon: Wrench,
  },
  {
    id: "complete",
    label: "Complete",
    description: "Generation finished",
    icon: CheckCircle2,
  },
];

interface Props {
  currentStage: string;
}

export function PipelineStatus({ currentStage }: Props) {
  const currentIndex = STAGES.findIndex((s) => s.id === currentStage);
  const isFailed = currentStage === "failed";
  const isIdle = currentStage === "idle";

  function getStageState(index: number) {
    if (isFailed && index === currentIndex) return "failed";
    if (isFailed && index < currentIndex) return "completed";
    if (isIdle) return "pending";
    if (index < currentIndex) return "completed";
    if (index === currentIndex) return "active";
    return "pending";
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Pipeline Progress
          </CardTitle>
          {!isIdle && !isFailed && currentIndex >= 0 && (
            <Badge variant="info">
              {STAGES[currentIndex]?.label ?? currentStage}
            </Badge>
          )}
          {isFailed && <Badge variant="destructive">Failed</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-start">
          {STAGES.map((stage, i) => {
            const state = getStageState(i);
            const Icon = stage.icon;
            const isLast = i === STAGES.length - 1;

            return (
              <div key={stage.id} className="flex-1 flex flex-col items-center relative">
                {/* Connecting line */}
                {!isLast && (
                  <div className="absolute top-5 left-[calc(50%+20px)] right-[calc(-50%+20px)] h-0.5">
                    <div className="w-full h-full bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className={cn(
                          "h-full rounded-full",
                          state === "completed" || getStageState(i + 1) !== "pending"
                            ? "bg-emerald-500"
                            : "bg-transparent"
                        )}
                        initial={{ width: "0%" }}
                        animate={{
                          width:
                            state === "completed" || getStageState(i + 1) !== "pending"
                              ? "100%"
                              : "0%",
                        }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                      />
                    </div>
                  </div>
                )}

                {/* Circle with icon */}
                <motion.div
                  className={cn(
                    "relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                    state === "completed" &&
                      "bg-emerald-500 border-emerald-500 text-white",
                    state === "active" &&
                      "bg-blue-500 border-blue-500 text-white",
                    state === "failed" &&
                      "bg-red-500 border-red-500 text-white",
                    state === "pending" &&
                      "bg-muted border-muted-foreground/25 text-muted-foreground"
                  )}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{
                    scale: 1,
                    opacity: 1,
                    boxShadow:
                      state === "active"
                        ? [
                            "0 0 0 0 rgba(59,130,246,0.4)",
                            "0 0 0 8px rgba(59,130,246,0)",
                            "0 0 0 0 rgba(59,130,246,0.4)",
                          ]
                        : "0 0 0 0 rgba(0,0,0,0)",
                  }}
                  transition={{
                    scale: { duration: 0.3, delay: i * 0.08 },
                    opacity: { duration: 0.3, delay: i * 0.08 },
                    boxShadow: {
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    },
                  }}
                >
                  {state === "completed" ? (
                    <Check className="w-5 h-5" strokeWidth={3} />
                  ) : state === "failed" ? (
                    <X className="w-5 h-5" strokeWidth={3} />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </motion.div>

                {/* Label */}
                <motion.span
                  className={cn(
                    "mt-2 text-xs font-medium text-center leading-tight",
                    state === "completed" && "text-emerald-700 dark:text-emerald-400",
                    state === "active" && "text-blue-700 dark:text-blue-400",
                    state === "failed" && "text-red-700 dark:text-red-400",
                    state === "pending" && "text-muted-foreground"
                  )}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.08 + 0.1 }}
                >
                  {stage.label}
                </motion.span>

                {/* Description (only for active/failed stage) */}
                {(state === "active" || state === "failed") && (
                  <motion.span
                    className={cn(
                      "mt-0.5 text-[10px] text-center max-w-[90px] leading-tight",
                      state === "failed"
                        ? "text-red-500 dark:text-red-400"
                        : "text-muted-foreground"
                    )}
                    initial={{ opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                  >
                    {state === "failed" ? "Pipeline failed" : stage.description}
                  </motion.span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

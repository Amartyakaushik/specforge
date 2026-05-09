"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Brain,
  Code,
  Shield,
  Wrench,
  Rocket,
  ChevronRight,
} from "lucide-react";
import { PromptInput } from "@/components/prompt-input";
import { PipelineStatus } from "@/components/pipeline-status";
import { OutputViewer } from "@/components/output-viewer";
import { MetricsPanel } from "@/components/metrics-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface GenerationResult {
  id: string;
  status: "completed" | "failed";
  intent: unknown;
  design: unknown;
  appConfig: unknown;
  appForgeConfig: unknown;
  validationIssues: Array<{
    severity: string;
    layer: string;
    message: string;
  }>;
  repairActions: Array<{
    action: string;
    description: string;
    applied: boolean;
    layer: string;
  }>;
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
  } | null;
  error: string | null;
}

type PipelineStage =
  | "idle"
  | "intent"
  | "design"
  | "schema"
  | "validation"
  | "repair"
  | "complete"
  | "failed";

const EXAMPLE_PROMPTS = [
  "Build a CRM with login, contacts, dashboard, role-based access, and premium plan with payments. Admins can see analytics.",
  "Create a project management tool with teams, tasks, kanban boards, and time tracking. Managers can assign tasks.",
  "Build an e-commerce store with products, categories, cart, checkout, and order tracking. Admin can manage inventory.",
  "Create a blog platform with posts, comments, categories, and user profiles. Admins can moderate content.",
  "Build a restaurant reservation system with tables, bookings, menu management, and customer reviews.",
];

const PIPELINE_STAGES = [
  { key: "intent", label: "Intent", icon: FileText },
  { key: "design", label: "Design", icon: Brain },
  { key: "schema", label: "Schema", icon: Code },
  { key: "validation", label: "Validate", icon: Shield },
  { key: "repair", label: "Repair", icon: Wrench },
  { key: "complete", label: "Deploy", icon: Rocket },
];

export default function HomePage() {
  const [currentStage, setCurrentStage] = useState<PipelineStage>("idle");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = useCallback(async (prompt: string) => {
    setIsGenerating(true);
    setResult(null);
    setCurrentStage("intent");

    try {
      const response = await fetch("/api/generate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Generation failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === "stage") {
            setCurrentStage(data.stage as PipelineStage);
          } else if (data.type === "complete") {
            setResult(data.result);
            setCurrentStage(
              data.result.status === "completed" ? "complete" : "failed"
            );
            if (data.result.status === "completed") {
              toast.success("Generation complete");
            } else {
              toast.error("Generation completed with errors");
            }
          } else if (data.type === "error") {
            throw new Error(data.error);
          }
        }
      }
    } catch (err) {
      setCurrentStage("failed");
      toast.error((err as Error).message);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const stageIndex = PIPELINE_STAGES.findIndex((s) => s.key === currentStage);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />
        <div className="relative max-w-5xl mx-auto px-4 pt-16 pb-10 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-5xl sm:text-6xl font-bold tracking-tight bg-gradient-to-r from-white via-blue-100 to-blue-300 bg-clip-text text-transparent"
          >
            SpecForge
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto"
          >
            Natural language to validated, executable application configurations
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
            className="mt-5 flex items-center justify-center gap-2"
          >
            <Badge variant="info">Multi-Stage Pipeline</Badge>
            <Badge variant="success">Schema Validated</Badge>
            <Badge variant="warning">Auto-Repair</Badge>
          </motion.div>
        </div>
      </section>

      {/* Architecture Flow */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45, ease: "easeOut" }}
        className="max-w-4xl mx-auto px-4 pb-10"
      >
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="py-6">
            <div className="flex items-center justify-center gap-1 sm:gap-2 overflow-x-auto">
              {PIPELINE_STAGES.map((stage, i) => {
                const Icon = stage.icon;
                const isActive = stage.key === currentStage;
                const isPast = stageIndex > i;

                return (
                  <div key={stage.key} className="flex items-center gap-1 sm:gap-2">
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={cn(
                          "flex items-center justify-center w-10 h-10 rounded-lg border transition-all duration-300",
                          isActive
                            ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/25"
                            : isPast
                              ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-400"
                              : "bg-slate-800 border-slate-700 text-slate-500"
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span
                        className={cn(
                          "text-[11px] font-medium tracking-wide",
                          isActive
                            ? "text-blue-400"
                            : isPast
                              ? "text-emerald-400"
                              : "text-slate-600"
                        )}
                      >
                        {stage.label}
                      </span>
                    </div>
                    {i < PIPELINE_STAGES.length - 1 && (
                      <ChevronRight
                        className={cn(
                          "w-4 h-4 mb-5 flex-shrink-0",
                          isPast ? "text-emerald-500/60" : "text-slate-700"
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.section>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 pb-16 space-y-6">
        {/* Prompt Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55, ease: "easeOut" }}
        >
          <PromptInput
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            examples={EXAMPLE_PROMPTS}
          />
        </motion.div>

        {/* Pipeline Status */}
        <AnimatePresence>
          {currentStage !== "idle" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
            >
              <PipelineStatus currentStage={currentStage} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="space-y-6"
            >
              {result.metrics && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                >
                  <MetricsPanel metrics={result.metrics} />
                </motion.div>
              )}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <OutputViewer result={result} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

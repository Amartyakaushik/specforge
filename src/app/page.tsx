"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Brain,
  Code,
  Shield,
  Wrench,
  Rocket,
  Zap,
  ExternalLink,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { PromptInput } from "@/components/prompt-input";
import { PipelineStatus } from "@/components/pipeline-status";
import { OutputViewer } from "@/components/output-viewer";
import { MetricsPanel } from "@/components/metrics-panel";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
  { key: "intent", label: "Intent Parsing", icon: FileText },
  { key: "design", label: "Architecture Design", icon: Brain },
  { key: "schema", label: "Schema Generation", icon: Code },
  { key: "validation", label: "Cross-layer Validation", icon: Shield },
  { key: "repair", label: "Auto-Repair", icon: Wrench },
  { key: "complete", label: "Finalize", icon: Rocket },
];

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export default function HomePage() {
  const [currentStage, setCurrentStage] = useState<PipelineStage>("idle");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stageTimings, setStageTimings] = useState<Record<string, number>>({});
  const stageStartRef = useRef<number>(0);
  const workspaceRef = useRef<HTMLElement>(null);

  const handleGenerate = useCallback(async (prompt: string) => {
    setIsGenerating(true);
    setResult(null);
    setCurrentStage("intent");
    setStageTimings({});
    stageStartRef.current = Date.now();

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
            const now = Date.now();
            setCurrentStage((prev) => {
              if (prev !== "idle" && prev !== "failed") {
                const elapsed = now - stageStartRef.current;
                setStageTimings((t) => ({ ...t, [prev]: elapsed }));
              }
              return data.stage as PipelineStage;
            });
            stageStartRef.current = now;
          } else if (data.type === "complete") {
            const now = Date.now();
            setCurrentStage((prev) => {
              if (prev !== "idle" && prev !== "failed") {
                const elapsed = now - stageStartRef.current;
                setStageTimings((t) => ({ ...t, [prev]: elapsed }));
              }
              return data.result.status === "completed" ? "complete" : "failed";
            });
            setResult(data.result);
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
    <main className="min-h-screen bg-[#09090b] text-white antialiased">
      {/* Dot grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Subtle top glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none bg-blue-500/[0.04] blur-[120px] rounded-full" />

      {/* ---- Navigation ---- */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-[#09090b]/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-[15px] tracking-tight text-white">
              SpecForge
            </span>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={() =>
                workspaceRef.current?.scrollIntoView({ behavior: "smooth" })
              }
              className="text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block"
            >
              How it works
            </button>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              GitHub
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </nav>

      {/* ---- Hero Section ---- */}
      <section className="relative pt-32 pb-20 px-6">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.h1
            variants={fadeUp}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]"
          >
            <span className="bg-gradient-to-b from-white to-blue-400 bg-clip-text text-transparent">
              Compile Applications
            </span>
            <br />
            <span className="bg-gradient-to-b from-white to-blue-400 bg-clip-text text-transparent">
              from Natural Language
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-6 text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed"
          >
            Multi-stage AI pipeline with schema validation, cross-layer
            consistency checks, and auto-repair. Not a prompt wrapper — a
            compiler.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-8 flex items-center justify-center gap-3 flex-wrap"
          >
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-sm text-zinc-300">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              6-Stage Pipeline
            </div>
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-sm text-zinc-300">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              7 Validators
            </div>
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-sm text-zinc-300">
              <Wrench className="w-3.5 h-3.5 text-blue-400" />
              Auto-Repair Engine
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ---- Workspace Section ---- */}
      <section
        ref={workspaceRef}
        className="relative max-w-6xl mx-auto px-4 sm:px-6 pb-8"
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
        >
          <Card className="border-white/[0.08] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
            <div className="flex flex-col lg:flex-row">
              {/* Left: Prompt Input (60%) */}
              <div className="flex-1 lg:w-[60%] p-5 sm:p-6 border-b lg:border-b-0 lg:border-r border-white/[0.06]">
                <PromptInput
                  onGenerate={handleGenerate}
                  isGenerating={isGenerating}
                  examples={EXAMPLE_PROMPTS}
                />
              </div>

              {/* Right: Pipeline Visualization (40%) */}
              <div className="lg:w-[40%] p-5 sm:p-6">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">
                  Pipeline
                </p>
                <div className="space-y-1">
                  {PIPELINE_STAGES.map((stage, i) => {
                    const Icon = stage.icon;
                    const isActive = stage.key === currentStage;
                    const isPast = stageIndex > i;
                    const isFailed =
                      currentStage === "failed" &&
                      i === stageIndex;
                    const timing = stageTimings[stage.key];

                    return (
                      <div
                        key={stage.key}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300",
                          isActive && "bg-blue-500/[0.08]",
                          isFailed && "bg-red-500/[0.08]"
                        )}
                      >
                        {/* Status dot */}
                        <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
                          <div
                            className={cn(
                              "w-2 h-2 rounded-full transition-colors duration-300",
                              isActive && "bg-blue-400",
                              isPast && "bg-emerald-400",
                              isFailed && "bg-red-400",
                              !isActive && !isPast && !isFailed && "bg-zinc-700"
                            )}
                          />
                          {isActive && !isFailed && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-4 h-4 rounded-full bg-blue-400/20 animate-ping" />
                            </div>
                          )}
                        </div>

                        {/* Icon */}
                        <Icon
                          className={cn(
                            "w-4 h-4 shrink-0 transition-colors duration-300",
                            isActive && "text-blue-400",
                            isPast && "text-emerald-400",
                            isFailed && "text-red-400",
                            !isActive && !isPast && !isFailed && "text-zinc-600"
                          )}
                        />

                        {/* Label */}
                        <span
                          className={cn(
                            "text-sm font-medium flex-1 transition-colors duration-300",
                            isActive && "text-blue-300",
                            isPast && "text-zinc-300",
                            isFailed && "text-red-300",
                            !isActive && !isPast && !isFailed && "text-zinc-600"
                          )}
                        >
                          {stage.label}
                        </span>

                        {/* Timing */}
                        {isPast && timing !== undefined && (
                          <span className="text-xs tabular-nums text-zinc-500">
                            {(timing / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </section>

      {/* ---- Pipeline Status (existing component) ---- */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <AnimatePresence>
          {currentStage !== "idle" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="mb-6"
            >
              <PipelineStatus currentStage={currentStage} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ---- Results Section ---- */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
        <AnimatePresence>
          {result && (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6"
            >
              {result.metrics && (
                <motion.div variants={fadeUp}>
                  <MetricsPanel metrics={result.metrics} />
                </motion.div>
              )}
              <motion.div variants={fadeUp}>
                <OutputViewer result={result} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ---- Footer ---- */}
      <footer className="border-t border-white/[0.06] py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
          <span>Built as a systems engineering exercise</span>
          <span>Powered by Gemini API</span>
        </div>
      </footer>
    </main>
  );
}

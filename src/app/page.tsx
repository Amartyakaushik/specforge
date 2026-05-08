"use client";

import { useState, useCallback } from "react";
import { PromptInput } from "@/components/prompt-input";
import { PipelineStatus } from "@/components/pipeline-status";
import { OutputViewer } from "@/components/output-viewer";
import { MetricsPanel } from "@/components/metrics-panel";
import { toast } from "sonner";

interface GenerationResult {
  id: string;
  status: "completed" | "failed";
  intent: unknown;
  design: unknown;
  appConfig: unknown;
  appForgeConfig: unknown;
  validationIssues: Array<{ severity: string; layer: string; message: string }>;
  repairActions: Array<{ action: string; description: string; applied: boolean; layer: string }>;
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

type PipelineStage = "idle" | "intent" | "design" | "schema" | "validation" | "repair" | "complete" | "failed";

const EXAMPLE_PROMPTS = [
  "Build a CRM with login, contacts, dashboard, role-based access, and premium plan with payments. Admins can see analytics.",
  "Create a project management tool with teams, tasks, kanban boards, and time tracking. Managers can assign tasks.",
  "Build an e-commerce store with products, categories, cart, checkout, and order tracking. Admin can manage inventory.",
  "Create a blog platform with posts, comments, categories, and user profiles. Admins can moderate content.",
  "Build a restaurant reservation system with tables, bookings, menu management, and customer reviews.",
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
            setCurrentStage(data.result.status === "completed" ? "complete" : "failed");
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
            SpecForge
          </h1>
          <p className="mt-2 text-lg text-slate-600">
            Natural language to validated, executable application configurations
          </p>
          <div className="mt-1 flex items-center justify-center gap-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              Multi-Stage Pipeline
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              Schema Validated
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
              Auto-Repair
            </span>
          </div>
        </div>

        {/* Prompt Input */}
        <PromptInput
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          examples={EXAMPLE_PROMPTS}
        />

        {/* Pipeline Status */}
        {currentStage !== "idle" && (
          <div className="mt-6">
            <PipelineStatus currentStage={currentStage} />
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="mt-6 space-y-6">
            {result.metrics && <MetricsPanel metrics={result.metrics} />}
            <OutputViewer result={result} />
          </div>
        )}
      </div>
    </main>
  );
}

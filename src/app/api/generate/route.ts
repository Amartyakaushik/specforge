import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/pipeline/orchestrator";
import { transformToAppForge } from "@/runtime/transformer";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    if (prompt.length > 5000) {
      return NextResponse.json({ error: "Prompt too long (max 5000 chars)" }, { status: 400 });
    }

    const result = await runPipeline(prompt.trim());

    const appForgeConfig = result.state.appConfig
      ? transformToAppForge(result.state.appConfig)
      : null;

    return NextResponse.json({
      id: result.state.id,
      status: result.state.status,
      intent: result.state.intent,
      design: result.state.design,
      appConfig: result.state.appConfig,
      appForgeConfig,
      validationIssues: result.state.validationIssues,
      repairActions: result.state.repairActions,
      metrics: result.state.metrics,
      error: result.state.error,
    });
  } catch (err) {
    console.error("Generation failed:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}

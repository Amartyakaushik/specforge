import { NextRequest } from "next/server";
import { runPipeline } from "@/pipeline/orchestrator";
import { transformToAppForge } from "@/runtime/transformer";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { prompt } = body;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return new Response(JSON.stringify({ error: "Prompt is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const result = await runPipeline(prompt.trim(), (stage, partialState) => {
          send({
            type: "stage",
            stage,
            timestamp: Date.now(),
            ...(partialState.intent ? { hasIntent: true } : {}),
            ...(partialState.design ? { hasDesign: true } : {}),
            ...(partialState.appConfig ? { hasConfig: true } : {}),
          });
        });

        const appForgeConfig = result.state.appConfig
          ? transformToAppForge(result.state.appConfig)
          : null;

        send({
          type: "complete",
          result: {
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
          },
        });
      } catch (err) {
        send({
          type: "error",
          error: (err as Error).message,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { runEvaluation } from "@/eval/runner";
import { REALISTIC_PROMPTS, EDGE_CASE_PROMPTS, ALL_PROMPTS } from "@/eval/datasets";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const dataset = body.dataset ?? "all";

    let prompts;
    switch (dataset) {
      case "realistic":
        prompts = REALISTIC_PROMPTS;
        break;
      case "edge-case":
        prompts = EDGE_CASE_PROMPTS;
        break;
      default:
        prompts = ALL_PROMPTS;
    }

    const { results, summary } = await runEvaluation(prompts);

    return NextResponse.json({ results, summary });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export interface LLMCallResult {
  content: string;
  tokensUsed: number;
  latencyMs: number;
}

const MAX_RETRIES = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GeminiContent {
  parts: Array<{ text: string }>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
  error?: { message?: string; code?: number };
}

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    responseFormat?: "json";
  } = {}
): Promise<LLMCallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const model = options.model ?? "gemini-2.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const start = Date.now();

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}` }],
      },
    ],
    generationConfig: {
      temperature: options.temperature ?? 0.1,
      maxOutputTokens: options.maxTokens ?? 16384,
      ...(options.responseFormat === "json" ? { responseMimeType: "application/json" } : {}),
    },
  };

  let lastError: string = "";

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = 10000 * attempt; // 10s, 20s, 30s, 40s
      console.log(`[LLM] Retry ${attempt + 1}/${MAX_RETRIES}, waiting ${backoff / 1000}s...`);
      await sleep(backoff);
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.status === 429) {
        console.log(`[LLM] Rate limited (429), will retry...`);
        lastError = "Rate limited by Gemini API";
        continue;
      }

      if (response.status >= 500) {
        console.log(`[LLM] Server error (${response.status}), will retry...`);
        lastError = `Server error ${response.status}`;
        continue;
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => "no body");
        throw new Error(`Gemini API error ${response.status}: ${errText}`);
      }

      const data: GeminiResponse = await response.json();

      if (data.error) {
        throw new Error(`Gemini error: ${data.error.message}`);
      }

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const tokensUsed =
        (data.usageMetadata?.promptTokenCount ?? 0) +
        (data.usageMetadata?.candidatesTokenCount ?? 0);
      const latencyMs = Date.now() - start;

      return { content, tokensUsed, latencyMs };
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      if (msg.includes("429") || msg.includes("rate") || msg.includes("quota")) {
        console.log(`[LLM] Rate limit detected in error, will retry...`);
        lastError = msg;
        continue;
      }
      throw err;
    }
  }

  throw new Error(`LLM call failed after ${MAX_RETRIES} retries: ${lastError}`);
}

// Delay between pipeline stages to respect Gemini free tier rate limits
export async function rateLimitDelay(): Promise<void> {
  await sleep(6000);
}

export function safeParseJSON(raw: string): { success: true; data: unknown } | { success: false; error: string } {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  try {
    return { success: true, data: JSON.parse(cleaned) };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export function estimateCost(model: string, tokens: number): number {
  const rates: Record<string, number> = {
    "gemini-2.5-flash-lite": 0.0001 / 1000,
    "gemini-1.5-pro": 0.00125 / 1000,
  };
  return (rates[model] ?? rates["gemini-2.5-flash-lite"]) * tokens;
}

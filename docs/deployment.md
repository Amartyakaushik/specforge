# Deployment

## Architecture

```
┌─────────────────────────┐     ┌──────────────────┐
│  Vercel                 │     │  Supabase        │
│                         │     │                  │
│  Next.js App            │────▶│  PostgreSQL      │
│  ├── Frontend (SSR/CSR) │     │  ├── eval_runs   │
│  ├── /api/generate      │     │  ├── eval_results │
│  ├── /api/generate/stream│    │  └── generations  │
│  └── /api/eval          │     │                  │
└─────────────────────────┘     └──────────────────┘
         │
         ▼
┌─────────────────────────┐
│  OpenAI API             │
│  gpt-4o-mini            │
└─────────────────────────┘
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for gpt-4o-mini | `sk-...` |
| `DATABASE_URL` | Supabase PostgreSQL connection string | `postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres` |

Set via Vercel dashboard under Project Settings > Environment Variables. Apply to Production, Preview, and Development environments.

## Build

```bash
npm run build   # runs next build
```

Build output is optimized by Next.js automatically. API routes are deployed as serverless functions.

## Vercel Configuration

```json
// vercel.json
{
  "functions": {
    "app/api/generate/route.ts": {
      "maxDuration": 120
    },
    "app/api/generate/stream/route.ts": {
      "maxDuration": 120
    },
    "app/api/eval/route.ts": {
      "maxDuration": 300
    }
  }
}
```

- Generation routes: 120s max — covers full pipeline including up to 3 repair cycles
- Eval route: 300s max — runs 20 prompts sequentially with delays between OpenAI calls
- Default routes: 10s (Vercel default) — sufficient for frontend and simple queries

**Note:** `maxDuration` above 60s requires Vercel Pro plan.

## Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Push schema to Supabase
npx prisma db push

# Verify connection
npx prisma db pull
```

### Schema

Prisma manages three tables:
- `generations` — stores generated configs with metadata (prompt, score, latency, tokens)
- `eval_runs` — evaluation suite runs with aggregate metrics
- `eval_results` — individual prompt results within an eval run

## CORS & Security

- **CORS:** Not required — API routes are same-origin (served from the same Vercel deployment)
- **API Key Protection:** `OPENAI_API_KEY` is server-side only; never exposed to client bundles
- **Input Sanitization:** All request bodies validated with Zod before processing
- **Rate Limiting:** Implemented at application level:
  - `/api/generate`: 10 requests/minute per IP
  - `/api/eval`: 1 request/minute per IP
- **No Authentication Required:** SpecForge is a public tool; no user accounts

## Monitoring

### Structured Logging

All pipeline stages emit structured logs:

```typescript
{
  level: 'info' | 'warn' | 'error',
  stage: string,
  duration_ms: number,
  tokens_used?: number,
  error?: string,
  prompt_hash: string  // SHA-256 of input, not the input itself
}
```

Logs are available in Vercel's function logs dashboard. Filter by `stage` to isolate pipeline bottlenecks.

### Error Tracking

- Unhandled errors return structured JSON: `{ error: string, code: string, stage?: string }`
- Pipeline failures include the last successful stage and partial results
- OpenAI API errors are caught and mapped to specific error codes (`OPENAI_RATE_LIMIT`, `OPENAI_TIMEOUT`, `OPENAI_INVALID_RESPONSE`)

## Cost Management

### OpenAI Costs

Using `gpt-4o-mini` for all stages:
- Input: $0.15 / 1M tokens
- Output: $0.60 / 1M tokens

**Per generation estimate:**
- Analysis: ~500 input + ~300 output tokens
- Generation: ~800 input + ~2000 output tokens
- Repair (if needed): ~2500 input + ~2000 output tokens

**Total per generation:** ~$0.001 - $0.005 depending on repair cycles

**Eval suite (20 prompts):** ~$0.02 - $0.10 per full run

### Cost Controls
- Token usage tracked per request and logged
- Max token limits set per OpenAI call (`max_tokens: 4096`)
- Repair cycle caps prevent runaway token consumption
- No fine-tuning or embedding costs — pure chat completion usage

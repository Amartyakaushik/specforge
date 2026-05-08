# SpecForge

A compiler-like system for software generation. Converts natural language descriptions into validated, executable application configurations through a multi-stage pipeline.

## Architecture

```
Natural Language Prompt
        │
        ▼
┌─────────────────┐
│ Intent Extraction│  → Structured intent (features, roles, auth, payments)
└────────┬────────┘
         ▼
┌─────────────────┐
│  System Design   │  → Entities, roles, flows, auth strategy
└────────┬────────┘
         ▼
┌─────────────────┐
│ Schema Generation│  → UI config, API config, DB schema, Auth rules
└────────┬────────┘
         ▼
┌─────────────────┐
│   Validation     │  → Cross-layer consistency checks (7 validators)
└────────┬────────┘
         ▼
┌─────────────────┐
│  Repair Engine   │  → Deterministic fixes + targeted LLM refinement
└────────┬────────┘
         ▼
┌─────────────────┐
│ Runtime Validate │  → Executability score + simulation
└────────┬────────┘
         ▼
   Executable Config
```

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Pipeline**: OpenAI API (gpt-4o-mini), Zod schema validation
- **Database**: PostgreSQL + Prisma
- **Deployment**: Vercel + Supabase

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your OPENAI_API_KEY and DATABASE_URL

# Generate Prisma client
npx prisma generate

# Push DB schema
npx prisma db push

# Run development server
npm run dev
```

## Project Structure

```
src/
├── schemas/          # Zod schemas & IR types (intent, design, app-config)
├── pipeline/         # Multi-stage generation (intent → design → schema → refine)
├── validators/       # Cross-layer validation engine (7 validators)
├── repair/           # Deterministic + LLM repair engine
├── runtime/          # Runtime executability validation + simulation
├── eval/             # Evaluation framework (20 prompts, metrics)
├── app/
│   ├── api/
│   │   ├── generate/ # Generation endpoint (POST + SSE streaming)
│   │   └── eval/     # Evaluation endpoint
│   └── page.tsx      # Main UI
└── components/       # React components (prompt, pipeline, output, metrics)
docs/                 # Design documents
prisma/               # Database schema
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Multi-stage pipeline | Modular, debuggable, each stage validated independently |
| Zod at every boundary | Type-safe IR, runtime validation, clear contracts |
| Deterministic repairs first | Free, instant, reliable before invoking LLM |
| gpt-4o-mini | Best cost/quality ratio for structured generation |
| Runtime simulation | Validates executability without spinning up servers |
| SSE streaming | Real-time pipeline progress feedback |

## Evaluation

Run the evaluation framework against 20 test prompts:

```bash
# Via API
curl -X POST http://localhost:3000/api/eval -H "Content-Type: application/json" -d '{"dataset":"realistic"}'

# Via CLI
npm run eval
```

Tracks: success rate, latency, tokens, cost, validation errors, repair attempts, runtime score.

## API

### POST /api/generate
Generate application config from natural language.

```json
{ "prompt": "Build a CRM with contacts and dashboard" }
```

### POST /api/generate/stream
Same as above but returns SSE stream with stage-by-stage updates.

### POST /api/eval
Run evaluation framework.

```json
{ "dataset": "realistic" | "edge-case" | "all" }
```

# SpecForge Loom Video Script

**Target Duration:** 8-9 minutes

---

## Section 1: Introduction (1:00)

> "SpecForge is an application compiler. You give it a natural language description of an app, and it outputs a complete, validated application configuration -- database schema, API endpoints, UI pages, auth rules, business logic. All structurally valid, cross-referenced, and runtime-tested."
>
> "Think of it like a compiler, but instead of source code in, machine code out -- it's English in, executable app spec out. And just like a real compiler, it has distinct stages: parsing, analysis, code generation, optimization, and validation."
>
> "The key constraint I designed around: LLMs are unreliable. They hallucinate fields, forget constraints, produce inconsistent cross-references. So the entire architecture is built to detect and repair those failures automatically."

---

## Section 2: Architecture Walkthrough (2:00)

> "The pipeline has six stages. Let me walk through each one."
>
> **[Show architecture diagram or code structure]**
>
> "**Stage 1 -- Intent Extraction.** The raw prompt is parsed into structured intent: app type, entities, features, constraints. This normalizes vague language into a typed contract. Everything downstream works off this intent, not the raw string."
>
> "**Stage 2 -- System Design.** From the intent, the LLM generates a high-level system design: which entities need CRUD, what pages are needed, what auth model applies. This is the blueprint."
>
> "**Stage 3 -- Schema Generation.** This is the heavy stage. From intent + design, we generate the full AppConfig: UI pages with columns and fields, API endpoints with methods and paths, DB tables with typed columns and foreign keys, auth roles and rules. All validated against Zod schemas."
>
> "**Stage 4 -- Validation.** Seven validators run against the config. Cross-layer checks like: does every UI page entity have matching API endpoints? Does every API entity have a backing DB table? Are auth roles referenced in page guards actually defined? This catches the inconsistencies LLMs always produce."
>
> "**Stage 5 -- Repair.** If validation finds blocking errors, the repair engine kicks in. It applies deterministic fixes first -- missing primary keys, missing auth fields -- these are instant and free. Remaining errors go back to the LLM for targeted refinement. Max 3 attempts, then we report what we couldn't fix."
>
> "**Stage 6 -- Runtime Simulation.** Even after validation, we simulate execution: walk every API route, render every page, run every DB operation, trace every auth flow. A score from 0-100 tells you how executable the config actually is."
>
> "Why multi-stage instead of one big prompt? Three reasons: each stage has a focused Zod schema so failures are caught early. Repair can target specific layers instead of regenerating everything. And the token budget per call stays small, which keeps gpt-4o-mini accurate."

---

## Section 3: Live Demo (2:00)

> "Let me show this running. I'll enter a CRM application prompt."
>
> **[Type prompt: "Build a CRM with contacts, companies, deals pipeline, activity tracking, and role-based access for sales reps and managers"]**
>
> **[Click generate]**
>
> "Watch the pipeline stages light up in real-time -- this is SSE streaming, each stage sends an event as it completes."
>
> **[Point to stage indicators as they progress]**
>
> "Intent extracted -- it identified 4 entities, 6 features, role-based auth. Design generated -- 8 pages, CRUD for each entity, dashboard. Now schema generation -- this is the longest stage, it's producing the full config."
>
> "Validation running... and it passed with 0 errors, 2 warnings. The warnings are non-blocking -- suggestions for improvement, not structural failures."
>
> **[Switch to output tabs]**
>
> "Here's the output. **UI tab** -- pages for contacts list, contact form, companies, deals pipeline, activities, and a dashboard with stat widgets. **API tab** -- full CRUD endpoints for each entity with proper HTTP methods. **DB tab** -- tables with typed columns, foreign keys between contacts and companies, enum columns for deal stages. **Auth tab** -- sales_rep and manager roles, permission rules per entity."
>
> **[Show metrics panel]**
>
> "Metrics panel: total latency, tokens used per stage, estimated cost, validation results, runtime score."

---

## Section 4: Validation + Repair Deep Dive (1:30)

> "Let me show the validation and repair system with a prompt that triggers issues."
>
> **[Enter a prompt that would produce inconsistencies, or show a pre-recorded example]**
>
> "Here we can see the validator caught 3 errors: a UI page references an entity with no API endpoints, a DB table is missing a primary key, and an auth rule references a role that doesn't exist."
>
> "The repair engine handles these in two tiers. First, deterministic fixes -- the missing primary key gets an 'id' column added automatically. No LLM call needed, instant, reliable."
>
> "The remaining two errors -- the missing endpoint and the invalid role reference -- go to the LLM for refinement. It receives the current config plus the specific error messages and regenerates the affected sections."
>
> "After one repair cycle, re-validation passes. The repair actions are logged so you can see exactly what was fixed and how."
>
> "This two-tier approach matters: deterministic fixes handle the predictable failures (about 40% of errors), and the LLM handles the structural ones that require understanding context. It's cheaper and more reliable than sending everything back to the model."

---

## Section 5: Tradeoffs (1:30)

> "Three key tradeoffs I want to call out."
>
> "**Cost vs. Quality.** I chose gpt-4o-mini over gpt-4o. It's 30x cheaper per token. The accuracy difference is real -- gpt-4o produces fewer validation errors out of the gate -- but the repair engine closes the gap. With repair, gpt-4o-mini achieves comparable success rates at a fraction of the cost. A typical generation costs $0.002 vs $0.06 with gpt-4o."
>
> "**Latency vs. Thoroughness.** The multi-stage pipeline adds latency -- 3 sequential LLM calls minimum. A single-prompt approach would be faster but produces far more errors. The pipeline takes 8-15 seconds but produces structurally valid output. SSE streaming mitigates the perceived latency by showing progress in real-time."
>
> "**Repair Budget.** I cap repair at 3 attempts. More attempts have diminishing returns -- if the model couldn't fix it in 3 tries, a 4th won't help. The budget prevents runaway costs on adversarial or genuinely ambiguous prompts. Failed repairs still return the partial config with clear error reporting."

---

## Section 6: Evaluation Framework (1:00)

> "The eval framework tests the pipeline against 20 prompts: 10 realistic applications like e-commerce, CRM, project management, and 10 edge cases -- vague prompts, conflicting requirements, single-entity apps, adversarial inputs."
>
> **[Show eval results or metrics dashboard]**
>
> "For each prompt, we track: pipeline success/failure, latency, token usage, cost, validation errors before and after repair, repair attempts, runtime executability score, and simulation pass/fail."
>
> "Results are aggregated by category and difficulty. The metrics dashboard shows success rates, average costs, and identifies which prompt categories are hardest for the pipeline."
>
> "This isn't a one-off test -- it's a regression suite. Any change to prompts, schemas, or validators can be validated against the full dataset."

---

## Section 7: Closing (0:30)

> "If I had more time, three things I'd add: a caching layer to skip re-generation for similar prompts, multi-provider LLM support for resilience, and persisting intermediate pipeline states so repair can resume after crashes."
>
> "SpecForge demonstrates that LLM-powered generation can be made reliable through engineering -- strict schemas, multi-stage validation, and intelligent repair. Thanks for watching."

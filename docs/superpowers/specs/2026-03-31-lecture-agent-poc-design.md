# Lecture Agent PoC — Design Spec

**Date:** 2026-03-31
**Status:** Approved
**Stakeholders:** Pablo, Benito (EDT&Partners)
**Budget:** 15-20 hours (Phase 1)

## Purpose

Stand up a working PoC that demonstrates Paperclip orchestrating Hermes agents with education-specific skills, backed by HAST's Temporal durable workflow layer for human-in-the-loop approval flows. The end result is a single `docker compose up` that launches the full stack.

Repository: `fierro-ltd/lecture-agent` (private).

## Architecture

6 Docker Compose services:

| Service | Tech | Port | Role |
|---------|------|------|------|
| PostgreSQL | postgres:17-alpine | 5432 | Shared data store (HAST tables + Paperclip Drizzle migrations) |
| Temporal Server | temporalio/auto-setup:1.24 | 7233 | Durable workflow orchestration |
| Temporal UI | temporalio/ui:2.31.2 | 8233 | Workflow visibility dashboard |
| Hermes Gateway | Python, hermes-agent | 8642 | OpenAI-compatible LLM API (OpenCode Go GLM-5 text, OpenRouter Gemini 3.1 Flash Lite vision) |
| HAST API + Worker | Python, FastAPI + Temporal | 8000 | Human-in-the-loop review workflows |
| Paperclip | Node.js | 3100 | Orchestration, org chart, governance, UI |

### LLM Configuration

- **Text model:** OpenCode Go GLM-5 (provider: `opencode-go`, base_url: `https://opencode.ai/zen/go/v1`)
- **Vision model:** OpenRouter `google/gemini-3.1-flash-lite-preview`
- API keys sourced from existing HAST infra/shared/.env

### Data Flow: Assessment Review

1. Professor creates task in Paperclip: "Review CS101 midterm submission #42"
2. Paperclip assigns to Assessment Quality Agent
3. On heartbeat, Hermes agent wakes and picks up the task
4. Agent uses `assessment-review` skill to evaluate the submission
5. Skill calls HAST API: `POST /api/submissions` with structured evaluation
6. HAST starts a Temporal ReviewWorkflow
7. Workflow marks submission as "review" and waits for human signal (up to 7 days)
8. Professor reviews via HAST API and approves/rejects
9. Temporal workflow completes, records decision in PostgreSQL
10. Agent reports task completion back to Paperclip

## Education Domain: University AI Operations Center

4 agents in an org chart:

### AI Operations Director (CEO)
- Strategic coordination, decomposes institutional goals into projects
- Delegates to specialized agents
- Heartbeat: every 4 hours

### Assessment Quality Agent
- Evaluates student submissions against rubrics
- Produces structured feedback (scores, strengths, weaknesses)
- Routes evaluations to HAST for professor review
- Skill: `assessment-review`
- Heartbeat: every 2 hours

### Curriculum Compliance Agent
- Reviews syllabi against accreditation standards (ANECA, SACSCOC, QAA)
- Produces compliance reports with gap analysis
- Skill: `curriculum-compliance`
- Heartbeat: weekly (Monday 8am)

### Knowledge Curator Agent
- Maintains institutional knowledge graph (KAG pattern)
- Curates relationships: courses, standards, policies, faculty
- Skill: `knowledge-augmentation` (interface contract; full KAG deferred to production)
- Heartbeat: daily 6am

## Hermes Skills (4)

### assessment-review
Evaluates submissions against rubrics. Produces JSON evaluation with criterion_scores, strengths, weaknesses, improvement_suggestions. Submits to HAST API via `POST /api/submissions`. Integration with Temporal ReviewWorkflow for durable human-in-the-loop review.

### curriculum-compliance
Maps learning objectives to accreditation framework criteria. Identifies gaps. Produces compliance report with coverage_score and recommendations. Supports ANECA (Spain/EU), SACSCOC (US), QAA (UK).

### enrollment-evaluation
Screens student applications against admission criteria. Verifies document completeness and prerequisites. Produces structured recommendation (admit/conditional/waitlist/deny). Always routes to human review via HAST.

### knowledge-augmentation
KAG (Knowledge Augmentation) pattern — placeholder implementation establishing the interface contract. Maintains conceptual knowledge graph: Course → Prerequisite → LearningObjective → CompetencyStandard. Full implementation deferred to production Lecture platform.

## HAST Review Service

Streamlined extraction from the existing HAST grading workflow pattern.

### API Endpoints
- `POST /api/submissions` — Create submission + start Temporal ReviewWorkflow
- `GET /api/submissions` — List submissions (optional status filter)
- `GET /api/submissions/{id}` — Get submission by ID
- `POST /api/submissions/{id}/review` — Submit human review decision (signals Temporal workflow)
- `GET /health` — Health check

### ReviewWorkflow (Temporal)
1. If no AI evaluation provided, run `evaluate_submission` activity (calls Hermes gateway)
2. Update status to "review" via `update_submission_status` activity
3. Wait for human signal (`review_decision`) up to 7 days
4. On signal: record decision via `record_review_decision` activity
5. On timeout: mark as "expired"

### Database Schema
Single table `hast_submissions` with: id, submission_type, entity_id, status, content, criteria, ai_evaluation (JSONB), review_decision, reviewer_notes, adjusted_score, paperclip_run_id, context (JSONB), workflow_id, timestamps.

## Paperclip Integration

### Adapter Registration
The `hermes_local` adapter from `@nousresearch/paperclip-adapter-hermes` must be registered in Paperclip's adapter registry. Two paths:

1. **Clean path (try first):** Plugin system or config-based registration
2. **Fallback:** Patch `server/src/adapters/registry.ts` to import and register the adapter

### Company Template
JSON config defining the 4-agent org chart with `adapterType: "hermes_local"` and per-agent config (model, timeout, enabled toolsets, session persistence). May need manual creation via Paperclip UI for the PoC, then export.

### Dockerfile
Requires iteration — `npx paperclipai onboard` is interactive. Will need to either pre-build `.paperclip/` config or configure non-interactively via env vars.

## UI Styling (Nice-to-Have)

If any UI customization is possible (Paperclip theming, custom review pages), follow:
- EDT brand guidelines (edtpartners.com)
- Existing Lecture platform visual language: dark navy/indigo sidebar, green accent, clean white content area, card-based metrics, status badges (green/red/yellow), Trust & Compliance indicators

## Known Risks

1. **Paperclip adapter registration** — Most uncertain piece. May require source patching.
2. **Temporal shared database** — May need separate `temporal` database alongside `lecture_agent`.
3. **Hermes gateway vs CLI** — Paperclip adapter spawns `hermes chat -q` (CLI), HAST calls the gateway HTTP API. Both interfaces needed.
4. **Company template import** — Format still evolving in Paperclip. May need manual UI setup.

## Validation Criteria

- [ ] `docker compose up --build` starts all 6 services without errors
- [ ] Paperclip UI loads at localhost:3100 with 4-agent org chart
- [ ] Assessment Quality Agent can be triggered (heartbeat or manual)
- [ ] Agent uses assessment-review skill, calls HAST API
- [ ] Temporal UI shows running ReviewWorkflow at localhost:8233
- [ ] Human review via API completes the workflow
- [ ] Budget tracking shows token costs per agent
- [ ] All agents independently triggerable

## Time Estimates

| Workstream | Hours |
|-----------|-------|
| Repo setup + Docker Compose | 2 |
| Hermes skills (4 skills) | 3 |
| HAST service (API + workflow + worker) | 4 |
| Paperclip setup + adapter registration | 3 |
| Company template + agent config | 2 |
| Integration testing + debugging | 3 |
| Documentation + demo script | 1 |
| **Total** | **18** |

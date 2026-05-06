# Lecture Agentic AI — Claude Code Instructions

## What This Project Is
A reference implementation of an **agentic AI capability layer**, built around a
fictional product called **"Lecture"**. The repo demonstrates how to wire a
managed agent harness (currently Hermes), an orchestration UI (currently
Paperclip), a durable human-in-the-loop layer (HAST + Temporal), and a thin
demo UI into a single `docker compose up`.

"Lecture" is a fictional product name used throughout the repo. The repo is
public and intended as a learning / demo asset; nothing here is tied to a
specific organisation or customer.

## Architecture
- Demo UI (HTML/JS) = landing page + pipeline visualisation + reviewer queue
- Paperclip (Node.js/React) = orchestration, org chart, governance, agent UI
- Hermes Agent (Python) = managed agent harness — memory, tools, skills
- hermes-paperclip-adapter (TypeScript, builtin in Paperclip) = bridge
- HAST API + Worker (Python/FastAPI/Temporal) = durable workflows, HITL
- PostgreSQL = shared instance, three databases (paperclip, temporal, lecture_agent)
- Temporal Server = workflow state machine

## Pinned Upstream Versions (do not change without testing)
- `hermes-agent` → `v2026.4.30` (last stable tag before May provider refactor)
- `paperclip` → `v2026.403.0` (the v2026.416.0 release dropped the direct
  `instructions` columns and added a separate `paperclipai onboard` bootstrap
  step that breaks our company-template seed flow)

Both are pinned in `hermes/Dockerfile` and `paperclip/Dockerfile`.

## LLM Configuration
- Text model: OpenCode Go GLM-5 (provider: `opencode-go`, base_url: `https://opencode.ai/zen/go/v1`)
- Vision model: OpenRouter `google/gemini-3.1-flash-lite-preview`
- Never use Anthropic Claude as the agent model.

## Key Rules
- Hermes skills in `hermes/skills/` are demo-domain-specific (education / healthcare).
- Do NOT modify upstream Paperclip or Hermes code. Configure, don't fork.
- All HAST workflow code is original work in this repo.
- Use Docker Compose for all local development.
- This is a public demo — no customer data, no proprietary content.

## LLM Provider — Critical
- ONLY pass `OPENCODE_GO_API_KEY` to Hermes agents inside Paperclip container.
- NEVER pass `OPENROUTER_API_KEY` to the Paperclip entrypoint — the
  hermes-paperclip-adapter maps the `glm-` prefix to the `zai` provider, which
  falls back to OpenRouter and burns credits.
- OpenRouter is only for vision calls via the Hermes gateway
  (configured in `hermes/config.yaml`).

## Agent Instructions (SOUL.md)
- Each agent has a `SOUL.md` in `hermes/agents/<agent-name>/SOUL.md`.
- SOUL content is auto-seeded into Paperclip's DB by the `seed-instructions`
  one-shot service on `docker compose up`.
- The Paperclip API rejects PATCH requests from non-browser origins
  ("Board mutation requires trusted browser origin"). Manual edits via the
  Paperclip UI Instructions tab work; Chrome DevTools `type_text` works,
  `fill` does NOT work with Paperclip's ProseMirror editor.

## Running
```
cp .env.example .env  # Fill in OPENCODE_GO_API_KEY and OPENROUTER_API_KEY
docker compose up --build
```

## Ports
- Demo UI: http://localhost:3200
- Paperclip Admin: http://localhost:3100
- HAST API + Swagger: http://localhost:8000 (Swagger at `/docs`)
- Temporal UI: http://localhost:8233
- Hermes Gateway: http://localhost:8642
- PostgreSQL: localhost:5432

## HAST API Authentication
All `/api/*` endpoints require `Authorization: Bearer <HAST_API_KEY>` header.
The `/health` and `/docs` endpoints are unauthenticated.
Default key: `edu-platform-test-key-2026` (demo only — rotate for any
non-demo deployment).

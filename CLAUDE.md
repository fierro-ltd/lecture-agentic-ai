# Lecture Agentic AI — Claude Code Instructions

## What This Project Is
The agentic AI component of EDT&Partners' [Lecture](https://www.edtpartners.com/lecture) platform.
Extends Lecture with autonomous multi-agent capabilities: Paperclip orchestrates
Hermes agents with education-specific skills, backed by HAST's Temporal layer
for durable human-in-the-loop workflows.

**Product:** Lecture — The First Open-Source GenAI Framework for Education
**Company:** EDT&Partners (edtpartners.com)
**Repo:** fierro-ltd/lecture-agentic-ai (private)

## Architecture
- Paperclip (Node.js/React) = orchestration, org chart, governance, UI
- Hermes Agent (Python) = agent runtime with memory, tools, skills
- hermes-paperclip-adapter (TypeScript) = bridge between the two (already in Paperclip registry)
- HAST/Temporal (Python/FastAPI) = durable workflows, human-in-the-loop
- PostgreSQL = shared instance, separate databases (paperclip, temporal, lecture_agent)
- Temporal Server = workflow state machine

## LLM Configuration
- Text model: OpenCode Go GLM-5 (provider: opencode-go, base_url: https://opencode.ai/zen/go/v1)
- Vision model: OpenRouter google/gemini-3.1-flash-lite-preview
- Never use Anthropic Claude as the agent model

## Key Rules
- This repo is PROPRIETARY to EDT&Partners. Do not publish or open-source.
- Hermes skills in hermes/skills/ are education-domain-specific.
- Do NOT modify upstream Paperclip or Hermes code. Configure, don't fork.
- All HAST workflow code is original work in this repo.
- Use Docker Compose for all local development.

## LLM Provider — Critical
- ONLY pass `OPENCODE_GO_API_KEY` to Hermes agents inside Paperclip container.
- NEVER pass `OPENROUTER_API_KEY` to the Paperclip entrypoint — the hermes-paperclip-adapter
  maps "glm-" prefix to "zai" provider which falls back to OpenRouter, burning credits.
- OpenRouter is only for vision calls via the Hermes gateway (configured in config.yaml).

## Agent Instructions (SOUL.md)
- Each agent has a SOUL.md file in `hermes/agents/<agent-name>/SOUL.md`
- These define the agent's identity, lane, capabilities, and reporting format
- SOUL.md content must be pasted into each agent's **AGENTS.md** via the
  Paperclip UI Instructions tab (Agent > Instructions > click editor > Cmd+A > type content > Save)
- The Paperclip API rejects PATCH requests from non-browser origins ("Board mutation requires trusted browser origin")
- Chrome DevTools `type_text` works; `fill` does NOT work with Paperclip's ProseMirror editor
- This must be done separately for each Paperclip instance (local vs production have separate databases)

## Running
```
cp .env.example .env  # Fill in API keys
docker compose up --build
```

## Ports
- Paperclip UI: http://localhost:3100
- HAST API: http://localhost:8000
- Temporal UI: http://localhost:8233
- Hermes Gateway: http://localhost:8642
- PostgreSQL: localhost:5432

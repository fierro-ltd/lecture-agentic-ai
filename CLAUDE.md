# Lecture Agent — Claude Code Instructions

## What This Project Is
A proof-of-concept for an education-vertical multi-agent platform.
Paperclip orchestrates Hermes agents with education-specific skills.
HAST's Temporal layer provides durable human-in-the-loop workflows.

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

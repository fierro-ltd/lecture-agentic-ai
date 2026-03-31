# Lecture Agent PoC

Education-vertical multi-agent platform. Paperclip orchestrates Hermes agents
with education-specific skills, backed by Temporal durable workflows for
human-in-the-loop approval.

## Quick Start

```bash
cp .env.example .env   # Fill in API keys
docker compose up --build
```

## Services

| Service | URL | Purpose |
|---------|-----|---------|
| Paperclip | http://localhost:3100 | Orchestration UI + org chart |
| HAST API | http://localhost:8000 | Human-in-the-loop review workflows |
| Temporal UI | http://localhost:8233 | Workflow visibility |
| Hermes Gateway | http://localhost:8642 | LLM inference API |

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Demo

See [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

## License

Proprietary — EDT&Partners / Fierro Ltd. All rights reserved.

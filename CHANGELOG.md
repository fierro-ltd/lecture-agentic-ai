# Changelog

## v0.11.0 — Stabilize & Complete the Loop (2026-04-01)

### Infrastructure Hardening (Phase 1)

- **Hermes Gateway healthcheck** — Added `healthcheck` to `hermes-gateway` service; all dependents (`hast-api`, `hast-worker`, `paperclip`) now use `condition: service_healthy`
- **Temporal startup hardening** — Bumped `start_period` to 60s; added exponential backoff retry (3 attempts) to HAST API and worker Temporal connections
- **HAST API authentication** — All `/api/*` endpoints now require `Authorization: Bearer <token>` header; `/health` remains open
- **CORS lockdown** — Replaced `allow_origins=["*"]` with configurable `CORS_ALLOWED_ORIGINS` env var
- **SOUL.md auto-seeding** — New `seed-instructions` one-shot service writes SOUL.md content directly to Paperclip's database on startup
- **Production 403 fix** — Corrected Caddyfile domain (`lecture-agentic-ai.fierro.co.uk`), added header forwarding, fixed `PAPERCLIP_PUBLIC_URL`

### Feature Completion (Phase 2)

- **Reviewer dashboard** — Standalone SPA at port 3200 for human reviewers to see pending submissions, view AI evaluations, and approve/reject/request revision
- **Webhook notifications** — Configurable `NOTIFICATION_WEBHOOK_URL`; fires `review_ready` and `review_expired` events via Temporal activities
- **Demo scripts** — `scripts/demo-routine.sh` creates sample submissions; `scripts/demo-review.sh` submits review decisions
- **Healthcare company template** — New `healthcare` template with Clinical Operations Director, Documentation Quality Agent, Healthcare Compliance Agent, and clinical documentation review skill
- **Cross-industry language** — Neutralized education-specific terms in HAST code and docs; added cross-industry platform section to README
- **Structured logging** — JSON logging via `python-json-logger` with `X-Correlation-ID` propagation across HAST API and worker

### New Services

| Service | Port | Purpose |
|---------|------|---------|
| Reviewer Dashboard | 3200 | Human reviewer UI |
| Seed Instructions | -- | One-shot SOUL.md seeder |

### New Files

- `reviewer-ui/` — Standalone SPA (HTML/CSS/JS + nginx)
- `scripts/seed-agent-instructions.py` — Database seeding script
- `scripts/demo-routine.sh`, `scripts/demo-review.sh` — Demo lifecycle scripts
- `hast/src/logging_config.py` — Structured logging configuration
- `hast/src/workflows/notifications.py` — Webhook notification activity
- `paperclip/company-templates/healthcare/` — Healthcare company template
- `hermes/agents/clinical-ops-director/` — Clinical Operations Director agent
- `hermes/agents/documentation-quality/` — Documentation Quality agent
- `hermes/agents/healthcare-compliance/` — Healthcare Compliance agent
- `hermes/skills/clinical-documentation-review/` — Clinical documentation review skill

## v0.10.0 — Baseline Release (2026-04-01)

- Initial stable deployment of multi-agent education platform
- Fixed Temporal healthcheck to use container IP via `$(hostname -i):7233`
- HAST services depend on `temporal: service_healthy`
- Production port overrides use `!override` to prevent duplicate bindings

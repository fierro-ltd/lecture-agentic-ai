# Lecture Agent PoC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `lecture-agentic-ai` private repo with a single `docker compose up` that launches 6 services: PostgreSQL, Temporal (+ UI), Hermes Gateway, HAST API + Worker, and Paperclip — demonstrating education-domain multi-agent orchestration with human-in-the-loop review workflows.

**Architecture:** Paperclip orchestrates 4 Hermes education agents via the `hermes_local` adapter. Agents use domain-specific skills (assessment-review, curriculum-compliance, enrollment-evaluation, knowledge-augmentation). The assessment-review skill calls the HAST FastAPI service which starts a Temporal ReviewWorkflow for durable human-in-the-loop approval. All services share a single PostgreSQL instance (separate databases for Paperclip, Temporal, and HAST).

**Tech Stack:** Docker Compose, Python 3.11 (FastAPI + Temporal SDK + Hermes Agent), Node.js 20 (Paperclip), PostgreSQL 17, Temporal 1.24, OpenCode Go GLM-5 (text), OpenRouter Gemini 3.1 Flash Lite (vision).

**Reference repos (read-only):**
- HAST patterns: `/path/to/hast-reference-template`
- Paperclip source: `/tmp/paperclip-explore` (cloned from `paperclipai/paperclip`)
- Hermes adapter: `/tmp/hermes-adapter-explore` (cloned from `NousResearch/hermes-paperclip-adapter`)
- Hermes agent: `/tmp/hermes-agent-explore` (cloned from `NousResearch/hermes-agent`)

**API Keys (from HAST `infra/shared/.env`):**
- `OPENCODE_GO_API_KEY=sk-fcs7XsXYkEviwhK56xp63mLjH38Fr8zpVXgXGiPP20ZRmT5aPsDX6XXx4Gj3OInl`
- `OPENROUTER_API_KEY=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`
- `HERMES_API_KEY=edu-platform-test-key-2026`

**Critical finding:** The `hermes_local` adapter is **already registered** in Paperclip's `server/src/adapters/registry.ts` (lines 71-81, 178-189). No patching needed — Paperclip builds from source with the adapter included.

---

## Task 1: Create GitHub Repo + Root Files

**Parallelizable:** Yes (no dependencies)

**Files:**
- Create: `.gitignore`
- Create: `CLAUDE.md`
- Create: `.env.example`
- Create: `.env` (gitignored, with real keys)
- Create: `LICENSE`

- [ ] **Step 1: Create private repo on GitHub**

```bash
cd /path/to/lecture-agentic-ai
gh repo create lecture-agentic-ai --private --source=. --push
```

If the repo already has the initial spec commit, push it. If `gh repo create` fails because we already initialized git, just add the remote and push:

```bash
git remote add origin git@github.com:lecture-agentic-ai.git
git push -u origin main
```

- [ ] **Step 2: Create `.gitignore`**

```gitignore
node_modules/
__pycache__/
*.pyc
.env
.paperclip/
.hermes/
*.egg-info/
dist/
build/
postgres_data/
temporal_data/
.venv/
venv/
.pytest_cache/
```

- [ ] **Step 3: Create `CLAUDE.md`**

```markdown
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
- This repo is PROPRIETARY to the Lecture maintainers. Do not publish or open-source.
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
```

- [ ] **Step 4: Create `.env.example`**

```env
# === LLM Provider (OpenCode Go GLM-5) ===
OPENCODE_GO_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-v1-...
HERMES_API_KEY=edu-platform-test-key-2026

# === Database ===
POSTGRES_USER=lecture
POSTGRES_PASSWORD=lecture_dev

# === Paperclip ===
BETTER_AUTH_SECRET=change-me-to-a-random-32-char-string
PAPERCLIP_PUBLIC_URL=http://localhost:3100
```

- [ ] **Step 5: Create `.env` with real keys (gitignored)**

```env
OPENCODE_GO_API_KEY=sk-fcs7XsXYkEviwhK56xp63mLjH38Fr8zpVXgXGiPP20ZRmT5aPsDX6XXx4Gj3OInl
OPENROUTER_API_KEY=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
HERMES_API_KEY=edu-platform-test-key-2026
POSTGRES_USER=lecture
POSTGRES_PASSWORD=lecture_dev
BETTER_AUTH_SECRET=lecture-agent-dev-secret-32chars-min
PAPERCLIP_PUBLIC_URL=http://localhost:3100
```

- [ ] **Step 6: Create `LICENSE`**

```
Proprietary — the Lecture maintainers
All rights reserved.
```

- [ ] **Step 7: Commit**

```bash
git add .gitignore CLAUDE.md .env.example LICENSE
git commit -m "feat: add root project files (gitignore, CLAUDE.md, env example, license)"
```

---

## Task 2: Docker Compose + Infrastructure

**Parallelizable:** Yes (no dependencies)

**Files:**
- Create: `docker-compose.yml`
- Create: `infra/postgres/init-db.sql`

- [ ] **Step 1: Create `infra/postgres/init-db.sql`**

This SQL runs on first boot to create the HAST tables. Paperclip and Temporal create their own databases/tables automatically.

```sql
-- HAST Review Service Schema (runs in lecture_agent database)
CREATE TABLE IF NOT EXISTS hast_submissions (
    id              TEXT PRIMARY KEY,
    submission_type TEXT NOT NULL,
    entity_id       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    content         TEXT NOT NULL,
    criteria        TEXT DEFAULT '',
    ai_evaluation   JSONB,
    review_decision TEXT,
    reviewer_notes  TEXT,
    adjusted_score  REAL,
    paperclip_run_id TEXT,
    context         JSONB DEFAULT '{}',
    workflow_id     TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON hast_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_type ON hast_submissions(submission_type);
CREATE INDEX IF NOT EXISTS idx_submissions_entity ON hast_submissions(entity_id);
```

- [ ] **Step 2: Create `infra/postgres/init-multi-db.sh`**

Postgres only creates one database by default. We need three: `lecture_agent` (HAST), `paperclip`, and `temporal`. This script runs as part of the docker-entrypoint-initdb.d.

```bash
#!/bin/bash
set -e

# Create additional databases (default DB is lecture_agent via POSTGRES_DB)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE paperclip;
    CREATE DATABASE temporal;
    CREATE DATABASE temporal_visibility;
EOSQL

# Run HAST schema in lecture_agent database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/init-hast.sql
```

- [ ] **Step 3: Create `docker-compose.yml`**

```yaml
services:
  # === Database (shared PostgreSQL instance, 3 databases) ===
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-lecture}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-lecture_dev}
      POSTGRES_DB: lecture_agent
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/postgres/init-multi-db.sh:/docker-entrypoint-initdb.d/01-init-multi-db.sh
      - ./infra/postgres/init-db.sql:/docker-entrypoint-initdb.d/init-hast.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-lecture}"]
      interval: 5s
      timeout: 3s
      retries: 10

  # === Temporal Server ===
  temporal:
    image: temporalio/auto-setup:1.24
    environment:
      - DB=postgresql
      - DB_PORT=5432
      - POSTGRES_USER=${POSTGRES_USER:-lecture}
      - POSTGRES_PWD=${POSTGRES_PASSWORD:-lecture_dev}
      - POSTGRES_SEEDS=postgres
      - DYNAMIC_CONFIG_FILE_PATH=config/dynamicconfig/development-sql.yaml
    ports:
      - "7233:7233"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "temporal", "workflow", "list", "--namespace", "default"]
      interval: 10s
      timeout: 5s
      retries: 20
      start_period: 30s

  temporal-ui:
    image: temporalio/ui:2.31.2
    environment:
      - TEMPORAL_ADDRESS=temporal:7233
    ports:
      - "8233:8080"
    depends_on:
      - temporal

  # === Hermes Gateway (OpenAI-compatible API for LLM inference) ===
  hermes-gateway:
    build:
      context: ./hermes
      dockerfile: Dockerfile
    environment:
      - HERMES_HOME=/root/.hermes
      - OPENCODE_GO_API_KEY=${OPENCODE_GO_API_KEY}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - API_SERVER_KEY=${HERMES_API_KEY:-edu-platform-test-key-2026}
    ports:
      - "8642:8642"
    volumes:
      - hermes_data:/root/.hermes
      - ./hermes/skills:/root/.hermes/skills
      - ./hermes/config.yaml:/root/.hermes/config.yaml

  # === HAST Review Service (FastAPI + Temporal Worker) ===
  hast-api:
    build:
      context: ./hast
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER:-lecture}:${POSTGRES_PASSWORD:-lecture_dev}@postgres:5432/lecture_agent
      - TEMPORAL_ADDRESS=temporal:7233
      - HERMES_GATEWAY_URL=http://hermes-gateway:8642
      - HERMES_API_KEY=${HERMES_API_KEY:-edu-platform-test-key-2026}
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      temporal:
        condition: service_healthy

  hast-worker:
    build:
      context: ./hast
      dockerfile: Dockerfile
    command: python -m src.worker
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER:-lecture}:${POSTGRES_PASSWORD:-lecture_dev}@postgres:5432/lecture_agent
      - TEMPORAL_ADDRESS=temporal:7233
      - HERMES_GATEWAY_URL=http://hermes-gateway:8642
      - HERMES_API_KEY=${HERMES_API_KEY:-edu-platform-test-key-2026}
    depends_on:
      postgres:
        condition: service_healthy
      temporal:
        condition: service_healthy

  # === Paperclip (Orchestration + UI) ===
  paperclip:
    build:
      context: .
      dockerfile: paperclip/Dockerfile
    environment:
      - DATABASE_URL=postgres://${POSTGRES_USER:-lecture}:${POSTGRES_PASSWORD:-lecture_dev}@postgres:5432/paperclip
      - PORT=3100
      - SERVE_UI=true
      - PAPERCLIP_DEPLOYMENT_MODE=authenticated
      - PAPERCLIP_DEPLOYMENT_EXPOSURE=private
      - PAPERCLIP_PUBLIC_URL=${PAPERCLIP_PUBLIC_URL:-http://localhost:3100}
      - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET:-lecture-agent-dev-secret-32chars-min}
      - OPENCODE_GO_API_KEY=${OPENCODE_GO_API_KEY}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - HERMES_API_KEY=${HERMES_API_KEY:-edu-platform-test-key-2026}
    ports:
      - "3100:3100"
    depends_on:
      postgres:
        condition: service_healthy
      hermes-gateway:
        condition: service_started
    volumes:
      - paperclip_data:/paperclip
      - ./hermes/skills:/root/.hermes/skills
      - ./hermes/config.yaml:/root/.hermes/config.yaml

volumes:
  postgres_data:
  hermes_data:
  paperclip_data:
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml infra/
git commit -m "feat: add docker-compose and postgres init scripts (6 services)"
```

---

## Task 3: Hermes Configuration + Education Skills

**Parallelizable:** Yes (no dependencies)

**Files:**
- Create: `hermes/Dockerfile`
- Create: `hermes/config.yaml`
- Create: `hermes/skills/assessment-review/SKILL.md`
- Create: `hermes/skills/curriculum-compliance/SKILL.md`
- Create: `hermes/skills/enrollment-evaluation/SKILL.md`
- Create: `hermes/skills/knowledge-augmentation/SKILL.md`

- [ ] **Step 1: Create `hermes/Dockerfile`**

Based on the official Hermes Agent Dockerfile pattern from `/tmp/hermes-agent-explore/Dockerfile`:

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ripgrep gcc python3-dev libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Hermes Agent
RUN pip install --no-cache-dir hermes-agent

# Create Hermes home directory structure
ENV HERMES_HOME=/root/.hermes
RUN mkdir -p $HERMES_HOME/skills $HERMES_HOME/sessions $HERMES_HOME/logs $HERMES_HOME/memories

# Copy configuration and skills
COPY config.yaml $HERMES_HOME/config.yaml
COPY skills/ $HERMES_HOME/skills/

EXPOSE 8642

# Run Hermes in gateway mode (exposes OpenAI-compatible API on :8642)
CMD ["hermes", "gateway", "run"]
```

- [ ] **Step 2: Create `hermes/config.yaml`**

This mirrors the working HAST config at `/path/to/hast-reference-template/services/hermes/config.yaml`:

```yaml
model:
  provider: opencode-go
  default: glm-5
  base_url: https://opencode.ai/zen/go/v1

vision:
  provider: openrouter
  model: google/gemini-3.1-flash-lite-preview

agent:
  max_turns: 50

platform_toolsets:
  api_server:
    - web
    - file
    - terminal
    - memory

gateway:
  platforms:
    api_server:
      enabled: true

stt:
  enabled: false
```

- [ ] **Step 3: Create `hermes/skills/assessment-review/SKILL.md`**

```markdown
---
name: assessment-review
description: >
  Evaluate student academic submissions against a rubric. Produces structured
  feedback with scores, strengths, weaknesses, and improvement suggestions.
  Integrates with the HAST workflow service for human-in-the-loop professor review.
version: 1.0.0
author: the Lecture maintainers
metadata:
  hermes:
    tags: [Education, Assessment, Grading, Human-in-the-Loop]
triggers:
  - review submission
  - grade assignment
  - evaluate student work
  - assessment quality check
tools_required:
  - web
  - file
  - terminal
---

# Assessment Review Skill

## Purpose
You are an academic assessment quality agent. Your role is to evaluate student
submissions against provided rubrics, produce structured feedback, and submit
the evaluation for human (professor) review via the HAST workflow service.

## Workflow

1. **Receive** the submission content and rubric from the task description
2. **Analyze** the submission against each rubric criterion
3. **Produce** a structured evaluation in the following JSON format:

```json
{
  "overall_score": 0-100,
  "criterion_scores": [
    {
      "criterion": "<name>",
      "score": 0-100,
      "weight": 0.0-1.0,
      "feedback": "<specific feedback>"
    }
  ],
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "improvement_suggestions": ["<suggestion 1>"],
  "reasoning": "<detailed reasoning for the overall score>"
}
```

4. **Submit** the evaluation to the HAST API for professor review:

```bash
curl -X POST http://hast-api:8000/api/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "submission_type": "assessment",
    "entity_id": "<student_id from task>",
    "context": {"course_id": "<from task>"},
    "content": "<submission content>",
    "criteria": "<rubric text>",
    "ai_evaluation": <your evaluation JSON>
  }'
```

5. **Report** back that the evaluation has been submitted for professor review.
   Include the submission ID from the HAST API response.

## Quality Standards
- Never assign a score without specific evidence from the submission
- Reference exact quotes or sections when providing feedback
- Flag potential academic integrity concerns without making accusations
- Respect the rubric weights — do not override the grading criteria
- When uncertain about a criterion, note the ambiguity in your reasoning

## Integration Notes
- The HAST API is at `http://hast-api:8000` inside Docker network
- After submission, a Temporal workflow starts automatically
- The professor reviews via the HAST API and approves/rejects
- The workflow waits up to 7 days for professor review before expiring
```

- [ ] **Step 4: Create `hermes/skills/curriculum-compliance/SKILL.md`**

```markdown
---
name: curriculum-compliance
description: >
  Check course materials, syllabi, and learning objectives against
  accreditation standards and institutional requirements. Flag gaps,
  suggest improvements, and produce compliance reports.
version: 1.0.0
author: the Lecture maintainers
metadata:
  hermes:
    tags: [Education, Compliance, Accreditation, Curriculum]
triggers:
  - check curriculum compliance
  - accreditation review
  - syllabus audit
  - learning objectives alignment
tools_required:
  - web
  - file
---

# Curriculum Compliance Skill

## Purpose
You are a curriculum compliance agent. You review course materials against
accreditation standards (e.g., ABET, SACSCOC, ANECA, QAA) and institutional
requirements. You produce structured compliance reports.

## Workflow

1. **Receive** the course materials and the applicable accreditation framework
2. **Identify** the relevant standards and criteria for the course type
3. **Map** each learning objective to the required competency standards
4. **Identify** gaps where learning objectives do not cover required competencies
5. **Produce** a compliance report:

```json
{
  "course_id": "<id>",
  "framework": "<accreditation body>",
  "overall_compliance": "compliant|partial|non-compliant",
  "coverage_score": 0-100,
  "criteria_mapping": [
    {
      "standard": "<standard code>",
      "description": "<what it requires>",
      "status": "met|partial|missing",
      "evidence": "<where in the syllabus this is addressed>",
      "gap_description": "<if partial/missing, what's needed>"
    }
  ],
  "recommendations": ["<recommendation 1>", "<recommendation 2>"]
}
```

6. **Report** findings back as a structured response

## Regional Standards Reference
- **Spain/EU**: ANECA, Bologna Process, ECTS framework
- **US**: SACSCOC, ABET (engineering), AACSB (business)
- **UK**: QAA, TEF (Teaching Excellence Framework)
- Use web search to retrieve current standards when not in local context
```

- [ ] **Step 5: Create `hermes/skills/enrollment-evaluation/SKILL.md`**

```markdown
---
name: enrollment-evaluation
description: >
  Evaluate student enrollment applications against admission criteria.
  Check prerequisite completion, document completeness, and eligibility.
  Route decisions through human-in-the-loop approval via HAST.
version: 1.0.0
author: the Lecture maintainers
metadata:
  hermes:
    tags: [Education, Enrollment, Admissions, Human-in-the-Loop]
triggers:
  - evaluate enrollment application
  - check admission eligibility
  - prerequisite verification
  - application screening
tools_required:
  - file
  - terminal
---

# Enrollment Evaluation Skill

## Purpose
You are an enrollment evaluation agent. You screen student applications
against admission criteria, verify prerequisite completion, check document
completeness, and route the decision for human approval.

## Workflow

1. **Receive** the application data and admission criteria from the task
2. **Verify** document completeness (transcripts, ID, prerequisites, etc.)
3. **Check** prerequisite course completion against requirements
4. **Evaluate** eligibility against published admission criteria
5. **Produce** a structured evaluation:

```json
{
  "applicant_id": "<id>",
  "program_id": "<target program>",
  "recommendation": "admit|conditional|waitlist|deny",
  "document_checklist": [
    {"document": "<name>", "status": "received|missing|invalid"}
  ],
  "prerequisites": [
    {"requirement": "<name>", "status": "met|not_met|in_progress"}
  ],
  "eligibility_score": 0-100,
  "flags": ["<any concerns>"],
  "reasoning": "<explanation>"
}
```

6. **Submit** to HAST API for human review (admissions officer):

```bash
curl -X POST http://hast-api:8000/api/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "submission_type": "enrollment",
    "entity_id": "<applicant_id>",
    "context": {"program_id": "<target program>"},
    "content": "<application summary>",
    "criteria": "<admission criteria>",
    "ai_evaluation": <your evaluation JSON>
  }'
```

## Important
- Never make final admit/deny decisions — always route to human review
- Flag edge cases explicitly rather than making assumptions
- Respect FERPA/GDPR data handling requirements
- Do not include PII in task updates — reference by applicant ID only
```

- [ ] **Step 6: Create `hermes/skills/knowledge-augmentation/SKILL.md`**

```markdown
---
name: knowledge-augmentation
description: >
  EDT's Knowledge Augmentation (KAG) pattern. Curate, index, and retrieve
  institutional knowledge beyond simple RAG. Maintain knowledge graphs
  of curriculum relationships, policy dependencies, and institutional context.
version: 1.0.0
author: the Lecture maintainers
metadata:
  hermes:
    tags: [Education, Knowledge-Management, KAG, Institutional]
triggers:
  - knowledge augmentation
  - curate institutional knowledge
  - update knowledge base
  - KAG query
tools_required:
  - web
  - file
  - memory
---

# Knowledge Augmentation Skill (KAG)

## Purpose
You are a knowledge curator agent implementing EDT's Knowledge Augmentation
pattern. Unlike simple RAG (retrieve-then-generate), KAG maintains structured
relationships between institutional knowledge artifacts.

## KAG vs RAG
- **RAG**: retrieve relevant chunks → generate answer
- **KAG**: maintain knowledge graph → traverse relationships → generate
  answer with full institutional context → update graph with new connections

## Workflow

1. **Receive** a knowledge query or curation task
2. **Search** existing memory and institutional documents
3. **Build** or traverse the knowledge graph:
   - Courses → prerequisites → learning objectives → competencies
   - Policies → regulations → compliance requirements
   - Faculty → expertise → research areas → courses taught
4. **Augment** the answer with relational context that simple retrieval would miss
5. **Update** memory with any new relationships discovered
6. **Respond** with the augmented knowledge and provenance chain

## Knowledge Graph Schema (Conceptual)
```
Course --requires--> Prerequisite
Course --teaches--> LearningObjective
LearningObjective --maps_to--> CompetencyStandard
CompetencyStandard --defined_by--> AccreditationBody
Faculty --teaches--> Course
Faculty --researches--> Topic
Policy --governs--> Process
Policy --requires--> Compliance
```

## Integration
- Use Hermes memory system for persistent knowledge storage
- Update knowledge graph on each interaction
- Flag knowledge conflicts (e.g., two policies that contradict)
- Provide provenance: "This answer draws from [source] via [relationship]"

## Note
This is a placeholder implementation establishing the interface contract.
The full KAG system is EDT proprietary and will be integrated when the
production Lecture platform is built.
```

- [ ] **Step 7: Commit**

```bash
git add hermes/
git commit -m "feat: add Hermes gateway config and 4 education domain skills"
```

---

## Task 4: HAST Review Service

**Parallelizable:** Yes (no dependencies)

**Files:**
- Create: `hast/Dockerfile`
- Create: `hast/requirements.txt`
- Create: `hast/src/__init__.py`
- Create: `hast/src/config.py`
- Create: `hast/src/models.py`
- Create: `hast/src/api.py`
- Create: `hast/src/worker.py`
- Create: `hast/src/workflows/__init__.py`
- Create: `hast/src/workflows/review_workflow.py`
- Create: `hast/src/workflows/activities.py`
- Test: `hast/tests/test_models.py`
- Test: `hast/tests/test_api.py`

- [ ] **Step 1: Create `hast/Dockerfile`**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ /app/src/

EXPOSE 8000

CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Create `hast/requirements.txt`**

```
fastapi==0.115.6
uvicorn[standard]==0.34.0
temporalio==1.9.0
psycopg2-binary==2.9.10
pydantic==2.10.4
httpx==0.28.1
python-dotenv==1.0.1
```

- [ ] **Step 3: Create `hast/src/__init__.py`**

Empty file.

- [ ] **Step 4: Create `hast/src/config.py`**

```python
"""Configuration loaded from environment variables."""

import os


class Settings:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://lecture:lecture_dev@localhost:5432/lecture_agent",
    )
    TEMPORAL_ADDRESS: str = os.getenv("TEMPORAL_ADDRESS", "localhost:7233")
    TEMPORAL_TASK_QUEUE: str = os.getenv("TEMPORAL_TASK_QUEUE", "lecture-review-queue")
    HERMES_GATEWAY_URL: str = os.getenv("HERMES_GATEWAY_URL", "http://localhost:8642")
    HERMES_API_KEY: str = os.getenv("HERMES_API_KEY", "edu-platform-test-key-2026")
    REVIEW_TIMEOUT_DAYS: int = int(os.getenv("REVIEW_TIMEOUT_DAYS", "7"))


settings = Settings()
```

- [ ] **Step 5: Create `hast/src/models.py`**

```python
"""Pydantic models for the HAST review workflow."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class SubmissionStatus(str, Enum):
    PENDING = "pending"
    EVALUATING = "evaluating"
    REVIEW = "review"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVISION_REQUESTED = "revision_requested"
    EXPIRED = "expired"


class SubmissionCreate(BaseModel):
    """Payload from a Hermes agent submitting content for review."""

    submission_type: str = Field(
        ...,
        description="Type of submission: assessment, enrollment, compliance",
    )
    entity_id: str = Field(..., description="Student/course/applicant ID")
    context: dict[str, Any] = Field(
        default_factory=dict,
        description="Submission metadata (course_id, program_id, etc.)",
    )
    content: str = Field(..., description="The content being evaluated")
    criteria: str = Field(
        default="",
        description="Evaluation criteria / rubric",
    )
    ai_evaluation: dict[str, Any] | None = Field(
        default=None,
        description="Pre-computed AI evaluation from the Hermes agent",
    )
    paperclip_run_id: str | None = Field(
        default=None,
        description="Paperclip run ID for traceability",
    )


class ReviewDecision(BaseModel):
    """Human reviewer's decision."""

    decision: str = Field(
        ...,
        description="approved | rejected | revision_requested",
    )
    reviewer_notes: str = Field(default="")
    adjusted_score: float | None = None
    adjusted_evaluation: dict[str, Any] | None = None


class SubmissionResponse(BaseModel):
    """API response for a submission."""

    id: str
    submission_type: str
    entity_id: str
    status: SubmissionStatus
    content: str
    ai_evaluation: dict[str, Any] | None
    review_decision: str | None
    reviewer_notes: str | None
    created_at: datetime
    updated_at: datetime
    workflow_id: str | None
```

- [ ] **Step 6: Create `hast/src/workflows/__init__.py`**

Empty file.

- [ ] **Step 7: Create `hast/src/workflows/review_workflow.py`**

```python
"""
Temporal workflow for human-in-the-loop review.

This is the core HAST pattern: AI evaluates -> human reviews -> decision recorded.
The workflow is durable — survives crashes, respects timeouts, supports signals.
"""

from __future__ import annotations

from datetime import timedelta
from dataclasses import dataclass

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from src.config import settings


@dataclass
class ReviewInput:
    submission_id: str
    submission_type: str
    entity_id: str
    content: str
    criteria: str
    ai_evaluation: dict | None = None


@dataclass
class ReviewSignal:
    decision: str  # approved | rejected | revision_requested
    reviewer_notes: str = ""
    adjusted_score: float | None = None
    adjusted_evaluation: dict | None = None


@workflow.defn
class ReviewWorkflow:
    """
    Durable human-in-the-loop review workflow.

    Flow:
    1. If no AI evaluation provided, run AI evaluation activity
    2. Notify reviewer (update status to 'review')
    3. Wait for human signal (up to REVIEW_TIMEOUT_DAYS)
    4. Record final decision
    """

    def __init__(self) -> None:
        self._review_signal: ReviewSignal | None = None

    @workflow.signal
    async def review_decision(self, signal: ReviewSignal) -> None:
        self._review_signal = signal

    @workflow.query
    def get_status(self) -> str:
        if self._review_signal:
            return self._review_signal.decision
        return "waiting_for_review"

    @workflow.run
    async def run(self, input: ReviewInput) -> dict:
        # Step 1: AI evaluation (if not already done by the Hermes agent)
        ai_eval = input.ai_evaluation
        if ai_eval is None:
            ai_eval = await workflow.execute_activity(
                "evaluate_submission",
                input,
                start_to_close_timeout=timedelta(minutes=10),
                retry_policy=RetryPolicy(maximum_attempts=3),
                heartbeat_timeout=timedelta(seconds=30),
            )

        # Step 2: Mark as ready for review
        await workflow.execute_activity(
            "update_submission_status",
            {"submission_id": input.submission_id, "status": "review", "ai_evaluation": ai_eval},
            start_to_close_timeout=timedelta(seconds=30),
        )

        # Step 3: Wait for human review signal
        timeout = timedelta(days=settings.REVIEW_TIMEOUT_DAYS)
        try:
            await workflow.wait_condition(
                lambda: self._review_signal is not None,
                timeout=timeout,
            )
        except TimeoutError:
            await workflow.execute_activity(
                "update_submission_status",
                {"submission_id": input.submission_id, "status": "expired"},
                start_to_close_timeout=timedelta(seconds=30),
            )
            return {"status": "expired", "submission_id": input.submission_id}

        # Step 4: Record decision
        signal = self._review_signal
        await workflow.execute_activity(
            "record_review_decision",
            {
                "submission_id": input.submission_id,
                "decision": signal.decision,
                "reviewer_notes": signal.reviewer_notes,
                "adjusted_score": signal.adjusted_score,
                "adjusted_evaluation": signal.adjusted_evaluation,
            },
            start_to_close_timeout=timedelta(seconds=30),
        )

        return {
            "status": signal.decision,
            "submission_id": input.submission_id,
            "reviewer_notes": signal.reviewer_notes,
        }
```

- [ ] **Step 8: Create `hast/src/workflows/activities.py`**

```python
"""
Temporal activity implementations.

These are the actual side-effect-producing functions called by the workflow.
They interact with the database and the Hermes gateway.
"""

from __future__ import annotations

import json

import httpx
import psycopg2
from temporalio import activity

from src.config import settings


@activity.defn
async def evaluate_submission(input) -> dict:
    """
    Call the Hermes gateway (OpenAI-compatible API) to evaluate a submission.
    Used when the Hermes agent hasn't already produced an evaluation.
    """
    activity.heartbeat("Starting AI evaluation")

    system_prompt = f"""You are an academic assessment evaluator. Evaluate the following
submission against the provided criteria. Respond with ONLY valid JSON matching this schema:
{{
  "overall_score": <0-100>,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "feedback": "...",
  "reasoning": "..."
}}

Criteria: {input.criteria}"""

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            f"{settings.HERMES_GATEWAY_URL}/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.HERMES_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "default",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": input.content},
                ],
                "temperature": 0.3,
            },
        )
        response.raise_for_status()
        data = response.json()

    content = data["choices"][0]["message"]["content"]

    # Parse the JSON response, handling potential markdown fencing
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0]

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {"overall_score": 0, "feedback": content, "error": "Failed to parse structured response"}


@activity.defn
async def update_submission_status(params: dict) -> None:
    """Update the submission status in PostgreSQL."""
    conn = psycopg2.connect(settings.DATABASE_URL)
    try:
        with conn.cursor() as cur:
            updates = ["status = %s", "updated_at = NOW()"]
            values = [params["status"]]

            if "ai_evaluation" in params and params["ai_evaluation"]:
                updates.append("ai_evaluation = %s")
                values.append(json.dumps(params["ai_evaluation"]))

            values.append(params["submission_id"])
            cur.execute(
                f"UPDATE hast_submissions SET {', '.join(updates)} WHERE id = %s",
                values,
            )
            conn.commit()
    finally:
        conn.close()


@activity.defn
async def record_review_decision(params: dict) -> None:
    """Record the final review decision."""
    conn = psycopg2.connect(settings.DATABASE_URL)
    try:
        status_map = {
            "approved": "approved",
            "rejected": "rejected",
            "revision_requested": "revision_requested",
        }
        status = status_map.get(params["decision"], params["decision"])

        with conn.cursor() as cur:
            cur.execute(
                """UPDATE hast_submissions
                   SET status = %s,
                       review_decision = %s,
                       reviewer_notes = %s,
                       adjusted_score = %s,
                       updated_at = NOW()
                   WHERE id = %s""",
                (
                    status,
                    params["decision"],
                    params.get("reviewer_notes", ""),
                    params.get("adjusted_score"),
                    params["submission_id"],
                ),
            )
            conn.commit()
    finally:
        conn.close()
```

- [ ] **Step 9: Create `hast/src/api.py`**

```python
"""
HAST API — FastAPI endpoints for the human-in-the-loop review service.

Called by:
1. Hermes agents (via the assessment-review skill) to submit evaluations
2. Paperclip (optional) to check submission status
3. Human reviewers (via API for the PoC) to submit review decisions
"""

from __future__ import annotations

import uuid
import json
from datetime import datetime

import psycopg2
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from temporalio.client import Client as TemporalClient

from src.config import settings
from src.models import (
    SubmissionCreate,
    SubmissionResponse,
    SubmissionStatus,
    ReviewDecision,
)
from src.workflows.review_workflow import ReviewWorkflow, ReviewInput, ReviewSignal

app = FastAPI(title="HAST Review Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_temporal_client: TemporalClient | None = None


async def get_temporal_client() -> TemporalClient:
    global _temporal_client
    if _temporal_client is None:
        _temporal_client = await TemporalClient.connect(settings.TEMPORAL_ADDRESS)
    return _temporal_client


def get_db():
    return psycopg2.connect(settings.DATABASE_URL)


def _row_to_response(row) -> SubmissionResponse:
    return SubmissionResponse(
        id=row[0],
        submission_type=row[1],
        entity_id=row[2],
        status=row[3],
        content=row[4],
        ai_evaluation=json.loads(row[5]) if row[5] else None,
        review_decision=row[6],
        reviewer_notes=row[7],
        created_at=row[8],
        updated_at=row[9],
        workflow_id=row[10],
    )


SUBMISSION_SELECT = """SELECT id, submission_type, entity_id, status, content,
                              ai_evaluation, review_decision, reviewer_notes,
                              created_at, updated_at, workflow_id
                       FROM hast_submissions"""


@app.get("/health")
async def health():
    return {"status": "ok", "service": "hast-review"}


@app.post("/api/submissions", response_model=SubmissionResponse)
async def create_submission(payload: SubmissionCreate):
    """Create a new submission and start the review workflow."""
    submission_id = str(uuid.uuid4())
    workflow_id = f"review-{submission_id}"
    now = datetime.utcnow()

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO hast_submissions
                   (id, submission_type, entity_id, status, content, criteria,
                    ai_evaluation, paperclip_run_id, context, workflow_id,
                    created_at, updated_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    submission_id,
                    payload.submission_type,
                    payload.entity_id,
                    SubmissionStatus.EVALUATING.value
                    if payload.ai_evaluation is None
                    else SubmissionStatus.REVIEW.value,
                    payload.content,
                    payload.criteria,
                    json.dumps(payload.ai_evaluation) if payload.ai_evaluation else None,
                    payload.paperclip_run_id,
                    json.dumps(payload.context),
                    workflow_id,
                    now,
                    now,
                ),
            )
            conn.commit()
    finally:
        conn.close()

    # Start Temporal workflow
    client = await get_temporal_client()
    await client.start_workflow(
        ReviewWorkflow.run,
        ReviewInput(
            submission_id=submission_id,
            submission_type=payload.submission_type,
            entity_id=payload.entity_id,
            content=payload.content,
            criteria=payload.criteria,
            ai_evaluation=payload.ai_evaluation,
        ),
        id=workflow_id,
        task_queue=settings.TEMPORAL_TASK_QUEUE,
    )

    return SubmissionResponse(
        id=submission_id,
        submission_type=payload.submission_type,
        entity_id=payload.entity_id,
        status=SubmissionStatus.EVALUATING
        if payload.ai_evaluation is None
        else SubmissionStatus.REVIEW,
        content=payload.content,
        ai_evaluation=payload.ai_evaluation,
        review_decision=None,
        reviewer_notes=None,
        created_at=now,
        updated_at=now,
        workflow_id=workflow_id,
    )


@app.get("/api/submissions/{submission_id}", response_model=SubmissionResponse)
async def get_submission(submission_id: str):
    """Get a submission by ID."""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"{SUBMISSION_SELECT} WHERE id = %s",
                (submission_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Submission not found")
            return _row_to_response(row)
    finally:
        conn.close()


@app.get("/api/submissions")
async def list_submissions(status: str | None = None, limit: int = 50):
    """List submissions, optionally filtered by status."""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            if status:
                cur.execute(
                    f"{SUBMISSION_SELECT} WHERE status = %s ORDER BY created_at DESC LIMIT %s",
                    (status, limit),
                )
            else:
                cur.execute(
                    f"{SUBMISSION_SELECT} ORDER BY created_at DESC LIMIT %s",
                    (limit,),
                )
            return [_row_to_response(r) for r in cur.fetchall()]
    finally:
        conn.close()


@app.post("/api/submissions/{submission_id}/review")
async def submit_review(submission_id: str, decision: ReviewDecision):
    """Submit a human review decision. Sends a signal to the Temporal workflow."""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT workflow_id, status FROM hast_submissions WHERE id = %s",
                (submission_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Submission not found")
            workflow_id, current_status = row
            if current_status != SubmissionStatus.REVIEW.value:
                raise HTTPException(
                    status_code=400,
                    detail=f"Submission is in '{current_status}' status, not 'review'",
                )
    finally:
        conn.close()

    client = await get_temporal_client()
    handle = client.get_workflow_handle(workflow_id)
    await handle.signal(
        ReviewWorkflow.review_decision,
        ReviewSignal(
            decision=decision.decision,
            reviewer_notes=decision.reviewer_notes,
            adjusted_score=decision.adjusted_score,
            adjusted_evaluation=decision.adjusted_evaluation,
        ),
    )

    return {"status": "review_submitted", "submission_id": submission_id}
```

- [ ] **Step 10: Create `hast/src/worker.py`**

```python
"""Temporal worker process — runs workflow and activity executors."""

import asyncio
from temporalio.client import Client
from temporalio.worker import Worker

from src.config import settings
from src.workflows.review_workflow import ReviewWorkflow
from src.workflows.activities import (
    evaluate_submission,
    update_submission_status,
    record_review_decision,
)


async def main():
    client = await Client.connect(settings.TEMPORAL_ADDRESS)

    worker = Worker(
        client,
        task_queue=settings.TEMPORAL_TASK_QUEUE,
        workflows=[ReviewWorkflow],
        activities=[
            evaluate_submission,
            update_submission_status,
            record_review_decision,
        ],
    )

    print(f"HAST Worker started on queue: {settings.TEMPORAL_TASK_QUEUE}")
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 11: Write tests for models**

Create `hast/tests/__init__.py` (empty) and `hast/tests/test_models.py`:

```python
"""Tests for HAST Pydantic models."""

from src.models import SubmissionCreate, ReviewDecision, SubmissionResponse, SubmissionStatus
from datetime import datetime


def test_submission_create_minimal():
    s = SubmissionCreate(
        submission_type="assessment",
        entity_id="student-123",
        content="My essay about AI in education.",
    )
    assert s.submission_type == "assessment"
    assert s.entity_id == "student-123"
    assert s.ai_evaluation is None
    assert s.context == {}


def test_submission_create_with_evaluation():
    s = SubmissionCreate(
        submission_type="enrollment",
        entity_id="applicant-456",
        content="Application materials",
        criteria="GPA >= 3.0",
        ai_evaluation={"overall_score": 85, "strengths": ["strong GPA"]},
    )
    assert s.ai_evaluation["overall_score"] == 85


def test_review_decision():
    d = ReviewDecision(decision="approved", reviewer_notes="Excellent work")
    assert d.decision == "approved"
    assert d.adjusted_score is None


def test_submission_response():
    now = datetime.utcnow()
    r = SubmissionResponse(
        id="uuid-1",
        submission_type="assessment",
        entity_id="student-1",
        status=SubmissionStatus.REVIEW,
        content="test",
        ai_evaluation=None,
        review_decision=None,
        reviewer_notes=None,
        created_at=now,
        updated_at=now,
        workflow_id="review-uuid-1",
    )
    assert r.status == SubmissionStatus.REVIEW
```

- [ ] **Step 12: Run tests**

```bash
cd /path/to/lecture-agentic-ai/hast
pip install pydantic pytest
PYTHONPATH=. pytest tests/test_models.py -v
```

Expected: 4 tests PASS.

- [ ] **Step 13: Commit**

```bash
git add hast/
git commit -m "feat: add HAST review service (FastAPI + Temporal workflow + worker)"
```

---

## Task 5: Paperclip Dockerfile + Company Template

**Parallelizable:** Yes (no dependencies)

**Files:**
- Create: `paperclip/Dockerfile`
- Create: `paperclip/company-templates/higher-ed/company.json`
- Create: `paperclip/company-templates/higher-ed/README.md`

- [ ] **Step 1: Create `paperclip/Dockerfile`**

Paperclip builds from source. The Dockerfile clones the Paperclip repo, builds it, and installs Hermes Agent so the `hermes_local` adapter can spawn `hermes chat -q`. Based on the official Paperclip Dockerfile at `/tmp/paperclip-explore/Dockerfile`.

```dockerfile
FROM node:lts-trixie-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     ca-certificates curl git python3 python3-pip python3-venv ripgrep gcc python3-dev libffi-dev \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

# Clone and install Paperclip
FROM base AS deps
WORKDIR /app
RUN git clone --depth 1 https://github.com/paperclipai/paperclip.git /app
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app /app
RUN pnpm --filter @paperclipai/ui build
RUN pnpm --filter @paperclipai/plugin-sdk build
RUN pnpm --filter @paperclipai/server build
RUN test -f server/dist/index.js || (echo "ERROR: server build output missing" && exit 1)

FROM base AS production
WORKDIR /app
COPY --from=build /app /app

# Install Hermes Agent (required by hermes_local adapter which spawns `hermes chat -q`)
RUN pip3 install --break-system-packages --no-cache-dir hermes-agent

# Create Paperclip data directory
RUN mkdir -p /paperclip && chown node:node /paperclip

# Create Hermes config directory (for adapter to read config.yaml)
RUN mkdir -p /root/.hermes/skills

# Copy company templates
COPY paperclip/company-templates/ /app/company-templates/

ENV NODE_ENV=production \
  HOME=/paperclip \
  HOST=0.0.0.0 \
  PORT=3100 \
  SERVE_UI=true \
  PAPERCLIP_HOME=/paperclip \
  PAPERCLIP_INSTANCE_ID=default \
  PAPERCLIP_CONFIG=/paperclip/instances/default/config.json \
  PAPERCLIP_DEPLOYMENT_MODE=authenticated \
  PAPERCLIP_DEPLOYMENT_EXPOSURE=private

VOLUME ["/paperclip"]
EXPOSE 3100

CMD ["node", "--import", "./server/node_modules/tsx/dist/loader.mjs", "server/dist/index.js"]
```

Note: This Dockerfile uses the project root as build context (set in docker-compose.yml as `context: .`) so it can access both `paperclip/` and `hermes/` directories.

- [ ] **Step 2: Create `paperclip/company-templates/higher-ed/company.json`**

This is the education company template with 4 agents using `hermes_local` adapter and OpenCode Go GLM-5.

```json
{
  "name": "University AI Operations Center",
  "goal": "Ensure academic quality, operational efficiency, and regulatory compliance across all institutional processes through AI-assisted evaluation, monitoring, and knowledge management.",
  "agents": [
    {
      "name": "AI Operations Director",
      "role": "CEO",
      "title": "AI Operations Director",
      "adapterType": "hermes_local",
      "adapterConfig": {
        "model": "glm-5",
        "provider": "opencode-go",
        "maxIterations": 30,
        "timeoutSec": 300,
        "persistSession": true,
        "enabledToolsets": ["terminal", "file", "web", "memory"]
      },
      "capabilities": "Strategic coordination of all AI operations. Decomposes institutional goals into projects and tasks. Delegates to specialized agents. Reviews cross-functional work.",
      "monthlyBudgetCents": 5000,
      "heartbeatSchedule": "0 */4 * * *",
      "reports": []
    },
    {
      "name": "Assessment Quality Agent",
      "role": "Engineer",
      "title": "Assessment Quality Specialist",
      "adapterType": "hermes_local",
      "adapterConfig": {
        "model": "glm-5",
        "provider": "opencode-go",
        "maxIterations": 50,
        "timeoutSec": 600,
        "persistSession": true,
        "enabledToolsets": ["terminal", "file", "web", "memory"]
      },
      "capabilities": "Evaluates student submissions against rubrics. Produces structured feedback. Routes evaluations for professor review via HAST workflow. Uses the assessment-review skill.",
      "monthlyBudgetCents": 3000,
      "heartbeatSchedule": "0 */2 * * *",
      "reportsTo": "AI Operations Director"
    },
    {
      "name": "Curriculum Compliance Agent",
      "role": "Engineer",
      "title": "Curriculum Compliance Specialist",
      "adapterType": "hermes_local",
      "adapterConfig": {
        "model": "glm-5",
        "provider": "opencode-go",
        "maxIterations": 30,
        "timeoutSec": 300,
        "persistSession": true,
        "enabledToolsets": ["terminal", "file", "web", "memory"]
      },
      "capabilities": "Reviews syllabi and course materials against accreditation standards (ANECA, SACSCOC, QAA). Identifies compliance gaps. Uses the curriculum-compliance skill.",
      "monthlyBudgetCents": 2000,
      "heartbeatSchedule": "0 8 * * 1",
      "reportsTo": "AI Operations Director"
    },
    {
      "name": "Knowledge Curator Agent",
      "role": "Engineer",
      "title": "Knowledge Augmentation Specialist",
      "adapterType": "hermes_local",
      "adapterConfig": {
        "model": "glm-5",
        "provider": "opencode-go",
        "maxIterations": 30,
        "timeoutSec": 300,
        "persistSession": true,
        "enabledToolsets": ["terminal", "file", "web", "memory"]
      },
      "capabilities": "Maintains institutional knowledge graph using EDT's KAG pattern. Curates relationships between courses, standards, policies, and faculty. Uses the knowledge-augmentation skill.",
      "monthlyBudgetCents": 2000,
      "heartbeatSchedule": "0 6 * * *",
      "reportsTo": "AI Operations Director"
    }
  ]
}
```

- [ ] **Step 3: Create `paperclip/company-templates/higher-ed/README.md`**

```markdown
# Higher Education Company Template

This template configures a Paperclip company for university AI operations.

## Agents
- **AI Operations Director** — CEO, coordinates all agents
- **Assessment Quality Agent** — Evaluates student work, routes to professor review
- **Curriculum Compliance Agent** — Checks syllabi against accreditation standards
- **Knowledge Curator Agent** — Maintains institutional knowledge graph

## How to Import
For the PoC, create the company manually via Paperclip UI at http://localhost:3100.
Use the agent definitions from `company.json` as reference.

Future: `paperclipai company import ./company-templates/higher-ed/company.json`
```

- [ ] **Step 4: Commit**

```bash
git add paperclip/
git commit -m "feat: add Paperclip Dockerfile and higher-ed company template"
```

---

## Task 6: Documentation

**Parallelizable:** Yes (no dependencies)

**Files:**
- Create: `docs/ARCHITECTURE.md`
- Create: `docs/DEMO_SCRIPT.md`
- Create: `README.md`

- [ ] **Step 1: Create `docs/ARCHITECTURE.md`**

```markdown
# Lecture Agent — Architecture

## Layer Diagram

```
+------------------------------------------------------+
|  Paperclip (port 3100)                                |
|  React UI + Express.js API + PostgreSQL               |
|  Org chart, heartbeats, budgets, governance           |
|  Company: "University AI Operations Center"           |
+------------------------------------------------------+
|  Hermes Agents (via hermes_local adapter)             |
|  Each agent has: persistent memory, session state,    |
|  education-specific skills (assessment-review,        |
|  curriculum-compliance, enrollment-evaluation,        |
|  knowledge-augmentation)                              |
+------------------------------------------------------+
|  Hermes Gateway (port 8642)                           |
|  OpenAI-compatible API for LLM inference              |
|  Provider: OpenCode Go (GLM-5) + OpenRouter (vision)  |
+------------------------------------------------------+
|  HAST Review Service (port 8000)                      |
|  FastAPI REST API for submission/review management    |
|  Called by Hermes agents when human review is needed   |
+------------------------------------------------------+
|  Temporal Server (port 7233) + UI (port 8233)         |
|  Durable workflow orchestration                       |
|  ReviewWorkflow: evaluate -> wait for human -> record  |
+------------------------------------------------------+
|  PostgreSQL (port 5432)                               |
|  3 databases: paperclip, temporal, lecture_agent       |
+------------------------------------------------------+
```

## Data Flow: Assessment Review

1. Professor creates a task in Paperclip: "Review CS101 midterm submission #42"
2. Paperclip assigns the task to the Assessment Quality Agent
3. On next heartbeat, Hermes agent wakes and picks up the task
4. Agent uses `assessment-review` skill to evaluate the submission
5. Skill calls HAST API: `POST /api/submissions` with the evaluation
6. HAST starts a Temporal ReviewWorkflow
7. Workflow marks submission as "review" and waits for human signal
8. Professor opens HAST API and approves/rejects
9. Temporal workflow completes, records decision in PostgreSQL
10. Agent reports back to Paperclip that the task is done

## Key Design Decisions

- **Paperclip is the UI and orchestrator** — humans interact with Paperclip
- **HAST is the workflow engine** — called by agents for durable approval flows
- **Hermes is the agent runtime** — does the actual cognitive work
- **Skills are the domain layer** — education-specific logic in SKILL.md files
- **PostgreSQL is shared** — one instance, three databases
- **hermes_local adapter already in Paperclip** — no patching needed
```

- [ ] **Step 2: Create `docs/DEMO_SCRIPT.md`**

```markdown
# Lecture Agent — Demo Script for EDT

## Prerequisites
- All services running: `docker compose up`
- Paperclip UI accessible at http://localhost:3100
- HAST API accessible at http://localhost:8000
- Temporal UI accessible at http://localhost:8233

## Demo Flow

### 1. Show the Org Chart (2 min)
Open Paperclip at localhost:3100.
Show the "University AI Operations Center" company.
Walk through the org chart:
- AI Operations Director (CEO equivalent)
- Assessment Quality Agent (reports to Director)
- Curriculum Compliance Agent (reports to Director)
- Knowledge Curator Agent (reports to Director)

**Talking point:** "This is what Lecture looks like when it's agent-first.
Each of these roles maps to a function your universities need."

### 2. Assign an Assessment Task (3 min)
Create a new issue in Paperclip:
- Title: "Review CS101 Midterm — Student #12345"
- Description: Include a sample submission text and rubric
- Assign to: Assessment Quality Agent

**Talking point:** "A professor creates a task. The agent picks it up
on its next heartbeat — no manual orchestration needed."

### 3. Watch the Agent Work (5 min)
Trigger a heartbeat for the Assessment Quality Agent.
Watch the run transcript in Paperclip — the agent:
- Reads the submission
- Applies the assessment-review skill
- Produces a structured evaluation
- Calls the HAST API to start the review workflow

**Talking point:** "Full observability. Every tool call logged.
Every decision traceable. This is the audit trail universities need."

### 4. Show the Review Workflow (3 min)
Open Temporal UI at localhost:8233.
Show the running ReviewWorkflow — it's waiting for a human signal.

Check the HAST API:
```bash
curl http://localhost:8000/api/submissions?status=review
```

Show the AI evaluation, then approve it:
```bash
curl -X POST http://localhost:8000/api/submissions/<id>/review \
  -H "Content-Type: application/json" \
  -d '{"decision": "approved", "reviewer_notes": "Good evaluation"}'
```

**Talking point:** "Durable workflows. If the server crashes, it resumes.
If the professor takes 3 days to review, it waits. No data loss."

### 5. Show Budgets & Governance (2 min)
Show cost tracking per agent in Paperclip.
Show that the Board can pause, override, or terminate any agent.

**Talking point:** "Universities need governance. This is built in —
not bolted on. Every agent has a budget ceiling."

### 6. The Vision (2 min)
"What you just saw is 4 agents for one institution.
Now imagine:
- 15 agents for a full university (add enrollment, financial aid, research)
- Company templates: download a 'K-12 template' or 'Corporate Training template'
- Each university gets their own Paperclip company — data isolation built in
- Custom skills per institution — Spanish universities get ANECA, US get SACSCOC
- KAG integration: your proprietary knowledge layer as a skill every agent can use"
```

- [ ] **Step 3: Create `README.md`**

```markdown
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

Proprietary — the Lecture maintainers. All rights reserved.
```

- [ ] **Step 4: Commit**

```bash
git add docs/ README.md
git commit -m "docs: add architecture, demo script, and README"
```

---

## Task 7: Integration Build + Smoke Test

**Depends on:** Tasks 1-6 all committed

**Files:** No new files — this task validates everything works together.

- [ ] **Step 1: Verify all files exist**

```bash
cd /path/to/lecture-agentic-ai
ls -la docker-compose.yml .env .env.example CLAUDE.md README.md LICENSE .gitignore
ls -la hermes/Dockerfile hermes/config.yaml
ls -la hermes/skills/assessment-review/SKILL.md hermes/skills/curriculum-compliance/SKILL.md
ls -la hermes/skills/enrollment-evaluation/SKILL.md hermes/skills/knowledge-augmentation/SKILL.md
ls -la hast/Dockerfile hast/requirements.txt hast/src/api.py hast/src/worker.py
ls -la hast/src/config.py hast/src/models.py hast/src/workflows/review_workflow.py
ls -la paperclip/Dockerfile paperclip/company-templates/higher-ed/company.json
ls -la infra/postgres/init-db.sql infra/postgres/init-multi-db.sh
ls -la docs/ARCHITECTURE.md docs/DEMO_SCRIPT.md
```

- [ ] **Step 2: Make init-multi-db.sh executable**

```bash
chmod +x infra/postgres/init-multi-db.sh
```

- [ ] **Step 3: Build all Docker images**

```bash
docker compose build 2>&1
```

If any service fails to build, fix the Dockerfile and retry. Common issues:
- Paperclip: `pnpm install` may need `--no-frozen-lockfile` if lockfile is missing in shallow clone
- Hermes: `hermes-agent` pip package may have a different name — check `pip install hermes-agent` output
- HAST: straightforward Python build, should work

- [ ] **Step 4: Start infrastructure services first**

```bash
docker compose up -d postgres
# Wait for postgres to be healthy
docker compose up -d temporal temporal-ui
# Wait for temporal to be healthy
```

- [ ] **Step 5: Start application services**

```bash
docker compose up -d hermes-gateway hast-api hast-worker paperclip
```

- [ ] **Step 6: Verify health endpoints**

```bash
# HAST API health
curl -s http://localhost:8000/health
# Expected: {"status":"ok","service":"hast-review"}

# Hermes Gateway health
curl -s http://localhost:8642/health
# Expected: 200 OK response

# Paperclip
curl -s http://localhost:3100
# Expected: HTML response (Paperclip UI)
```

- [ ] **Step 7: Test HAST end-to-end flow**

```bash
# Create a submission with pre-computed AI evaluation
curl -X POST http://localhost:8000/api/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "submission_type": "assessment",
    "entity_id": "student-12345",
    "context": {"course_id": "CS101"},
    "content": "My essay about the impact of AI on higher education...",
    "criteria": "Content relevance, critical thinking, writing quality",
    "ai_evaluation": {
      "overall_score": 78,
      "strengths": ["Good topic coverage", "Clear thesis statement"],
      "weaknesses": ["Lacks citations", "Could improve conclusion"],
      "feedback": "Solid work with room for improvement in academic rigor.",
      "reasoning": "The essay demonstrates understanding but needs stronger evidence."
    }
  }'

# Note the submission ID from the response, then check Temporal UI at localhost:8233
# The workflow should be in "review" state waiting for human signal

# List submissions in review status
curl -s http://localhost:8000/api/submissions?status=review

# Approve the submission (replace <submission-id> with actual ID)
curl -X POST http://localhost:8000/api/submissions/<submission-id>/review \
  -H "Content-Type: application/json" \
  -d '{"decision": "approved", "reviewer_notes": "Good evaluation, approved."}'

# Verify the submission is now approved
curl -s http://localhost:8000/api/submissions/<submission-id>
# Expected: status should be "approved"
```

- [ ] **Step 8: Verify Temporal workflow completed**

Open http://localhost:8233 in browser. The ReviewWorkflow should show as "Completed".

- [ ] **Step 9: Push to GitHub**

```bash
git push -u origin main
```

- [ ] **Step 10: Commit any fixes from integration testing**

If any fixes were needed during steps 3-8, commit them:

```bash
git add -A
git commit -m "fix: integration testing fixes for docker compose stack"
git push
```

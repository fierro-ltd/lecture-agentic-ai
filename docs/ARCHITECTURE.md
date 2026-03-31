# Lecture Agentic AI — Architecture

> Part of [EDT&Partners' Lecture platform](https://www.edtpartners.com/lecture) — extending Lecture with autonomous multi-agent capabilities.

## System Overview

Lecture Agentic AI is the agentic AI layer for EDT&Partners' [Lecture](https://www.edtpartners.com/lecture) platform. While Lecture provides GenAI capabilities like Content Chat, Questions Generator, and Evaluations & Rubrics, this component adds autonomous multi-agent orchestration — enabling AI agents to work independently on institutional tasks with human-in-the-loop governance.

Built on three open-source pillars (Paperclip, Hermes, Temporal) plus custom domain logic (HAST, education skills, company templates), the system runs as seven Docker Compose services backed by a single PostgreSQL instance hosting three databases.

```mermaid
graph TB
    subgraph "User-Facing"
        PUI["Paperclip UI<br/>(React, port 3100)"]
        TUI["Temporal UI<br/>(port 8233)"]
    end

    subgraph "Orchestration Layer"
        PAP["Paperclip Server<br/>Express.js<br/>Org chart, governance,<br/>budgets, heartbeats"]
    end

    subgraph "Agent Layer"
        HGA["Hermes Gateway<br/>OpenAI-compatible API<br/>(port 8642)"]
        ADA["hermes_local adapter<br/>(in Paperclip registry)"]
    end

    subgraph "Workflow Layer"
        API["HAST API<br/>FastAPI<br/>(port 8000)"]
        WRK["HAST Worker<br/>Temporal activities"]
        TMP["Temporal Server<br/>(port 7233)"]
    end

    subgraph "Data Layer"
        PG["PostgreSQL 17<br/>(port 5432)"]
        DB1["lecture_agent DB"]
        DB2["paperclip DB"]
        DB3["temporal DB"]
    end

    PUI --> PAP
    PAP -- "hermes_local adapter" --> ADA
    ADA --> HGA
    HGA -- "LLM inference" --> LLM["OpenCode Go GLM-5<br/>OpenRouter (vision)"]
    HGA -- "assessment-review skill" --> API
    API -- "start/signal workflow" --> TMP
    TMP -- "dispatch activities" --> WRK
    WRK -- "read/write" --> PG
    API -- "read/write" --> PG
    PAP -- "read/write" --> PG
    TMP -- "state storage" --> PG
    TUI --> TMP
    PG --- DB1
    PG --- DB2
    PG --- DB3
```

## Communication Patterns

### Paperclip to Hermes (Task Dispatch)

Paperclip manages an org chart of AI agents. Each agent has an `adapterType: hermes_local` entry that maps it to the built-in Hermes adapter in Paperclip's registry. When a task is assigned and a heartbeat fires, Paperclip calls Hermes Gateway's OpenAI-compatible chat completions endpoint with the agent's configured model, toolsets, and the task prompt.

```mermaid
sequenceDiagram
    participant P as Paperclip
    participant A as hermes_local adapter
    participant H as Hermes Gateway :8642

    P->>A: dispatch task (agent config + prompt)
    A->>H: POST /v1/chat/completions
    H-->>A: streamed response (tool calls, text)
    A-->>P: task result
```

### Hermes Skill to HAST API (Submission)

When an agent uses the `assessment-review` skill, the skill instructions tell the agent to POST to the HAST API. This triggers a Temporal workflow.

```mermaid
sequenceDiagram
    participant H as Hermes Agent
    participant HAST as HAST API :8000
    participant T as Temporal Server
    participant W as HAST Worker

    H->>HAST: POST /api/submissions
    HAST->>HAST: Insert row (status=evaluating or review)
    HAST->>T: StartWorkflow(ReviewWorkflow)
    HAST-->>H: 200 {id, workflow_id}
    T->>W: Schedule evaluate_submission activity
    W->>W: Call Hermes Gateway for AI eval (if needed)
    W->>HAST: update_submission_status -> review
    Note over T: Workflow waits for human signal
```

### HAST API to Temporal (Signal Flow)

Human review decisions arrive via REST and are forwarded as Temporal signals.

```mermaid
sequenceDiagram
    participant R as Reviewer
    participant HAST as HAST API
    participant T as Temporal Server
    participant W as HAST Worker

    R->>HAST: POST /api/submissions/{id}/review
    HAST->>T: Signal(review_decision)
    T->>W: Schedule record_review_decision activity
    W->>W: Update DB (approved/rejected/revision_requested)
    T-->>T: Workflow completes
```

## Assessment Review Data Flow

End-to-end flow from professor request to final decision:

```mermaid
sequenceDiagram
    actor Prof as Professor
    participant P as Paperclip
    participant Agent as Assessment Quality Agent
    participant H as Hermes Gateway
    participant HAST as HAST API
    participant T as Temporal
    participant W as HAST Worker
    participant DB as PostgreSQL

    Prof->>P: Create task: "Review CS101 midterm #42"
    P->>P: Assign to Assessment Quality Agent
    Note over Agent: Heartbeat fires (every 2h)
    P->>Agent: Dispatch task via hermes_local adapter
    Agent->>H: LLM inference (evaluate submission)
    H-->>Agent: Structured evaluation JSON
    Agent->>HAST: POST /api/submissions (with ai_evaluation)
    HAST->>DB: INSERT hast_submissions (status=review)
    HAST->>T: StartWorkflow(ReviewWorkflow)
    HAST-->>Agent: {id, workflow_id}
    Agent-->>P: Task complete - submitted for review

    Note over T: Workflow waiting (up to 7 days)

    Prof->>HAST: POST /api/submissions/{id}/review (approved)
    HAST->>T: Signal(review_decision)
    T->>W: record_review_decision activity
    W->>DB: UPDATE status=approved
    T-->>T: Workflow completes
```

## ReviewWorkflow States

```mermaid
stateDiagram-v2
    [*] --> Evaluating: Submission created (no ai_evaluation)
    [*] --> Review: Submission created (with ai_evaluation)

    Evaluating --> Review: AI evaluation complete
    Review --> Approved: Human approves
    Review --> Rejected: Human rejects
    Review --> RevisionRequested: Human requests revision
    Review --> Expired: Timeout (7 days)

    Approved --> [*]
    Rejected --> [*]
    RevisionRequested --> [*]
    Expired --> [*]
```

## Technology Rationale

| Component | Technology | Why |
|-----------|-----------|-----|
| Orchestration | Paperclip (Node.js/React) | Multi-agent governance out of the box -- org charts, budgets, heartbeats, task tracking. Already has a `hermes_local` adapter in its registry. |
| Agent Runtime | Hermes (Python) | Persistent memory, tool use, skill system via SKILL.md files. OpenAI-compatible gateway simplifies integration. |
| Workflow Engine | Temporal | Durable execution survives crashes. Built-in signal/query support maps naturally to human-in-the-loop approval. Timeout handling is declarative. |
| API Layer | FastAPI | Async Python, automatic OpenAPI docs, Pydantic validation. Matches Temporal's Python SDK. |
| Database | PostgreSQL 17 | Single instance, three databases. Temporal requires Postgres. Paperclip requires Postgres. HAST needs relational storage for submissions. |
| LLM Provider | OpenCode Go (GLM-5) | Cost-effective text model for education domain. Vision via OpenRouter Gemini Flash Lite for multimodal tasks. |

## Security Model

**Current state (PoC):**

- **Network isolation**: All services communicate over a Docker Compose internal network. Only mapped ports are exposed to the host.
- **API key gating**: Hermes Gateway requires `API_SERVER_KEY` for all requests. HAST and Paperclip pass the key via `HERMES_API_KEY`.
- **Auth on Paperclip**: Paperclip runs in `authenticated` mode with `BETTER_AUTH_SECRET` for session signing. Exposure is set to `private`.
- **CORS**: HAST API currently allows all origins (`*`) -- acceptable for local PoC, must be locked down for production.
- **Secrets**: All API keys and passwords are passed via environment variables (`.env` file, not committed).
- **Database**: Single shared PostgreSQL user for simplicity. Production should use per-database roles with least-privilege grants.

**Production hardening checklist:**

1. Replace CORS `*` with explicit allowed origins
2. Add API key authentication to HAST API endpoints
3. Create separate PostgreSQL roles per database
4. Put a reverse proxy (Caddy) in front with TLS termination
5. Enable Temporal's mTLS for server-worker communication
6. Rotate `BETTER_AUTH_SECRET` and `HERMES_API_KEY` regularly
7. Run containers as non-root users

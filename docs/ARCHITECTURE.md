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

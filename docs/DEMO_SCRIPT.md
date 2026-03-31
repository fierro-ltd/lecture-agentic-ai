# Lecture Agentic AI — Demo Script for EDT&Partners

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
"What you just saw is Lecture's agentic AI layer — autonomous agents added to
a platform already proven at Deusto, Luxembourg, UFV, ESIC, and EOI.

Lecture already delivers Content Chat, Questions Generator, Evaluations & Rubrics,
In-doc Translation, and more. Now imagine adding:
- 15 agents per university (assessment, enrollment, financial aid, research)
- Company templates: 'K-12 template', 'Corporate Training template'
- Each institution gets their own agent org chart — data isolation built in
- Custom skills per institution — Spanish universities get ANECA, US get SACSCOC
- KAG integration: EDT's proprietary knowledge layer as a skill every agent uses

This is Lecture's next evolution — from tools to autonomous agents."

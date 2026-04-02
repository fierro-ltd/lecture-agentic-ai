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

## CLI Demo

A self-contained walkthrough of the full submission-to-review lifecycle using the shell scripts in `scripts/`.

### Step 1 — Create a submission

```bash
./scripts/demo-routine.sh
```

This POSTs a sample essay submission with a pre-populated AI evaluation to the HAST API at `http://localhost:8000`. On success it prints the new submission ID and tells you the next command to run.

You can override the target URL and API key:

```bash
./scripts/demo-routine.sh http://localhost:8000 edu-platform-test-key-2026
```

### Step 2 — Open the reviewer UI

Navigate to **http://localhost:3200** to see the pending submission in the human-in-the-loop review queue. The Temporal workflow is paused, waiting for a signal.

You can also confirm the submission is waiting via the API:

```bash
curl -s http://localhost:8000/api/submissions?status=review | python3 -m json.tool
```

### Step 3 — Approve the submission

Take the `<SUBMISSION_ID>` printed in Step 1 and run:

```bash
./scripts/demo-review.sh <SUBMISSION_ID>
```

The default decision is `approved`. To reject or flag instead:

```bash
./scripts/demo-review.sh <SUBMISSION_ID> rejected
./scripts/demo-review.sh <SUBMISSION_ID> needs_revision
```

### Step 4 — Verify in Temporal UI

Open **http://localhost:8233** and locate the `ReviewWorkflow` run for the submission. It should now show as `Completed`. The workflow received the human signal and progressed to its final state — demonstrating durable execution across the full lifecycle.

## Demo UI Walkthrough

The Demo UI at http://localhost:3200 provides a self-contained demo of the full pipeline.

### Overview
1. Open http://localhost:3200
2. Enter API key in the sidebar config
3. Browse the **Overview** section to understand the architecture

### Live Demo
4. Click **Live Demo** in the sidebar
5. The submission form is pre-filled with a sample essay — click **Submit for AI Evaluation**
6. Watch the pipeline visualization show each step:
   - 📥 Submitted → 🤖 AI Evaluation → ⚖️ Human Review → ✅ Complete
7. When the pipeline reaches "Human Review", approve or reject the submission
8. See the final result with the decision recorded

### Review Queue
9. Click **Review Queue** in the sidebar to see all submissions
10. Filter by status: Pending, Approved, Rejected, or All
11. Click any submission to see its full details and AI evaluation

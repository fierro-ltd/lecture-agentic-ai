---
name: institutional-review-workflows
description: >
  Evaluate institutional artifacts (academic submissions, clinical documentation,
  enrollment applications, curriculum compliance) against structured criteria.
  Produce scored feedback and route through HAST human-in-the-loop review where
  applicable. Covers assessment review, clinical documentation review, enrollment
  evaluation, and curriculum compliance.
version: 1.0.0
author: the Lecture maintainers
metadata:
  hermes:
    tags: [Education, Healthcare, Assessment, Compliance, Human-in-the-Loop, HAST]
triggers:
  - review submission
  - grade assignment
  - evaluate student work
  - assessment quality check
  - review clinical documentation
  - evaluate clinical note
  - review discharge summary
  - review procedure report
  - documentation quality check
  - clinical documentation audit
  - evaluate enrollment application
  - check admission eligibility
  - prerequisite verification
  - application screening
  - check curriculum compliance
  - accreditation review
  - syllabus audit
  - learning objectives alignment
tools_required:
  - web
  - file
  - terminal
---

# Institutional Review Workflows

## Purpose

You are an institutional review agent. You evaluate artifacts — academic
submissions, clinical documentation, enrollment applications, or curriculum
materials — against structured criteria, produce scored feedback, and (where
applicable) submit evaluations for human review via the HAST workflow service.

This skill covers four review domains. Each follows the same core pattern but
with domain-specific criteria and output schemas. Domain-specific details live
in the `references/` directory; this SKILL.md covers the shared workflow and
integration.

## Core Workflow (all domains)

1. **Receive** the artifact content and applicable criteria from the task
2. **Identify** the domain and load the appropriate criteria
3. **Analyze** the artifact against each criterion with specific evidence
4. **Produce** a structured evaluation (see domain sections below for schemas)
5. **Submit** to HAST API for human review (assessment, clinical, enrollment)
   — or — report directly (curriculum compliance)
6. **Report** findings back, including any HAST submission ID

## Domain Workflows

### 1. Academic Assessment Review

Evaluates student submissions against rubrics. Produces scores per criterion
with strengths, weaknesses, and improvement suggestions.

**Output schema:**
```json
{
  "overall_score": 0-100,
  "criterion_scores": [
    {"criterion": "<name>", "score": 0-100, "weight": 0.0-1.0, "feedback": "<specific>"}
  ],
  "strengths": ["..."],
  "weaknesses": ["..."],
  "improvement_suggestions": ["..."],
  "reasoning": "<detailed reasoning>"
}
```
**HAST submission_type:** `"assessment"`

**Detailed workflow and quality standards:** see `references/assessment-review.md`

### 2. Clinical Documentation Review

Evaluates H&P notes, discharge summaries, and procedure reports against
clinical documentation quality standards. Flags safety-relevant omissions.

**Output schema:**
```json
{
  "overall_score": 0-100,
  "document_type": "hp_note | discharge_summary | procedure_report",
  "criterion_scores": [
    {"criterion": "<name>", "score": 0-100, "weight": 0.0-1.0, "feedback": "<specific>"}
  ],
  "findings": ["..."],
  "recommendations": ["..."],
  "flags": ["<items requiring immediate attention>"],
  "reasoning": "<detailed reasoning>"
}
```
**HAST submission_type:** `"clinical_documentation_review"`

**Detailed criteria weights by document type:** see `references/clinical-documentation-review.md`

### 3. Enrollment Evaluation

Screens student enrollment applications against admission criteria. Verifies
prerequisites, document completeness, and eligibility.

**Output schema:**
```json
{
  "applicant_id": "<id>",
  "program_id": "<target program>",
  "recommendation": "admit | conditional | waitlist | deny",
  "document_checklist": [{"document": "<name>", "status": "received|missing|invalid"}],
  "prerequisites": [{"requirement": "<name>", "status": "met|not_met|in_progress"}],
  "eligibility_score": 0-100,
  "flags": ["<any concerns>"],
  "reasoning": "<explanation>"
}
```
**HAST submission_type:** `"enrollment"`

**Important:** Never make final admit/deny decisions — always route to human
review. Respect FERPA/GDPR; do not include PII in task updates.

**Detailed workflow:** see `references/enrollment-evaluation.md`

### 4. Curriculum Compliance Check

Reviews course materials against accreditation standards (ABET, SACSCOC, ANECA,
QAA, etc.) and institutional requirements. Produces compliance reports with
gap analysis.

**Output schema:**
```json
{
  "course_id": "<id>",
  "framework": "<accreditation body>",
  "overall_compliance": "compliant | partial | non-compliant",
  "coverage_score": 0-100,
  "criteria_mapping": [
    {
      "standard": "<code>",
      "description": "<what it requires>",
      "status": "met | partial | missing",
      "evidence": "<where in syllabus>",
      "gap_description": "<if partial/missing>"
    }
  ],
  "recommendations": ["..."]
}
```
**No HAST integration** — compliance reports are returned directly.

**Regional standards reference:** see `references/curriculum-compliance.md`

## HAST API Integration

The HAST (Human-Review Augmented Skill Transfer) service provides human-in-the-loop
review for assessment, clinical documentation, and enrollment workflows.

**Endpoint:**
```bash
curl -X POST http://hast-api:8000/api/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "submission_type": "<assessment|clinical_documentation_review|enrollment>",
    "entity_id": "<student_id|document_id|applicant_id>",
    "context": {"course_id": "...", "department": "...", "program_id": "..."},
    "content": "<artifact content>",
    "criteria": "<rubric text or standards>",
    "ai_evaluation": <evaluation JSON>
  }'
```

**Workflow behavior:**
- After submission, a Temporal workflow starts automatically
- The human reviewer (professor / clinician / admissions officer) reviews via HAST
- The workflow waits up to 7 days for review before expiring
- Always report the HAST submission ID back to the user

## Shared Quality Standards

- Never assign a score without specific evidence from the artifact
- Reference exact quotes, sections, or data points when providing feedback
- Flag edge cases and safety concerns explicitly rather than making assumptions
- When uncertain about a criterion, note the ambiguity in your reasoning
- Respect domain conventions (e.g., don't penalize a discharge summary for lacking
  H&P structure; don't penalize an essay for lacking quiz-style answers)
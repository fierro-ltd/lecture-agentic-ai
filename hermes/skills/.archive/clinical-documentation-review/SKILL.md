---
name: clinical-documentation-review
description: >
  Review clinical documentation (H&P notes, discharge summaries, procedure reports)
  against clinical documentation quality standards. Produces structured feedback
  with scores, findings, and recommendations. Integrates with the HAST workflow
  service for human-in-the-loop clinician review.
version: 1.0.0
author: the Lecture maintainers
metadata:
  hermes:
    tags: [Healthcare, Clinical Documentation, Quality, Human-in-the-Loop]
triggers:
  - review clinical documentation
  - evaluate clinical note
  - review discharge summary
  - review procedure report
  - documentation quality check
  - clinical documentation audit
tools_required:
  - web
  - file
  - terminal
---

# Clinical Documentation Review Skill

## Purpose
You are a clinical documentation quality agent. Your role is to evaluate clinical documents — including History & Physical (H&P) notes, discharge summaries, and procedure reports — against established documentation quality standards, produce structured feedback, and submit the evaluation for human (clinician) review via the HAST workflow service.

## Workflow

1. **Receive** the clinical document and document type from the task description
2. **Identify** the appropriate quality criteria for the document type:
   - **H&P Notes**: chief complaint, history of present illness, past medical/surgical/family/social history, review of systems, physical examination findings, assessment, plan
   - **Discharge Summaries**: admission diagnosis, hospital course summary, procedures performed, discharge condition, discharge medications, follow-up instructions, pending results
   - **Procedure Reports**: indication, procedure description, findings, complications, specimens, post-procedure plan
3. **Analyze** the document against each quality criterion
4. **Produce** a structured evaluation in the following JSON format:

```json
{
  "overall_score": 0-100,
  "document_type": "hp_note | discharge_summary | procedure_report",
  "criterion_scores": [
    {
      "criterion": "<name>",
      "score": 0-100,
      "weight": 0.0-1.0,
      "feedback": "<specific feedback referencing document content>"
    }
  ],
  "findings": ["<specific finding 1>", "<specific finding 2>"],
  "recommendations": ["<recommendation 1>", "<recommendation 2>"],
  "flags": ["<item requiring immediate clinician attention if any>"],
  "reasoning": "<detailed reasoning for the overall score>"
}
```

5. **Submit** the evaluation to the HAST API for clinician review:

```bash
curl -X POST http://hast-api:8000/api/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "submission_type": "clinical_documentation_review",
    "entity_id": "<document_id from task>",
    "context": {"department": "<from task>", "document_type": "<hp_note|discharge_summary|procedure_report>"},
    "content": "<document content>",
    "criteria": "<quality standards applied>",
    "ai_evaluation": <your evaluation JSON>
  }'
```

6. **Report** back that the evaluation has been submitted for clinician review.
   Include the submission ID from the HAST API response.

## Quality Criteria Weights by Document Type

### H&P Note (default weights)
| Criterion | Weight |
|-----------|--------|
| Chief Complaint | 0.10 |
| History of Present Illness | 0.20 |
| Past Medical/Surgical/Family/Social History | 0.15 |
| Review of Systems | 0.15 |
| Physical Examination | 0.20 |
| Assessment | 0.10 |
| Plan | 0.10 |

### Discharge Summary (default weights)
| Criterion | Weight |
|-----------|--------|
| Admission Diagnosis | 0.10 |
| Hospital Course | 0.25 |
| Procedures Performed | 0.15 |
| Discharge Condition | 0.10 |
| Discharge Medications | 0.20 |
| Follow-up Instructions | 0.15 |
| Pending Results | 0.05 |

### Procedure Report (default weights)
| Criterion | Weight |
|-----------|--------|
| Indication | 0.15 |
| Procedure Description | 0.30 |
| Findings | 0.25 |
| Complications | 0.15 |
| Post-Procedure Plan | 0.15 |

## Quality Standards
- Never assign a score without specific evidence from the document
- Reference exact sections or missing sections when providing feedback
- Flag any safety-relevant omissions (allergies, critical findings, medication discrepancies) in the `flags` field
- Do not make clinical judgments about the accuracy of diagnoses or treatment plans
- When a section is entirely missing, score it 0 and note it as missing in findings
- Respect document type conventions — do not penalize a discharge summary for lacking H&P structure

## Integration Notes
- The HAST API is at `http://hast-api:8000` inside Docker network
- After submission, a Temporal workflow starts automatically
- The clinician reviews via the HAST API and approves/rejects
- The workflow waits up to 7 days for clinician review before expiring
- Use `submission_type: "clinical_documentation_review"` for all submissions from this skill

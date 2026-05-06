#!/usr/bin/env bash
# Demo: Submit a sample submission for review via the HAST API.
# Usage: ./scripts/demo-routine.sh [API_URL] [API_KEY]

set -euo pipefail

API_URL="${1:-http://localhost:8000}"
API_KEY="${2:-edu-platform-test-key-2026}"

echo "=== Submitting sample submission to HAST API ==="
echo "URL: $API_URL"

RESPONSE=$(curl -s -X POST "$API_URL/api/submissions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "submission_type": "assessment",
    "entity_id": "entity-demo-001",
    "content": "This essay examines the impact of artificial intelligence on modern healthcare delivery systems. AI-powered diagnostics have shown promising results in radiology, pathology, and genomics. However, ethical considerations around data privacy, algorithmic bias, and the doctor-patient relationship remain significant challenges that must be addressed before widespread adoption.",
    "criteria": "Evaluate for: clarity of argument (30%), evidence quality (30%), critical analysis (20%), writing quality (20%)",
    "ai_evaluation": {
      "overall_score": 72,
      "criterion_scores": {
        "clarity_of_argument": 22,
        "evidence_quality": 18,
        "critical_analysis": 16,
        "writing_quality": 16
      },
      "strengths": ["Clear thesis statement", "Relevant topic selection", "Good structural organization"],
      "weaknesses": ["Limited supporting evidence", "Needs deeper critical analysis", "Missing counterarguments"],
      "feedback": "The submission demonstrates understanding of the topic but needs more depth in analysis and evidence."
    },
    "context": {"course_id": "CS-401", "assignment": "Final Essay"}
  }')

echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

SUBMISSION_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || true)

if [ -n "$SUBMISSION_ID" ]; then
  echo ""
  echo "=== Submission created ==="
  echo "ID: $SUBMISSION_ID"
  echo "Review URL: http://localhost:3200"
  echo ""
  echo "To approve this submission, run:"
  echo "  ./scripts/demo-review.sh $SUBMISSION_ID"
fi

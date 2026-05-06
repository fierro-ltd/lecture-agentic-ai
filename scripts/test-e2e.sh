#!/bin/bash
set -euo pipefail

# End-to-end test for Lecture Agentic AI
# Tests the HAST review workflow: create → review → approve
# Usage: ./scripts/test-e2e.sh [HAST_URL]

HAST_URL="${1:-https://lecture-agentic-ai.fierro.co.uk/hast}"

echo "=== Lecture Agentic AI — E2E Test ==="
echo "HAST API: $HAST_URL"

# Health check
echo -n "Health check... "
if ! curl -sf "$HAST_URL/health" -o /dev/null; then
  echo "FAILED"
  echo "ERROR: HAST service is not healthy at $HAST_URL"
  exit 1
fi
echo "OK"

# Create submission with pre-computed evaluation
echo ""
echo "=== Step 1: Create submission ==="
RESULT=$(curl -sf -X POST "$HAST_URL/api/submissions" \
  -H "Content-Type: application/json" \
  -d '{
    "submission_type": "assessment",
    "entity_id": "student-e2e-test",
    "context": {"course_id": "CS101", "test": "e2e"},
    "content": "AI is transforming higher education by enabling personalized learning, automating assessment, and providing real-time feedback to students.",
    "criteria": "Content relevance (30%), Critical thinking (30%), Writing quality (20%), Citations (20%)",
    "ai_evaluation": {
      "overall_score": 78,
      "criterion_scores": [
        {"criterion": "Content relevance", "score": 85, "weight": 0.3, "feedback": "Good coverage of AI in education"},
        {"criterion": "Critical thinking", "score": 72, "weight": 0.3, "feedback": "Could explore counterarguments"},
        {"criterion": "Writing quality", "score": 80, "weight": 0.2, "feedback": "Clear and well-structured"},
        {"criterion": "Citations", "score": 65, "weight": 0.2, "feedback": "Needs more academic references"}
      ],
      "strengths": ["Clear thesis statement", "Good topic coverage", "Well-structured paragraphs"],
      "weaknesses": ["Lacks academic citations", "Could explore counterarguments", "Conclusion is brief"],
      "improvement_suggestions": ["Add 3-5 peer-reviewed citations", "Discuss potential risks of AI in education"],
      "reasoning": "The essay demonstrates solid understanding of AI in education but needs stronger academic rigor."
    }
  }')

SUB_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
STATUS=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
echo "Created submission: $SUB_ID"
echo "Status: $STATUS"

if [ "$STATUS" != "review" ]; then
  echo "ERROR: Expected status 'review', got '$STATUS'"
  exit 1
fi

# Wait for Temporal workflow to pick up
echo ""
echo "=== Step 2: Waiting for workflow... ==="
sleep 5

# Check it's still in review
CHECK_STATUS=$(curl -sf "$HAST_URL/api/submissions/$SUB_ID" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
echo "Status after 5s: $CHECK_STATUS"

# Approve
echo ""
echo "=== Step 3: Professor approves ==="
REVIEW_RESULT=$(curl -sf -X POST "$HAST_URL/api/submissions/$SUB_ID/review" \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "approved",
    "reviewer_notes": "Good evaluation. The AI correctly identified the lack of citations as a weakness. Approved with minor adjustments.",
    "adjusted_score": 80
  }')
echo "$REVIEW_RESULT"

# Wait for workflow to complete
sleep 5

# Verify final status
echo ""
echo "=== Step 4: Verify final status ==="
FINAL=$(curl -sf "$HAST_URL/api/submissions/$SUB_ID")
FINAL_STATUS=$(echo "$FINAL" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
FINAL_DECISION=$(echo "$FINAL" | python3 -c "import sys,json; print(json.load(sys.stdin)['review_decision'])")
FINAL_NOTES=$(echo "$FINAL" | python3 -c "import sys,json; print(json.load(sys.stdin)['reviewer_notes'])")

echo "Final status: $FINAL_STATUS"
echo "Decision: $FINAL_DECISION"
echo "Notes: $FINAL_NOTES"

if [ "$FINAL_STATUS" = "approved" ] && [ "$FINAL_DECISION" = "approved" ]; then
  echo ""
  echo "=== E2E TEST PASSED ==="
else
  echo ""
  echo "=== E2E TEST FAILED ==="
  echo "Expected: status=approved, decision=approved"
  echo "Got: status=$FINAL_STATUS, decision=$FINAL_DECISION"
  exit 1
fi

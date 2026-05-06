#!/usr/bin/env bash
# Demo: Submit a review decision via the HAST API.
# Usage: ./scripts/demo-review.sh <SUBMISSION_ID> [DECISION] [API_URL] [API_KEY]

set -euo pipefail

SUBMISSION_ID="${1:?Usage: $0 <SUBMISSION_ID> [DECISION] [API_URL] [API_KEY]}"
DECISION="${2:-approved}"
API_URL="${3:-http://localhost:8000}"
API_KEY="${4:-edu-platform-test-key-2026}"

echo "=== Submitting review decision: $DECISION ==="
echo "Submission: $SUBMISSION_ID"

RESPONSE=$(curl -s -X POST "$API_URL/api/submissions/$SUBMISSION_ID/review" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"decision\": \"$DECISION\",
    \"reviewer_notes\": \"Reviewed via demo script. Decision: $DECISION.\",
    \"adjusted_score\": 75
  }")

echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""
echo "=== Review submitted ==="

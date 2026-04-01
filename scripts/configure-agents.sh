#!/bin/bash
set -euo pipefail

# Configure Lecture Agentic AI agents on the production server
# Usage: ./scripts/configure-agents.sh [BASE_URL]
# Default: https://lecture-agentic-ai.fierro.co.uk

BASE_URL="${1:-https://lecture-agentic-ai.fierro.co.uk}"
EMAIL="${PAPERCLIP_EMAIL:-admin@edtpartners.com}"
PASSWORD="${PAPERCLIP_PASSWORD:-LectureAgent2026!}"

echo "=== Configuring agents at $BASE_URL ==="

# Get session cookie
echo "Logging in..."
COOKIE_JAR=$(mktemp)
curl -sf -c "$COOKIE_JAR" -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}" > /dev/null

# List agents to get their IDs
echo "Fetching agents..."
AGENTS=$(curl -sf -b "$COOKIE_JAR" "$BASE_URL/api/agents" | python3 -c "
import json, sys
agents = json.load(sys.stdin)
for a in agents:
    print(f\"{a['id']}|{a['name']}|{a['slug']}\")
")

echo "Found agents:"
echo "$AGENTS"

echo ""
echo "=== Agent configuration complete ==="
echo "Next: Create a test issue via the Paperclip UI and trigger a heartbeat"

rm -f "$COOKIE_JAR"

#!/bin/bash
set -euo pipefail

# Configure Lecture Agentic AI agents on the production server
# Usage: PAPERCLIP_EMAIL=... PAPERCLIP_PASSWORD=... ./scripts/configure-agents.sh [BASE_URL]
# Default: https://lecture-agentic-ai.fierro.co.uk

BASE_URL="${1:-https://lecture-agentic-ai.fierro.co.uk}"
EMAIL="${PAPERCLIP_EMAIL:?PAPERCLIP_EMAIL env var must be set}"
PASSWORD="${PAPERCLIP_PASSWORD:?PAPERCLIP_PASSWORD env var must be set}"

echo "=== Configuring agents at $BASE_URL ==="

# Get session cookie
echo "Logging in as $EMAIL..."
COOKIE_JAR=$(mktemp)
trap "rm -f $COOKIE_JAR" EXIT

if ! curl -sf -c "$COOKIE_JAR" -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}" > /dev/null; then
  echo "ERROR: Login failed. Check PAPERCLIP_EMAIL and PAPERCLIP_PASSWORD."
  exit 1
fi

# List agents to get their IDs
echo "Fetching agents..."
AGENTS=$(curl -sf -b "$COOKIE_JAR" "$BASE_URL/api/agents" | python3 -c "
import json, sys
agents = json.load(sys.stdin)
for a in agents:
    print(f\"{a['id']}|{a['name']}|{a['slug']}|{a.get('role','')}\")
")

echo "Found agents:"
echo "$AGENTS"
echo ""

# Verify we have exactly 4 agents
AGENT_COUNT=$(echo "$AGENTS" | wc -l | tr -d ' ')
if [ "$AGENT_COUNT" -lt 4 ]; then
  echo "WARNING: Expected 4 agents, found $AGENT_COUNT"
  echo "Create missing agents via the Paperclip UI first."
fi

echo "=== Agent listing complete ==="
echo ""
echo "Agents are configured via the Paperclip UI. Use the company template"
echo "at paperclip/company-templates/higher-ed/company.json as reference."
echo ""
echo "To test the HAST workflow: ./scripts/test-e2e.sh $BASE_URL/hast"

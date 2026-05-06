#!/bin/bash
set -e

# Create Hermes .env from container environment variables
# ONLY pass OpenCode Go key for text model (GLM-5).
# OpenRouter key is intentionally NOT passed here to prevent
# GLM-5 text calls from falling back to OpenRouter (which costs credits).
# Vision calls (google/gemini-3.1-flash-lite-preview) are configured
# separately in hermes/config.yaml under the vision section.
mkdir -p /root/.hermes
cat > /root/.hermes/.env << EOF
OPENCODE_GO_API_KEY=${OPENCODE_GO_API_KEY}
EOF

# Run the Paperclip server
exec node --import ./server/node_modules/tsx/dist/loader.mjs server/dist/index.js

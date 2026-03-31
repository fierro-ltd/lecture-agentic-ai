#!/bin/bash
set -e

# Create Hermes .env from container environment variables
# The hermes_local adapter spawns `hermes chat -q` which needs these
mkdir -p /root/.hermes
cat > /root/.hermes/.env << EOF
OPENCODE_GO_API_KEY=${OPENCODE_GO_API_KEY}
OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
EOF

# Run the Paperclip server
exec node --import ./server/node_modules/tsx/dist/loader.mjs server/dist/index.js

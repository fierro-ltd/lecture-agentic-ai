#!/bin/bash
set -euo pipefail

# Lecture Agent — Hetzner Deployment Script
# Prerequisites: Docker, Docker Compose, Caddy installed on the server
# Usage: ./deploy.sh

REPO_DIR="/opt/lecture-agentic-ai"
COMPOSE_FILES="-f docker-compose.yml -f infra/hetzner/docker-compose.production.yml"

echo "=== Lecture Agent Deployment ==="

# Pull latest code
cd "$REPO_DIR"
git pull origin main

# Copy Caddy config
sudo cp infra/hetzner/Caddyfile /etc/caddy/Caddyfile

# Build and start services
docker compose $COMPOSE_FILES up -d --build

# Restart Caddy for HTTPS
sudo systemctl restart caddy

# Wait for services
echo "Waiting for services to start..."
sleep 15

# Health checks
echo "=== Health Checks ==="
echo -n "HAST API: "
curl -sf http://localhost:8000/health && echo " OK" || echo " FAILED"

echo -n "Paperclip: "
curl -sf http://localhost:3100 > /dev/null && echo " OK" || echo " FAILED"

echo -n "Temporal: "
curl -sf http://localhost:8233 > /dev/null && echo " OK" || echo " FAILED"

echo ""
echo "=== Deployment Complete ==="
echo "Paperclip UI: https://lecture-agentic-ai.fierro.co.uk"
echo "HAST API:     https://lecture-agentic-ai.fierro.co.uk:8443"
echo "Temporal UI:  https://lecture-agentic-ai.fierro.co.uk:2087"

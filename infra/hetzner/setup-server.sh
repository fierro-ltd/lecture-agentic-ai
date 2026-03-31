#!/bin/bash
set -euo pipefail

# Lecture Agent — Hetzner Server Setup (run once)
# Tested on: Ubuntu 24.04 LTS (Hetzner Cloud)

echo "=== Lecture Agent Server Setup ==="

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install -y docker-compose-plugin

# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy

# Install Git
sudo apt install -y git

# Clone repo
sudo mkdir -p /opt/lecture-agent
sudo chown $USER:$USER /opt/lecture-agent
git clone git@github.com:fierro-ltd/lecture-agent.git /opt/lecture-agent

# Setup env
cd /opt/lecture-agent
cp .env.example .env
echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Edit /opt/lecture-agent/.env with your API keys"
echo "2. Point DNS: lecture-agent.fierro.co.uk -> this server's IP"
echo "3. Run: cd /opt/lecture-agent && ./infra/hetzner/deploy.sh"

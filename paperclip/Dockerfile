FROM node:lts-trixie-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     ca-certificates curl git python3 python3-pip python3-venv ripgrep gcc python3-dev libffi-dev \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

# Clone and install Paperclip
FROM base AS deps
WORKDIR /app
RUN git clone --depth 1 https://github.com/paperclipai/paperclip.git /app
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app /app
RUN pnpm --filter @paperclipai/ui build
RUN pnpm --filter @paperclipai/plugin-sdk build
RUN pnpm --filter @paperclipai/server build
RUN test -f server/dist/index.js || (echo "ERROR: server build output missing" && exit 1)

FROM base AS production
WORKDIR /app
COPY --from=build /app /app

# Install Hermes Agent from GitHub (required by hermes_local adapter which spawns hermes chat -q)
RUN pip3 install --break-system-packages --no-cache-dir "hermes-agent @ git+https://github.com/NousResearch/hermes-agent.git"

# Create Paperclip data directory
RUN mkdir -p /paperclip && chown node:node /paperclip

# Create Hermes config directory (for adapter to read config.yaml)
RUN mkdir -p /root/.hermes/skills

# Copy company templates and entrypoint
COPY paperclip/company-templates/ /app/company-templates/
COPY paperclip/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV NODE_ENV=production \
  HOME=/paperclip \
  HOST=0.0.0.0 \
  PORT=3100 \
  SERVE_UI=true \
  PAPERCLIP_HOME=/paperclip \
  PAPERCLIP_INSTANCE_ID=default \
  PAPERCLIP_CONFIG=/paperclip/instances/default/config.json \
  PAPERCLIP_DEPLOYMENT_MODE=authenticated \
  PAPERCLIP_DEPLOYMENT_EXPOSURE=private

VOLUME ["/paperclip"]
EXPOSE 3100

CMD ["/app/entrypoint.sh"]

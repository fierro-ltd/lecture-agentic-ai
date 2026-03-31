FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ripgrep gcc python3-dev libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Hermes Agent
RUN pip install --no-cache-dir hermes-agent

# Create Hermes home directory structure
ENV HERMES_HOME=/root/.hermes
RUN mkdir -p $HERMES_HOME/skills $HERMES_HOME/sessions $HERMES_HOME/logs $HERMES_HOME/memories

# Copy configuration and skills
COPY config.yaml $HERMES_HOME/config.yaml
COPY skills/ $HERMES_HOME/skills/

EXPOSE 8642

# Run Hermes in gateway mode (exposes OpenAI-compatible API on :8642)
CMD ["hermes", "gateway", "run"]

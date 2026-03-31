#!/bin/bash
set -e

# Create additional databases (default DB is lecture_agent via POSTGRES_DB)
# init-hast.sql runs automatically via Postgres init runner — no explicit call needed
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE paperclip;
    CREATE DATABASE temporal;
    CREATE DATABASE temporal_visibility;
EOSQL

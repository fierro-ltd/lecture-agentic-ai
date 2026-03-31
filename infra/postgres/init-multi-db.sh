#!/bin/bash
set -e

# Create additional databases (default DB is lecture_agent via POSTGRES_DB)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE paperclip;
    CREATE DATABASE temporal;
    CREATE DATABASE temporal_visibility;
EOSQL

# Run HAST schema in lecture_agent database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/init-hast.sql

#!/usr/bin/env bash
# Shell helper to start Ringer Database via Docker Compose or Supabase
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

if [ "$1" == "--supabase" ]; then
    echo "Starting Supabase local stack..."
    npx supabase start
    echo "Supabase Studio: http://localhost:54323"
    echo "PostgreSQL port: 54322"
elif [ "$1" == "--down" ]; then
    echo "Stopping Docker containers..."
    docker compose down
else
    echo "Starting PostgreSQL 16 via Docker Compose..."
    docker compose up -d
    echo "PostgreSQL running at localhost:5432"
    echo "Database: ringer_db | User: ringer_user"
fi

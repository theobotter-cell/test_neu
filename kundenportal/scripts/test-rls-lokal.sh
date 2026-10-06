#!/usr/bin/env bash
# RLS- und Workflow-Tests ohne Docker: temporärer Postgres + Supabase-Stub.
# Mit laufendem "supabase start" stattdessen: npm run test:rls
set -euo pipefail
cd "$(dirname "$0")/.."
URL=$(scripts/db-lokal.sh start --seed)
trap 'scripts/db-lokal.sh stop' EXIT
DATABASE_URL="$URL" npx vitest run tests/rls "$@"

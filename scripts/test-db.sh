#!/usr/bin/env bash
# Runs the Supabase migration + seed + integration tests against a local PostgreSQL.
# Usage: scripts/test-db.sh   (needs psql access; set PSQL to override, e.g. PSQL="psql -h localhost -U postgres")
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL=${PSQL:-psql}
DB=haneul_test_$$
$PSQL -q -c "create database $DB" >/dev/null
trap '$PSQL -q -c "drop database if exists $DB" >/dev/null' EXIT
run() { $PSQL -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do run "$f"; done
run supabase/seed.sql
echo "seeded $($PSQL -tA -d "$DB" -c 'select count(*) from public.game_questions') game questions"
$PSQL -q -v ON_ERROR_STOP=1 -d "$DB" -o /dev/null -f supabase/tests/10_rls_and_game.sql

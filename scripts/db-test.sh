#!/usr/bin/env bash
#
# Apply every migration to a throwaway Postgres and run the SQL test suite.
#
#   ./scripts/db-test.sh
#
# Needs Docker. The container (surferlive-test) is reused between runs; the
# schema is dropped and rebuilt each time, so runs are independent.
#
# This is a plain Postgres with scripts/pg-bootstrap.sql standing in for the
# few Supabase platform objects the schema leans on (auth.users, auth.uid(),
# the anon / authenticated / service_role roles). It exercises the real
# policies, triggers and constraints — not a mock of them.

set -euo pipefail

CONTAINER=surferlive-test
IMAGE=postgres:15-alpine
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

psql_run() { docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "Starting $CONTAINER ..."
  docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres -p 55432:5432 "$IMAGE" >/dev/null
elif [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER")" != "true" ]; then
  docker start "$CONTAINER" >/dev/null
fi

for _ in $(seq 1 30); do
  docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

echo "Rebuilding schema ..."
psql_run -c "drop schema if exists public cascade;
             drop schema if exists app cascade;
             drop schema if exists auth cascade;
             drop schema if exists test cascade;
             drop schema if exists extensions cascade;
             create schema public;" >/dev/null

docker exec "$CONTAINER" rm -rf /tmp/sql >/dev/null 2>&1 || true
docker exec "$CONTAINER" mkdir -p /tmp/sql
docker cp "$ROOT/scripts/pg-bootstrap.sql" "$CONTAINER:/tmp/sql/" >/dev/null
docker cp "$ROOT/supabase/migrations" "$CONTAINER:/tmp/sql/migrations" >/dev/null
docker cp "$ROOT/supabase/seed.sql" "$CONTAINER:/tmp/sql/" >/dev/null
docker cp "$ROOT/supabase/tests" "$CONTAINER:/tmp/sql/tests" >/dev/null

psql_run -f /tmp/sql/pg-bootstrap.sql >/dev/null

for f in $(docker exec "$CONTAINER" sh -c 'ls /tmp/sql/migrations/*.sql' | sort); do
  printf '  applying %s\n' "$(basename "$f")"
  psql_run -f "$f" >/dev/null
done

psql_run -f /tmp/sql/seed.sql >/dev/null
psql_run -f /tmp/sql/tests/00_harness.sql >/dev/null

echo
failed=0
for f in $(docker exec "$CONTAINER" sh -c 'ls /tmp/sql/tests/*.sql' | sort); do
  name="$(basename "$f")"
  [ "$name" = "00_harness.sql" ] && continue

  echo "$name"
  if output=$(psql_run -f "$f" 2>&1); then
    echo "$output" | sed -n 's/.*NOTICE:  //p'
  else
    echo "$output" | sed -n 's/.*NOTICE:  //p'
    echo "$output" | grep -E "ERROR|FAILED" | head -3
    failed=1
  fi
  echo
done

if [ "$failed" -eq 0 ]; then
  echo "All database tests passed."
else
  echo "Database tests FAILED."
  exit 1
fi

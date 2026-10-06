#!/usr/bin/env bash
# Startet einen temporären Postgres-Cluster (ohne Docker), spielt den
# Supabase-Stub, alle Migrationen und optional den Seed ein.
#   scripts/db-lokal.sh start [--seed]   -> gibt DATABASE_URL aus
#   scripts/db-lokal.sh stop
set -euo pipefail
cd "$(dirname "$0")/.."

PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA_DIR="${DB_LOKAL_DIR:-.db-lokal}"
PORT="${DB_LOKAL_PORT:-54329}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then RUN_AS=(runuser -u postgres --); fi

case "${1:-}" in
  start)
    rm -rf "$DATA_DIR"; mkdir -p "$DATA_DIR"
    if [ "$(id -u)" = "0" ]; then chown postgres "$DATA_DIR"; fi
    "${RUN_AS[@]}" "$PGBIN/initdb" -D "$DATA_DIR/data" -U postgres -A trust >/dev/null
    "${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$DATA_DIR/data" -o "-p $PORT -k /tmp -c listen_addresses=127.0.0.1" \
      -l "$DATA_DIR/postgres.log" -w start >/dev/null
    URL="postgresql://postgres@127.0.0.1:$PORT/postgres"
    psql -q -v ON_ERROR_STOP=1 "$URL" -f tests/support/supabase-stub.sql >/dev/null
    for f in supabase/migrations/*.sql; do
      psql -q -v ON_ERROR_STOP=1 "$URL" -f "$f" >/dev/null || { echo "Fehler in $f" >&2; exit 1; }
    done
    if [ "${2:-}" = "--seed" ]; then
      psql -q -v ON_ERROR_STOP=1 "$URL" -f supabase/seed.sql >/dev/null
    fi
    echo "$URL"
    ;;
  stop)
    "${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$DATA_DIR/data" -m fast stop >/dev/null 2>&1 || true
    rm -rf "$DATA_DIR"
    ;;
  *)
    echo "Aufruf: $0 start [--seed] | stop" >&2; exit 2;;
esac

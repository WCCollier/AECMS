#!/bin/bash
# AECMS dev startup — handles cold (new Codespace) and warm (same session) restarts.
# Usage: bash start-dev.sh
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "=== AECMS Dev Startup ==="

# ── 1. PostgreSQL ─────────────────────────────────────────────────────────────
if docker ps --format '{{.Names}}' | grep -q '^aecms-postgres$'; then
  echo "✓ PostgreSQL already running"
else
  if docker ps -a --format '{{.Names}}' | grep -q '^aecms-postgres$'; then
    echo "→ Starting existing PostgreSQL container..."
    docker start aecms-postgres
  else
    echo "→ Creating PostgreSQL container..."
    DB_PASS=$(python3 -c "
import re, urllib.parse
with open('$BACKEND_DIR/.env') as f:
    for line in f:
        m = re.match(r'DATABASE_URL=postgresql://[^:]+:([^@]+)@', line.strip())
        if m:
            print(urllib.parse.unquote(m.group(1)))
            break
")
    docker run -d --name aecms-postgres \
      -e POSTGRES_USER=aecms \
      -e "POSTGRES_PASSWORD=$DB_PASS" \
      -e POSTGRES_DB=aecms \
      -p 5432:5432 \
      postgres:15-alpine
  fi
fi

# ── 2. Redis ──────────────────────────────────────────────────────────────────
if docker ps --format '{{.Names}}' | grep -q '^aecms-redis$'; then
  echo "✓ Redis already running"
else
  if docker ps -a --format '{{.Names}}' | grep -q '^aecms-redis$'; then
    echo "→ Starting existing Redis container..."
    docker start aecms-redis
  else
    echo "→ Creating Redis container..."
    docker run -d --name aecms-redis -p 6379:6379 redis:7-alpine
  fi
fi

# ── 3. Wait for PostgreSQL to accept connections ───────────────────────────────
echo -n "Waiting for PostgreSQL"
until docker exec aecms-postgres pg_isready -U aecms -d aecms > /dev/null 2>&1; do
  echo -n "."
  sleep 1
done
echo " ready."

# ── 4. Run migrations ─────────────────────────────────────────────────────────
cd "$BACKEND_DIR"
echo "→ Running migrations..."
npx prisma migrate deploy 2>&1 | grep -E "Applied|already applied|No pending|error" || true

# ── 5. Seed only on cold start (no users = fresh DB) ─────────────────────────
USER_COUNT=$(docker exec aecms-postgres psql -U aecms -d aecms -t -c \
  "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' \n')
if [ -z "$USER_COUNT" ] || [ "$USER_COUNT" = "0" ]; then
  echo "→ Cold start detected — seeding database..."
  npx prisma db seed
else
  echo "✓ Warm start — $USER_COUNT user(s) found, skipping seed."
fi

# ── 6. Kill stale processes and start backend ─────────────────────────────────
echo "→ Starting backend (port 4000)..."
pkill -f "nest start" 2>/dev/null || true
kill "$(lsof -ti:4000)" 2>/dev/null || true
sleep 1
cd "$BACKEND_DIR"
nohup npm run start:dev > /tmp/backend.log 2>&1 &
echo "  Backend PID: $!  (logs: tail -f /tmp/backend.log)"

# ── 7. Start frontend ─────────────────────────────────────────────────────────
echo "→ Starting frontend (port 3000)..."
kill "$(lsof -ti:3000)" 2>/dev/null || true
sleep 1
cd "$FRONTEND_DIR"
nohup npm run dev > /tmp/frontend.log 2>&1 &
echo "  Frontend PID: $!  (logs: tail -f /tmp/frontend.log)"

echo ""
echo "=== AECMS started ==="
echo "  Frontend : http://localhost:3000"
echo "  Backend  : http://localhost:4000"
echo "  Logs     : tail -f /tmp/backend.log /tmp/frontend.log"

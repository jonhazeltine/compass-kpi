#!/bin/bash
# ─── Bulletproof simulator launcher ──────────────────────────────────────────
# Starts backend, tunnel, Metro, and all 3 sims in the correct order.
# Run from repo root: ./dev-sims.sh
# Ctrl-C stops everything.
set -euo pipefail

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

COACH="85E99C95-FB27-4EF0-A4A7-78F7AD4AE13A"
LEADER="AA20243F-04C8-4A29-8799-04B845806CF4"
MEMBER="EFD849A8-7DAA-4A01-B7BD-D2A7280A8C9F"
BUNDLE_ID="com.jonhazeltine.compass-kpi"
BACKEND_PORT=4000
METRO_PORT=8081

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $BACKEND_PID $TUNNEL_PID $METRO_PID 2>/dev/null || true
  for SIM in $COACH $LEADER $MEMBER; do
    xcrun simctl terminate $SIM $BUNDLE_ID 2>/dev/null || true
  done
  echo "Done."
}
trap cleanup EXIT

echo "=== Step 1: Kill stale processes ==="
lsof -tiTCP:$BACKEND_PORT -sTCP:LISTEN | xargs kill -9 2>/dev/null || true
lsof -tiTCP:$METRO_PORT -sTCP:LISTEN | xargs kill -9 2>/dev/null || true
pkill -f "cloudflared tunnel" 2>/dev/null || true
for SIM in $COACH $LEADER $MEMBER; do
  xcrun simctl terminate $SIM $BUNDLE_ID 2>/dev/null || true
done
sleep 1

echo "=== Step 2: Start backend ==="
cd backend
npx ts-node src/index.ts &>/tmp/compass-backend.log &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
echo -n "Waiting for backend on port $BACKEND_PORT"
for i in $(seq 1 30); do
  if curl -s -o /dev/null http://localhost:$BACKEND_PORT/health 2>/dev/null; then
    echo " ✓"
    break
  fi
  echo -n "."
  sleep 2
done

echo "=== Step 3: Start tunnel ==="
cloudflared tunnel --url http://localhost:$BACKEND_PORT &>/tmp/compass-tunnel.log &
TUNNEL_PID=$!

# Wait for tunnel URL
echo -n "Waiting for tunnel URL"
TUNNEL_URL=""
for i in $(seq 1 20); do
  TUNNEL_URL=$(grep -o 'https://[a-z\-]*\.trycloudflare\.com' /tmp/compass-tunnel.log 2>/dev/null | head -1)
  if [ -n "$TUNNEL_URL" ]; then
    echo " ✓"
    echo "Tunnel: $TUNNEL_URL"
    break
  fi
  echo -n "."
  sleep 1
done

if [ -z "$TUNNEL_URL" ]; then
  echo " FAILED — check /tmp/compass-tunnel.log"
  exit 1
fi

echo "=== Step 4: Update .env ==="
sed -i '' "s|EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=$TUNNEL_URL|" app/.env
echo "Updated app/.env → $TUNNEL_URL"

echo "=== Step 5: Verify tunnel ==="
TUNNEL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TUNNEL_URL/health")
if [ "$TUNNEL_STATUS" != "200" ]; then
  echo "Tunnel health check failed (HTTP $TUNNEL_STATUS) — retrying..."
  sleep 3
  TUNNEL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TUNNEL_URL/health")
fi
echo "Tunnel health: $TUNNEL_STATUS"

echo "=== Step 6: Start Metro (clear cache) ==="
cd app
npx expo start --lan -p $METRO_PORT -c &>/tmp/compass-expo.log &
METRO_PID=$!
cd ..

echo -n "Waiting for Metro on port $METRO_PORT"
for i in $(seq 1 20); do
  if lsof -i :$METRO_PORT | grep -q LISTEN 2>/dev/null; then
    echo " ✓"
    break
  fi
  echo -n "."
  sleep 2
done

echo "=== Step 7: Boot simulators ==="
xcrun simctl boot $COACH 2>/dev/null || true
xcrun simctl boot $LEADER 2>/dev/null || true
xcrun simctl boot $MEMBER 2>/dev/null || true
sleep 2

echo "=== Step 8: Launch app on all 3 ==="
xcrun simctl launch $COACH $BUNDLE_ID 2>&1
xcrun simctl launch $LEADER $BUNDLE_ID 2>&1
xcrun simctl launch $MEMBER $BUNDLE_ID 2>&1

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  All 3 sims running!                                ║"
echo "║  Backend:  http://localhost:$BACKEND_PORT               ║"
echo "║  Tunnel:   $TUNNEL_URL"
echo "║  Metro:    http://localhost:$METRO_PORT                 ║"
echo "║  Press Ctrl-C to stop all services                  ║"
echo "╚══════════════════════════════════════════════════════╝"

# Keep alive — wait for Ctrl-C
wait

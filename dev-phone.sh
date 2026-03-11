#!/usr/bin/env bash
# dev-phone.sh — One-command dev startup for physical device testing
# Usage: ./dev-phone.sh
#
# What it does:
#   1. Starts the backend (port 4000)
#   2. Starts a cloudflared tunnel and captures the URL
#   3. Updates app/.env with the live tunnel URL
#   4. Starts Expo in LAN mode with cache cleared
#   5. Pushes the app to El Guapo
#
# Ctrl-C kills everything cleanly.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$ROOT/app"
BACKEND_DIR="$ROOT/backend"
ENV_FILE="$APP_DIR/.env"
DEVICE_NAME="El Guapo"
LAN_IP="192.168.86.32"
EXPO_PORT=8081
BACKEND_PORT=4000

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[dev]${NC} $*"; }
warn() { echo -e "${YELLOW}[dev]${NC} $*"; }
err()  { echo -e "${RED}[dev]${NC} $*" >&2; }

PIDS=()
cleanup() {
  log "Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  # Also sweep up any orphaned processes
  pkill -f "cloudflared tunnel --url http://127.0.0.1:$BACKEND_PORT" 2>/dev/null || true
  lsof -tiTCP:$EXPO_PORT -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null || true
  lsof -tiTCP:$BACKEND_PORT -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null || true
  log "Done."
  exit 0
}
trap cleanup EXIT INT TERM

# ── 0. Kill stale processes ──────────────────────────────────────────────────
log "Cleaning up stale processes..."
pkill -f "cloudflared tunnel --url http://127.0.0.1:$BACKEND_PORT" 2>/dev/null || true
lsof -tiTCP:$EXPO_PORT -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -tiTCP:$BACKEND_PORT -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

# ── 1. Start backend ────────────────────────────────────────────────────────
log "Starting backend on port $BACKEND_PORT..."
cd "$BACKEND_DIR"
npm run dev &>/tmp/compass-backend.log &
PIDS+=($!)

# Wait for backend to be healthy
for i in {1..30}; do
  if curl -sf http://127.0.0.1:$BACKEND_PORT/health &>/dev/null; then
    log "Backend is healthy."
    break
  fi
  if [ "$i" -eq 30 ]; then
    err "Backend failed to start. Check /tmp/compass-backend.log"
    exit 1
  fi
  sleep 1
done

# ── 2. Start cloudflared tunnel ──────────────────────────────────────────────
log "Starting cloudflared tunnel..."
TUNNEL_LOG="/tmp/compass-tunnel.log"
cloudflared tunnel --url http://127.0.0.1:$BACKEND_PORT 2>"$TUNNEL_LOG" &
PIDS+=($!)

# Wait for tunnel URL
TUNNEL_URL=""
for i in {1..30}; do
  TUNNEL_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1)
  if [ -n "$TUNNEL_URL" ]; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    err "Cloudflared failed to create tunnel. Check $TUNNEL_LOG"
    exit 1
  fi
  sleep 1
done
log "Tunnel URL: ${CYAN}$TUNNEL_URL${NC}"

# Verify tunnel reaches backend
if ! curl -sf "$TUNNEL_URL/health" &>/dev/null; then
  warn "Tunnel health check failed — might need a moment to propagate."
fi

# ── 3. Update .env ──────────────────────────────────────────────────────────
if grep -q '^EXPO_PUBLIC_API_URL=' "$ENV_FILE"; then
  sed -i '' "s|^EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=$TUNNEL_URL|" "$ENV_FILE"
else
  echo "EXPO_PUBLIC_API_URL=$TUNNEL_URL" >> "$ENV_FILE"
fi
log "Updated .env → EXPO_PUBLIC_API_URL=$TUNNEL_URL"

# ── 4. Start Expo ───────────────────────────────────────────────────────────
log "Starting Expo on port $EXPO_PORT (LAN mode, cache cleared)..."
cd "$APP_DIR"
npx expo start --lan -p $EXPO_PORT -c &>/tmp/compass-expo.log &
PIDS+=($!)

# Wait for Metro to be ready
for i in {1..60}; do
  if curl -sf http://127.0.0.1:$EXPO_PORT &>/dev/null; then
    log "Metro bundler is ready."
    break
  fi
  if [ "$i" -eq 60 ]; then
    warn "Metro is slow to start — continuing anyway."
  fi
  sleep 1
done

# ── 5. Push to phone ────────────────────────────────────────────────────────
log "Pushing to ${CYAN}$DEVICE_NAME${NC}..."
sleep 3  # Give Metro a moment to finish the initial bundle
xcrun devicectl device process launch \
  --device "$DEVICE_NAME" \
  --terminate-existing \
  --activate \
  --payload-url "exp://$LAN_IP:$EXPO_PORT" \
  host.exp.Exponent 2>&1 && \
  log "App launched on $DEVICE_NAME!" || \
  warn "Failed to push to $DEVICE_NAME (is it connected?)"

# ── Keep alive ──────────────────────────────────────────────────────────────
echo ""
log "Everything is running. Press ${CYAN}Ctrl-C${NC} to stop all services."
echo ""
echo -e "  Backend:  http://127.0.0.1:$BACKEND_PORT"
echo -e "  Tunnel:   $TUNNEL_URL"
echo -e "  Expo:     exp://$LAN_IP:$EXPO_PORT"
echo -e "  Logs:     /tmp/compass-{backend,tunnel,expo}.log"
echo ""

# Tail Expo logs so user sees app output
tail -f /tmp/compass-expo.log

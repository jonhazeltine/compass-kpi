#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_DIR="$ROOT/app"
BACKEND_DIR="$ROOT/backend"
ENV_FILE="$APP_DIR/.env"
BACKEND_PORT="${BACKEND_PORT:-4000}"
EXPO_PORT="${EXPO_PORT:-8081}"
WEB_PORT="${WEB_PORT:-8082}"
DEVICE_NAME="${DEVICE_NAME:-El Guapo}"
DEFAULT_PERSONA="${DEFAULT_PERSONA:-member}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[dev]${NC} $*"; }
warn() { echo -e "${YELLOW}[dev]${NC} $*"; }
err()  { echo -e "${RED}[dev]${NC} $*" >&2; }

PIDS=()
register_pid() {
  PIDS+=("$1")
}

cleanup_dev_children() {
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
}

kill_port() {
  local port="$1"
  lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null || true
}

reset_dev_processes() {
  pkill -f "cloudflared tunnel --url http://127.0.0.1:$BACKEND_PORT" 2>/dev/null || true
  pkill -f "expo start --tunnel -p $EXPO_PORT" 2>/dev/null || true
  pkill -f "expo start --localhost -p $EXPO_PORT" 2>/dev/null || true
  pkill -f "expo start --web -p $WEB_PORT" 2>/dev/null || true
  kill_port "$BACKEND_PORT"
  kill_port "$EXPO_PORT"
  kill_port "$WEB_PORT"
}

wait_for_health() {
  local url="$1"
  local attempts="${2:-40}"
  for i in $(seq 1 "$attempts"); do
    if curl -sf "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

start_backend() {
  log "Starting backend on port $BACKEND_PORT..."
  cd "$BACKEND_DIR"
  npm run dev &>/tmp/compass-backend.log &
  register_pid $!
  wait_for_health "http://127.0.0.1:$BACKEND_PORT/health" 40 || {
    err "Backend failed to start. Check /tmp/compass-backend.log"
    return 1
  }
  log "Backend is healthy."
}

set_env_value() {
  local key="$1"
  local value="$2"
  if [ -f "$ENV_FILE" ] && grep -q "^${key}=" "$ENV_FILE"; then
    sed -i '' "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

configure_dev_persona() {
  local persona="${1:-$DEFAULT_PERSONA}"
  local email_var=""
  local pass_var=""
  case "$persona" in
    admin)
      email_var='EXPO_PUBLIC_TEST_PERSONA_ADMIN_EMAIL'
      pass_var='EXPO_PUBLIC_TEST_PERSONA_ADMIN_PASSWORD'
      ;;
    coach)
      email_var='EXPO_PUBLIC_TEST_PERSONA_COACH_EMAIL'
      pass_var='EXPO_PUBLIC_TEST_PERSONA_COACH_PASSWORD'
      ;;
    leader)
      email_var='EXPO_PUBLIC_TEST_PERSONA_LEADER_EMAIL'
      pass_var='EXPO_PUBLIC_TEST_PERSONA_LEADER_PASSWORD'
      ;;
    sponsor)
      email_var='EXPO_PUBLIC_TEST_PERSONA_SPONSOR_EMAIL'
      pass_var='EXPO_PUBLIC_TEST_PERSONA_SPONSOR_PASSWORD'
      ;;
    solo)
      email_var='EXPO_PUBLIC_TEST_PERSONA_SOLO_EMAIL'
      pass_var='EXPO_PUBLIC_TEST_PERSONA_SOLO_PASSWORD'
      ;;
    member|*)
      email_var='EXPO_PUBLIC_TEST_PERSONA_MEMBER_EMAIL'
      pass_var='EXPO_PUBLIC_TEST_PERSONA_MEMBER_PASSWORD'
      persona='member'
      ;;
  esac

  local email=""
  local password=""
  email=$(grep "^${email_var}=" "$ENV_FILE" | sed 's/^[^=]*=//' || true)
  password=$(grep "^${pass_var}=" "$ENV_FILE" | sed 's/^[^=]*=//' || true)
  if [ -z "$email" ] || [ -z "$password" ]; then
    warn "Persona credentials for '$persona' not found in app/.env; leaving existing auth settings alone."
    return 0
  fi
  set_env_value EXPO_PUBLIC_DEV_AUTO_SIGNIN true
  set_env_value EXPO_PUBLIC_DEV_LOGIN_EMAIL "$email"
  set_env_value EXPO_PUBLIC_DEV_LOGIN_PASSWORD "$password"
  log "Configured dev auto sign-in persona: ${CYAN}$persona${NC}"
}

start_cloudflare_backend_tunnel() {
  local tunnel_log="/tmp/compass-tunnel.log"
  : > "$tunnel_log"
  log "Starting backend cloudflared tunnel..."
  cloudflared tunnel --url "http://127.0.0.1:$BACKEND_PORT" 2>"$tunnel_log" &
  register_pid $!

  local tunnel_url=""
  for _ in $(seq 1 40); do
    tunnel_url=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$tunnel_log" 2>/dev/null | head -1 || true)
    if [ -n "$tunnel_url" ]; then
      break
    fi
    sleep 1
  done

  if [ -z "$tunnel_url" ]; then
    err "Cloudflared failed to produce a tunnel URL. Check $tunnel_log"
    return 1
  fi

  log "Backend tunnel: ${CYAN}$tunnel_url${NC}"
  set_env_value EXPO_PUBLIC_API_URL "$tunnel_url"
  DEV_BACKEND_TUNNEL_URL="$tunnel_url"
}

start_expo_web() {
  log "Starting Expo web on http://localhost:$WEB_PORT ..."
  cd "$APP_DIR"
  npx expo start --web -p "$WEB_PORT" &>/tmp/compass-expo-web.log &
  register_pid $!
  wait_for_health "http://127.0.0.1:$WEB_PORT" 90 || warn "Expo web is slow to answer on $WEB_PORT"
}

start_expo_simulator() {
  log "Starting Expo for simulator on localhost:$EXPO_PORT ..."
  cd "$APP_DIR"
  npx expo start --localhost -p "$EXPO_PORT" -c &>/tmp/compass-expo-sim.log &
  register_pid $!
  wait_for_health "http://127.0.0.1:$EXPO_PORT" 90 || warn "Expo simulator bundler is slow to answer on $EXPO_PORT"
}

start_expo_phone() {
  local expo_log="/tmp/compass-expo.log"
  : > "$expo_log"
  log "Starting Expo tunnel on port $EXPO_PORT ..."
  cd "$APP_DIR"
  npx expo start --tunnel -p "$EXPO_PORT" -c &>"$expo_log" &
  register_pid $!

  local expo_url=""
  for _ in $(seq 1 90); do
    expo_url=$(grep -oE 'exp://[^[:space:]]+\.exp\.direct' "$expo_log" 2>/dev/null | head -1 || true)
    if [ -n "$expo_url" ]; then
      break
    fi
    sleep 1
  done

  if [ -z "$expo_url" ]; then
    err "Expo tunnel URL not found. Check $expo_log"
    return 1
  fi

  log "Expo tunnel: ${CYAN}$expo_url${NC}"
  DEV_EXPO_URL="$expo_url"
}

boot_default_simulator() {
  if xcrun simctl list devices booted | rg -q 'Booted'; then
    return 0
  fi
  log "Booting iOS Simulator..."
  open -a Simulator >/dev/null 2>&1 || true
  sleep 3
}

launch_booted_simulators() {
  local url="$1"
  boot_default_simulator
  xcrun simctl openurl booted "$url" >/dev/null 2>&1 || warn "Could not launch Expo Go on booted simulator."
}

launch_phone() {
  local url="$1"
  xcrun devicectl device process launch \
    --device "$DEVICE_NAME" \
    --terminate-existing \
    --activate \
    --payload-url "$url" \
    host.exp.Exponent >/tmp/compass-device-launch.log 2>&1 || warn "Could not launch Expo Go on $DEVICE_NAME."
}

#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
DEFAULT_PERSONA="member"
EXPO_PORT="8083"
source "$ROOT/ops/scripts/dev-common.sh"
cleanup() {
  log "Shutting down phone dev session..."
  cleanup_dev_children
  reset_dev_processes
}
trap cleanup INT TERM

log "Resetting stale phone processes..."
reset_dev_processes
start_backend
configure_dev_persona "${1:-$DEFAULT_PERSONA}"
start_cloudflare_backend_tunnel
BACKEND_TUNNEL_URL="$DEV_BACKEND_TUNNEL_URL"
start_expo_phone
EXPO_URL="$DEV_EXPO_URL"
launch_phone "$EXPO_URL"

echo ""
log "Phone session is ready."
echo ""
echo "  Device:          $DEVICE_NAME"
echo "  Backend tunnel:  $BACKEND_TUNNEL_URL"
echo "  Expo tunnel:     $EXPO_URL"
echo "  Logs:            /tmp/compass-backend.log, /tmp/compass-tunnel.log, /tmp/compass-expo.log"
echo ""
tail -f /tmp/compass-expo.log

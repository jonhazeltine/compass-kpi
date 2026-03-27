#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
DEFAULT_PERSONA="member"
EXPO_PORT="8081"
source "$ROOT/ops/scripts/dev-common.sh"
cleanup() {
  log "Shutting down simulator dev session..."
  cleanup_dev_children
  reset_dev_processes
}
trap cleanup INT TERM

log "Resetting stale simulator processes..."
reset_dev_processes
start_backend
configure_dev_persona "${1:-$DEFAULT_PERSONA}"
set_env_value EXPO_PUBLIC_API_URL "http://127.0.0.1:$BACKEND_PORT"
start_expo_simulator
launch_booted_simulators "exp://127.0.0.1:$EXPO_PORT"

echo ""
log "Simulator session is ready."
echo ""
echo "  Backend:         http://127.0.0.1:$BACKEND_PORT"
echo "  Expo simulator:  exp://127.0.0.1:$EXPO_PORT"
echo "  Logs:            /tmp/compass-backend.log, /tmp/compass-expo-sim.log"
echo ""
tail -f /tmp/compass-expo-sim.log

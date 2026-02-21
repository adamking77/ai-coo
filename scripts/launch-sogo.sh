#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAUNCH_ENTRYPOINT="launch-sogo.sh" exec "$ROOT/scripts/launch-ai-coo.sh" "$@"

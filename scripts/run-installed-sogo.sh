#!/usr/bin/env bash

set -euo pipefail

if [[ "$OSTYPE" != "darwin"* ]]; then
	echo "Error: this launcher is for macOS only."
	exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PATH="${SOGO_APP_PATH:-/Applications/Sogo.app}"
APP_BIN="$APP_PATH/Contents/MacOS/Sogo"
USER_DATA_DIR="${SOGO_USER_DATA_DIR:-${AI_COO_USER_DATA_DIR:-$HOME/.sogo-data}}"
EXTENSIONS_DIR="${SOGO_EXTENSIONS_DIR:-${AI_COO_EXTENSIONS_DIR:-$HOME/.sogo-extensions}}"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
	cat <<'EOF'
Usage: ./scripts/run-installed-sogo.sh [-- <app args>]

Launches an installed /Applications/Sogo.app with stable data and extension paths.

Environment overrides:
  SOGO_APP_PATH          default: /Applications/Sogo.app
  SOGO_USER_DATA_DIR     default: ~/.sogo-data
  SOGO_EXTENSIONS_DIR    default: ~/.sogo-extensions

Examples:
  ./scripts/run-installed-sogo.sh
  ./scripts/run-installed-sogo.sh -- --disable-gpu
EOF
	exit 0
fi

if [[ -f "$ROOT/.env.local" ]]; then
	set -a
	# shellcheck source=/dev/null
	source "$ROOT/.env.local"
	set +a
fi

if [[ ! -x "$APP_BIN" ]]; then
	echo "Error: Sogo app binary not found at:"
	echo "  $APP_BIN"
	echo
	echo "Install it first:"
	echo "  cp -R \"$ROOT/.build/electron/Sogo.app\" \"/Applications/Sogo.app\""
	exit 1
fi

exec "$APP_BIN" \
	--user-data-dir "$USER_DATA_DIR" \
	--extensions-dir "$EXTENSIONS_DIR" \
	"$@"

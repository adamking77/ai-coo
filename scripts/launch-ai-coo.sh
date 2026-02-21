#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REQUIRED_NODE_FILE="$ROOT/.nvmrc"
DO_COMPILE=1
LAUNCH_ENTRYPOINT="${LAUNCH_ENTRYPOINT:-launch-ai-coo.sh}"

LAUNCH_ARGS=()
for arg in "$@"; do
	case "$arg" in
		--no-compile)
			DO_COMPILE=0
			;;
		-h|--help)
			cat <<EOF
Usage: ./scripts/$LAUNCH_ENTRYPOINT [--no-compile] [-- <code args>]

Options:
  --no-compile   Skip compile for faster startup
  -h, --help     Show this help

Examples:
  ./scripts/$LAUNCH_ENTRYPOINT
  ./scripts/$LAUNCH_ENTRYPOINT --no-compile
  ./scripts/$LAUNCH_ENTRYPOINT -- --disable-gpu

Backward-compatible alias:
  ./scripts/launch-ai-coo.sh [same options]
EOF
			exit 0
			;;
		*)
			LAUNCH_ARGS+=("$arg")
			;;
	esac
done

load_nvm_if_present() {
	if command -v nvm >/dev/null 2>&1; then
		return 0
	fi

	if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
		# shellcheck source=/dev/null
		source "$HOME/.nvm/nvm.sh"
	fi
}

load_fnm_if_present() {
	if command -v fnm >/dev/null 2>&1; then
		# shellcheck disable=SC2016
		eval "$(fnm env --shell bash)"
	fi
}

use_repo_node_version_if_possible() {
	if [[ ! -f "$REQUIRED_NODE_FILE" ]]; then
		return 0
	fi

	local required
	required="$(tr -d '[:space:]' < "$REQUIRED_NODE_FILE")"

	load_fnm_if_present
	if command -v fnm >/dev/null 2>&1; then
		fnm use "$required" >/dev/null 2>&1 || true
	fi

	load_nvm_if_present

	if command -v nvm >/dev/null 2>&1; then
		nvm use "$required" >/dev/null 2>&1 || true
	fi
}

load_local_env_if_present() {
	local env_file="$ROOT/.env.local"
	if [[ -f "$env_file" ]]; then
		echo "Loading local environment from .env.local..."
		set -a
		# shellcheck source=/dev/null
		source "$env_file"
		set +a
	fi
}

ensure_node_exists() {
	if ! command -v node >/dev/null 2>&1; then
		echo "Error: Node.js not found. Install Node and retry."
		exit 1
	fi
}

ensure_node_version() {
	if [[ ! -f "$REQUIRED_NODE_FILE" ]]; then
		return 0
	fi

	local required current
	required="$(tr -d '[:space:]' < "$REQUIRED_NODE_FILE")"
	current="$(node -p "process.versions.node")"

	if ! node -e "const [cur, req] = process.argv.slice(1).map(v => v.split('.').map(n => Number(n) || 0)); const len = Math.max(cur.length, req.length); for (let i = 0; i < len; i++) { const c = cur[i] ?? 0; const r = req[i] ?? 0; if (c > r) process.exit(0); if (c < r) process.exit(1); } process.exit(0);" "$current" "$required"; then
		echo "Error: Node.js v$required or later required (current: v$current)."
		echo "Try one of the following, then re-run this script:"
		echo "  fnm use $required"
		echo "  nvm install $required && nvm use $required"
		exit 1
	fi
}

maybe_install_dependencies() {
	if [[ ! -d "$ROOT/node_modules" ]]; then
		echo "Installing dependencies (npm ci)..."
		( cd "$ROOT" && npm ci )
	fi
}

compile_if_requested() {
	if [[ "$DO_COMPILE" -eq 1 ]]; then
		echo "Compiling app (npm run compile)..."
		( cd "$ROOT" && npm run compile )
	fi
}

launch_app() {
	local user_data_dir extensions_dir
	user_data_dir="${SOGO_USER_DATA_DIR:-${AI_COO_USER_DATA_DIR:-$HOME/.sogo-data}}"
	extensions_dir="${SOGO_EXTENSIONS_DIR:-${AI_COO_EXTENSIONS_DIR:-$HOME/.sogo-extensions}}"

	echo "Launching Sogo app..."
	echo "User data: $user_data_dir"
	echo "Extensions: $extensions_dir"

	cd "$ROOT"
	if [[ "${#LAUNCH_ARGS[@]}" -gt 0 ]]; then
		exec ./scripts/code.sh \
			--user-data-dir "$user_data_dir" \
			--extensions-dir "$extensions_dir" \
			"${LAUNCH_ARGS[@]}"
	else
		exec ./scripts/code.sh \
			--user-data-dir "$user_data_dir" \
			--extensions-dir "$extensions_dir"
	fi
}

use_repo_node_version_if_possible
load_local_env_if_present
ensure_node_exists
ensure_node_version
maybe_install_dependencies
compile_if_requested
launch_app

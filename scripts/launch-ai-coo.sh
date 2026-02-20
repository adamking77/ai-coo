#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REQUIRED_NODE_FILE="$ROOT/.nvmrc"
DO_COMPILE=1

LAUNCH_ARGS=()
for arg in "$@"; do
	case "$arg" in
		--no-compile)
			DO_COMPILE=0
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

use_repo_node_version_if_possible() {
	if [[ ! -f "$REQUIRED_NODE_FILE" ]]; then
		return 0
	fi

	load_nvm_if_present

	if command -v nvm >/dev/null 2>&1; then
		local required
		required="$(tr -d '[:space:]' < "$REQUIRED_NODE_FILE")"
		nvm use "$required" >/dev/null 2>&1 || true
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
	user_data_dir="${AI_COO_USER_DATA_DIR:-$HOME/.ai-coo-data}"
	extensions_dir="${AI_COO_EXTENSIONS_DIR:-$HOME/.ai-coo-extensions}"

	echo "Launching AI COO app..."
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
ensure_node_exists
ensure_node_version
maybe_install_dependencies
compile_if_requested
launch_app

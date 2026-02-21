#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REQUIRED_NODE_FILE="$ROOT/.nvmrc"

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

ensure_node_version() {
	if [[ ! -f "$REQUIRED_NODE_FILE" ]]; then
		return 0
	fi
	local required current
	required="$(tr -d '[:space:]' < "$REQUIRED_NODE_FILE")"
	current="$(node -p "process.versions.node")"
	if ! node -e "const [cur, req] = process.argv.slice(1).map(v => v.split('.').map(n => Number(n) || 0)); const len = Math.max(cur.length, req.length); for (let i = 0; i < len; i++) { const c = cur[i] ?? 0; const r = req[i] ?? 0; if (c > r) process.exit(0); if (c < r) process.exit(1); } process.exit(0);" "$current" "$required"; then
		echo "Error: Node.js v$required or later required (current: v$current)."
		echo "Try:"
		echo "  fnm use $required"
		echo "  nvm install $required && nvm use $required"
		exit 1
	fi
}

maybe_install_dependencies() {
	if [[ ! -d "$ROOT/node_modules" ]]; then
		echo "Installing dependencies (npm ci)..."
		(
			cd "$ROOT"
			npm ci
		)
	fi
}

echo "AI COO preflight starting..."
use_repo_node_version_if_possible
ensure_node_version
maybe_install_dependencies
echo "Step 1/3: compile"
(
	cd "$ROOT"
	npm run compile
)

echo "Step 2/3: regression checks"
"$ROOT/scripts/ai-coo-regression-check.sh"

echo "Step 3/3: ready"
cat <<'EOF'
Preflight complete.

Daily launch command:
  ./scripts/launch-ai-coo.sh --no-compile

Fresh launch command (after code changes):
  ./scripts/launch-ai-coo.sh
EOF

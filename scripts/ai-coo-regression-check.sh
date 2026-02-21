#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

assert_contains() {
	local file="$1"
	local pattern="$2"
	local label="$3"
	if ! rg -q --fixed-strings "$pattern" "$file"; then
		echo "FAIL: $label"
		echo "  Missing pattern: $pattern"
		echo "  File: $file"
		exit 1
	fi
	echo "PASS: $label"
}

TABLE_OUT="$ROOT/out/vs/workbench/contrib/database/browser/tableView.js"
RECORD_OUT="$ROOT/out/vs/workbench/contrib/database/browser/recordEditor.js"
STYLES_OUT="$ROOT/out/vs/workbench/contrib/database/browser/databaseStyles.js"

for file in "$TABLE_OUT" "$RECORD_OUT" "$STYLES_OUT"; do
	if [[ ! -f "$file" ]]; then
		echo "FAIL: missing compiled file: $file"
		echo "Run: npm run compile"
		exit 1
	fi
done

echo "Running Sogo database regression checks..."
echo "Tip: preferred wrapper is ./scripts/sogo-regression-check.sh"

assert_contains "$TABLE_OUT" "Duplicate selected" "bulk action label: duplicate"
assert_contains "$TABLE_OUT" "Delete selected" "bulk action label: delete"
assert_contains "$TABLE_OUT" "Select all rows" "header row selection checkbox"
assert_contains "$TABLE_OUT" "showPicker" "table date picker invocation"
assert_contains "$RECORD_OUT" "showPicker" "record editor date picker invocation"
assert_contains "$STYLES_OUT" ".db-bulk-actions" "bulk action styles compiled"
assert_contains "$STYLES_OUT" "color-scheme: var(--vscode-color-scheme, normal);" "theme-adaptive popup color scheme"

echo "All regression checks passed."

# Database Behavior Contract

This file locks the expected UX behavior for the AI COO database system.

If behavior changes are needed, update this file first, then ship code changes.

## 1) Main Table View

- Clicking a non-relation cell opens inline editor for that property.
- Clicking a relation cell opens the record page for that row.
- Date properties open a native date picker when clicked/focused.
- Row checkbox selects the row for bulk actions.
- Header checkbox selects all visible rows in the current view.
- Bulk action bar appears only when at least one row is selected.
- Bulk actions supported:
  - Duplicate selected
  - Delete selected
  - Clear selection

## 2) Record Page

- Record page supports side panel mode and full page mode.
- Select and multi-select values render as colored pills.
- Clicking select and multi-select values opens option picker.
- Option edits autosave (no manual Save button).
- Date properties open a native date picker.
- Linked task section shows tasks linked to the current record.
- Creating a task in linked task section adds and displays it immediately.

## 3) Relations

- Relation data is preserved even if one side is hidden in a view.
- Removing a relation field from visible columns does not delete relation data.
- Relation target records are resolved live from current database state.

## 4) Theme Adaptation

- Database popovers, dropdowns, and tooltip panels use VS Code theme tokens.
- UI must remain legible in light and dark themes.
- Native controls (date picker/select menus) should follow platform light/dark behavior.

## 5) Change Discipline

- Any UX behavior changes must be reflected here in the same PR/commit.
- Run `./scripts/ai-coo-preflight.sh` before pushing production-facing updates.

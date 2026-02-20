# AI COO App (GenZen Editor)

A custom VS Code fork built as an operational command center with Notion-style databases inside the editor.

## What You Get

- Native database editor in the main editor area
- Table, Kanban, List, Gallery, and Calendar views
- Select and multi-select properties with colored pills
- Record pages, relations, and linked database workflows
- Theme-aware database UI controls

## Quick Start (macOS)

```bash
git clone https://github.com/adamking77/ai-coo.git
cd ai-coo
npm ci
./scripts/code.sh
```

Node `22.22.0+` is required.

## Tester Setup

Full setup guide:

- `docs/TESTER-SETUP.md`

That guide covers:
- local install and launch
- Supabase connection
- SQLite setup path

## SQLite Setup (Current)

SQLite is currently a companion workflow, not the native storage engine.

Native storage remains local `*.db.json` files.

To use SQLite today:

1. Export a database view to CSV from the app.
2. Import CSV into a local SQLite file.

Example:

```bash
sqlite3 ai-coo-test.db
```

Then in the SQLite prompt:

```sql
.mode csv
.import /absolute/path/projects.csv projects
```

## Supabase Setup (Current)

Supabase sync is best-effort push on save.

Preferred environment variables:
- `DATABASE_SUPABASE_URL`
- `DATABASE_SUPABASE_ANON_KEY`
- `DATABASE_SUPABASE_TABLE` (optional; default `database_documents`)

Also supported for compatibility:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_TABLE`

## Notes

- Local `.db.json` is still source of truth.
- Current sync pushes to Supabase but does not yet pull remote changes back into the editor.

## License

MIT. See `LICENSE.txt`.

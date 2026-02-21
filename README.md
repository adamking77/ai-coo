# Sogo (Working Codename)

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

## Internal-Ready Setup (Recommended)

Run this once after pulling new code:

```bash
./scripts/sogo-preflight.sh
```

This does:
- full compile
- automated database regression checks
- confirms app is ready to run

## One-Command Launcher (Recommended)

Use the launcher script to run the app with isolated data/extensions:

```bash
./scripts/launch-sogo.sh
```

What it does:
- uses the repo Node version (via `fnm` or `nvm` if available)
- installs dependencies if missing
- compiles the app
- launches with:
  - `--user-data-dir ~/.sogo-data`
  - `--extensions-dir ~/.sogo-extensions`

Fast launch (skip compile):

```bash
./scripts/launch-sogo.sh --no-compile
```

Show launcher help:

```bash
./scripts/launch-sogo.sh --help
```

## Run As Installed Mac App

After first build, you can run this like a normal desktop app:

1. Build and launch once:

```bash
cd ~/projects/ai-coo
npm ci
./scripts/code.sh
```

2. Install into Applications:

```bash
cp -R ".build/electron/Sogo.app" "/Applications/Sogo.app"
```

3. Launch:

```bash
open "/Applications/Sogo.app"
```

If macOS blocks launch, right-click the app and choose `Open` once.

### Recommended: Isolate Sogo Data

Use separate data and extension folders so this app stays isolated:

```bash
"/Applications/Sogo.app/Contents/MacOS/Sogo" \
  --user-data-dir "$HOME/.sogo-data" \
  --extensions-dir "$HOME/.sogo-extensions"
```

### Launch Installed App With Supabase

```bash
DATABASE_SUPABASE_URL="https://YOUR-PROJECT.supabase.co" \
DATABASE_SUPABASE_ANON_KEY="YOUR_ANON_KEY" \
DATABASE_SUPABASE_TABLE="database_documents" \
"/Applications/Sogo.app/Contents/MacOS/Sogo"
```

## Tester Setup

Full setup guide:

- `docs/TESTER-SETUP.md`

## Locked Database UX Contract

Behavior spec for the database UX:

- `docs/DATABASE-BEHAVIOR-CONTRACT.md`

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
sqlite3 sogo-test.db
```

Then in the SQLite prompt:

```sql
.mode csv
.import /absolute/path/projects.csv projects
```

## Supabase Setup (Current)

Supabase sync is best-effort push on save.

Create local env file (recommended):

```bash
cp .env.example .env.local
```

Then set your real values in `.env.local`.

Preferred environment variables:
- `DATABASE_SUPABASE_URL`
- `DATABASE_SUPABASE_ANON_KEY`
- `DATABASE_SUPABASE_TABLE` (optional; default `database_documents`)

Also supported for compatibility:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_TABLE`

The launcher auto-loads `.env.local`:

```bash
./scripts/launch-sogo.sh --no-compile
```

## Notes

- Local `.db.json` is still source of truth.
- Current sync pushes to Supabase but does not yet pull remote changes back into the editor.

## License

MIT. See `LICENSE.txt`.

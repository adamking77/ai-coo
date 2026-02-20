# AI COO App (GenZen Editor)

A custom VS Code fork built as an operational command center with Notion-style databases inside the editor itself.

This repo is based on `microsoft/vscode` and includes a native database system for:
- table + kanban + list + gallery + calendar views
- select/multi-select properties with colored pills
- relations between databases
- full record page editing in the main editor
- theme-aware UI for database controls and popovers

## Quick Start (macOS)

```bash
git clone https://github.com/adamking77/ai-coo.git
cd ai-coo
npm ci
./scripts/code.sh
```

If `nvm` is not installed, install Node directly and use Node `22.22.0+`.

## Friend Tester Guide

For non-technical setup, troubleshooting, and DB connection instructions:

- `docs/FRIEND-TESTER-SETUP.md`

That guide includes:
- download/launch steps
- Supabase connection (current built-in push sync)
- SQLite usage path (current practical approach)

## Database Storage Model

Primary storage is local workspace files:
- `*.db.json` for structured databases
- standard workspace files for docs/code

Databases open in the main editor and are designed to feel native to the app, not like an extension panel.

## Supabase Support (Current)

Supabase sync is currently best-effort push on save via environment variables:
- `GENZEN_SUPABASE_URL`
- `GENZEN_SUPABASE_ANON_KEY`
- `GENZEN_SUPABASE_TABLE` (default: `database_documents`)

Local `.db.json` files remain source-of-truth.

## SQLite Support (Current)

SQLite is not yet a native backend adapter for the database engine.

Current recommended use:
- run operational data in `.db.json`
- export/import CSV for SQLite workflows when needed

## Extensions and Themes

This fork supports extensions and theming through Open VSX configuration in `product.json`.

## Repository Notes

- Upstream base: `microsoft/vscode`
- Active project remote: `https://github.com/adamking77/ai-coo`

## License

MIT. See `LICENSE.txt`.

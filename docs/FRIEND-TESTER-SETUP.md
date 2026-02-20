# GenZen App Tester Setup (Friend Guide)

Use this guide if you want to run the app locally and test the Notion-style database features.

## 1) Download the App Repo

This project runs from the VS Code fork repo:

```bash
git clone https://github.com/adamking77/ai-coo.git
cd ai-coo
```

## 2) Install Prerequisites (macOS)

1. Install Xcode command line tools:
```bash
xcode-select --install
```

2. Install Node.js **v22.22.0 or newer** (required by the repo).

If you use `nvm`:
```bash
nvm install 22.22.0
nvm use 22.22.0
```

If you do not use `nvm`, install Node 22.22+ from nodejs.org and confirm:
```bash
node -v
```

## 3) Install Dependencies and Launch

From the repo root (`ai-coo`):

```bash
npm ci
./scripts/code.sh
```

Notes:
- First launch can take a few minutes.
- If launch fails, rerun `npm ci`, confirm `node -v`, then retry `./scripts/code.sh`.

## 4) Create and Test Databases

Inside the app:
1. Open any folder as your workspace.
2. Open the **Database** section in the sidebar.
3. Create a database, fields, views, and records.
4. Database files are saved locally as `*.db.json` in your workspace.

## 5) Connect Supabase (Built-In Sync)

Current behavior:
- Local `*.db.json` remains the source of truth.
- Supabase sync is **best-effort push on save**.
- Current implementation does **not** pull remote changes back into the app.

### 5.1 Create table in Supabase SQL Editor

Run this in your Supabase project:

```sql
create table if not exists public.database_documents (
  db_id text primary key,
  name text not null,
  resource text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
```

### 5.2 Launch app with Supabase env vars

```bash
GENZEN_SUPABASE_URL="https://YOUR-PROJECT.supabase.co" \
GENZEN_SUPABASE_ANON_KEY="YOUR_ANON_KEY" \
GENZEN_SUPABASE_TABLE="database_documents" \
./scripts/code.sh
```

### 5.3 Verify sync

After editing/saving a database in the app, run in Supabase SQL editor:

```sql
select db_id, name, updated_at
from public.database_documents
order by updated_at desc
limit 20;
```

## 6) Connect SQLite (Current Practical Path)

Current behavior:
- There is **no native SQLite backend adapter yet** for the database engine.
- Native storage is local `*.db.json`.

Practical options today:
1. Keep using `*.db.json` as your operational database.
2. Export CSV from database views and import into SQLite for analysis/reporting.
3. Install a SQLite extension in the editor if you want to inspect `.sqlite` files.

## 7) Common Issues

### `zsh: command not found: nvm`
Install Node directly (nodejs.org) or install `nvm`; then use Node 22.22+.

### App does not launch after `./scripts/code.sh`
Run:
```bash
node -v
npm ci
./scripts/code.sh
```

### Supabase not receiving rows
Check:
1. Env vars are set in the same command/session where you launch the app.
2. Table name matches `GENZEN_SUPABASE_TABLE`.
3. `db_id` exists as primary key.

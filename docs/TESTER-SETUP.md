# Tester Setup

Use this guide to run the app locally and test database features with local storage, SQLite workflows, and Supabase sync.

## 1) Download the Repo

```bash
git clone https://github.com/adamking77/ai-coo.git
cd ai-coo
```

## 2) Install Prerequisites (macOS)

1. Install Xcode command line tools:

```bash
xcode-select --install
```

2. Install Node.js `22.22.0+`.

If you use `nvm`:

```bash
nvm install 22.22.0
nvm use 22.22.0
```

If you do not use `nvm`, install Node directly and verify:

```bash
node -v
```

## 3) Install Dependencies and Launch

```bash
npm ci
./scripts/code.sh
```

If launch fails:

```bash
node -v
npm ci
./scripts/code.sh
```

## 4) How Database Storage Works

- Primary storage is local `*.db.json` files in your workspace.
- Supabase sync is optional and currently push-on-save.
- SQLite is currently a companion workflow (import/export), not the native backend.

## 5) Supabase Setup

### 5.1 Create a table in Supabase SQL Editor

```sql
create table if not exists public.database_documents (
  db_id text primary key,
  name text not null,
  resource text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
```

### 5.2 Launch with env vars

Preferred generic env vars:

```bash
DATABASE_SUPABASE_URL="https://YOUR-PROJECT.supabase.co" \
DATABASE_SUPABASE_ANON_KEY="YOUR_ANON_KEY" \
DATABASE_SUPABASE_TABLE="database_documents" \
./scripts/code.sh
```

Also supported:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_TABLE`

### 5.3 Verify sync

After editing and saving databases in the app:

```sql
select db_id, name, updated_at
from public.database_documents
order by updated_at desc
limit 20;
```

## 6) SQLite Setup

SQLite is useful if you want local SQL queries or reporting.

### 6.1 Install SQLite CLI

```bash
brew install sqlite
```

### 6.2 Export CSV from the app

In the database UI, use the Export CSV action for the table you want.

### 6.3 Import CSV into a SQLite database

Create/open a local SQLite file:

```bash
sqlite3 ai-coo-test.db
```

Inside the SQLite prompt:

```sql
.mode csv
.import /absolute/path/to/projects.csv projects
```

Now query it:

```sql
select * from projects limit 20;
```

### 6.4 Repeat for multiple databases

Use one table per exported CSV (for example: `projects`, `tasks`, `clients`).

## 7) Common Issues

### `zsh: command not found: nvm`

Install Node directly and use Node `22.22.0+`, or install `nvm`.

### App does not launch

Run:

```bash
node -v
npm ci
./scripts/code.sh
```

### Supabase not receiving rows

Check:
1. Env vars are set in the same shell command/session where you run `./scripts/code.sh`.
2. Supabase table name matches your env var.
3. The table has `db_id` as primary key.

# Supabase + Env Setup — ORBIT

This game stores only one table, then mirrors every change across tabs in
real time. There are exactly **two env vars** the app needs.

## 1. On Supabase (one table + one policy)

### Create the project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Pick a name, set a database password, choose a region close to the fest.
3. Wait for the project to finish creating.

### Create the table

1. In the project, open **SQL Editor** → **New query**.
2. Paste and run:

```sql
create table public.pieces (
  id        int primary key,
  earned    boolean not null default false,
  earned_at timestamptz
);
```

3. In the same editor, restart the Supabase JS client series (no restart
   required for the table itself, but the next step needs the table to exist):

```sql
alter publication supabase_realtime add table public.pieces;
```

That single line is what makes the pieces appear live on every screen.

### Realtime toggle (UI path)

If you prefer the dashboard over SQL:

1. Go to **Database** → **Replication**.
2. Find the `pieces` table.
3. Toggle **Enable** on the `pieces` table for **Realtime**.
4. Leave the event types as the default (all of them).

Either path gives the same result.

### Row security — basic

For this game, the simplest setup is:

1. Go to **Authentication** → **Policies**.
2. For the `pieces` table, add these policies:

```sql
-- anyone can read the 9 rows
create policy "pieces_read"
  on public.pieces for select
  using ( true );

-- anyone can write the 9 rows (QR pages + admin + stage all write)
create policy "pieces_write"
  on public.pieces for all
  using ( true );
```

That is intentionally loose — this game is meant to be used at a fest with
the laptop and phones on the same network, not as a public anonymous API.
If you want tighter control later, restrict by a static anon role, IP range,
or a shared session token.

### Copy the two keys you need

1. Go to **Project Settings** → **API**.
2. Under **Project URL**, copy the URL. It looks like:

   `https://<ref>.supabase.co`

3. Under **Anonymous key**, click **Copy**.

You only need these two values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. On this repo (env files)

### Which file to use

Next.js reads env vars in this order:

- `.env.local` — your machine / the deployed app
- `.env` — shared defaults (if one exists)
- `process.env` injected by the hosting platform

For gh-pages / any static export, the build itself needs the vars. For local
dev, `.env.local` is enough.

### `.env.local` — minimum working form

Create `.env.local` at the repo root with these two lines:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste-the-anon-key-here>
```

No other values are required by the code in `lib/supabase.ts`.

### Optional: `.env` — shared baseline

If you want a file other people can copy, create `.env` at the repo root with
placeholder values and a comment, like:

```
NEXT_PUBLIC_SUPABASE_URL=https://replace-me.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-me
```

Then keep the real values only in `.env.local` and out of git.

### Verify locally

Run:

```bash
npm run dev
```

Then open `http://localhost:3000`.

On the admin page, the small status line under the header should change from
`STATUS: LOCAL DEV MODE — SET SUPABASE ENV` to
`STATUS: SUPABASE LINKED`.

If it still says local dev mode, the two env vars are not being read. Common
causes:

- The file is named `.env` but Next.js is reading `.env.local` and it is
  empty, or vice versa.
- The var names have a typo. They must be exactly:

  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

- The values are wrapped in quotes in the file. They should not be.

## 3. What the code actually does with these values

`lib/supabase.ts` checks:

- if both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are
  present → uses Supabase
- if either is missing → falls back to `localStorage` + `BroadcastChannel`

The fallback lets you run the whole game on one machine across browser tabs
without Supabase at all. It is for development only, and the admin page says
so out loud when it is active.

Game writes through Supabase:

- **QR pages** call `earnPiece(id)` when a piece is awarded.
- **Admin page** calls `resetPieces()` when a new team is started.
- **Stage page** calls `resetPieces()` when the board clears after a win.
- All pages subscribe to the same `pieces` table via Realtime.

## 4. After setup, quick smoke test

1. Open the admin page.
2. Confirm the status line says `SUPABASE LINKED`.
3. In one browser tab, open `/stage`.
4. In another browser tab, open `/qr/1`.
5. On the QR page, the piece should award.
6. In the stage tab, the tray should show piece 1 within a second or so.
7. On the admin page, `PIECES 01 / 09 EARNED` should tick up.

If step 2 is correct and step 7 does not move, check the browser devtools
console for Supabase errors and confirm the table name is exactly `pieces`
and replication/Realtime is turned on.

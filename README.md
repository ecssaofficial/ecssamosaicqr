# ORBIT — QR Scavenger Jigsaw (College Fest)

A festival team game for groups of 4.

- The laptop shows **`/stage`**: a 3×3 jigsaw board on the left, a piece tray on the right.
- **9 printed QR codes** are scattered around the venue for players to scan with phones.
- **QR 1, 3, 5, 7, 9** award a jigsaw piece instantly. **QR 2, 4, 6, 8** open a
  short minigame first — the piece is only awarded once it is solved.
- QR *n* always awards piece *n*. No randomness.
- Earned pieces appear in the laptop tray **in realtime**, are dragged onto the
  board, and when all 9 are placed the stage shows **STAGE CLEARED** for 5
  seconds and then resets itself for the next team.

---

## Stack

Next.js 14 (App Router) · TypeScript · Supabase (1 table + Realtime) ·
Tailwind CSS · Framer Motion · qrcode.react

---

## 1. Supabase setup

Create a project at [supabase.com](https://supabase.com), open
**SQL Editor** and run this once:

```sql
-- the single game table
create table if not exists public.pieces (
  id        int primary key,
  earned    boolean not null default false,
  earned_at timestamptz
);

-- one row per QR code
insert into public.pieces (id)
select generate_series(1, 9)
on conflict (id) do nothing;

-- open access (fest device, anon key only — nothing sensitive in this table)
alter table public.pieces enable row level security;

create policy "pieces readable"  on public.pieces for select using (true);
create policy "pieces claimable" on public.pieces for update using (true) with check (true);
create policy "pieces seedable"  on public.pieces for insert with check (true);

-- turn on Realtime for this table
alter publication supabase_realtime add table public.pieces;
alter table public.pieces replica identity full;
```

> If the table is already in the publication, skip the `alter publication`
> line (running it twice errors) — you can also just toggle the table on in
> **Database → Publications → supabase_realtime**.

### Environment variables

Copy `.env.local.example` to `.env.local` and fill both values in from
**Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

The admin status line shows `LINK: OK` when they are wired
up. If they are missing the app still runs, but **only across tabs on one
machine** (localStorage + BroadcastChannel) — phones will not sync. That mode
is for development only and the status line shows `LINK: LOCAL` in red.

---

## 2. Run it

```bash
npm install
npm run dev            # http://localhost:3000
```

Production:

```bash
npm run build && npm start
```

For a real fest, deploy it anywhere Next.js runs (Vercel is the easy one) or
run `npm run dev -- -H 0.0.0.0` on the laptop and point the phones at
`http://<laptop-ip>:3000`. **The QR codes encode whatever origin the admin
page was opened from**, so print them from the final host URL.

Type checking: `npm run typecheck`.

---

## 3. Pages

| Route       | Who uses it | What it does |
| ----------- | ----------- | ------------ |
| `/`         | organiser   | live “PIECES: n / 9 EARNED” readout, **START NEW TEAM**, **OPEN STAGE**, 9 QR codes with **PNG** export, session stamp |
| `/stage`    | laptop      | board + piece tray, drag & drop, STAGE CLEARED sequence, auto reset |
| `/qr/1…9`   | phones      | claims a piece (instantly or after the minigame), then SUCCESS / LOCKED |

### The `pieces` table

| column      | type          | meaning |
| ----------- | ------------- | ------- |
| `id`        | `int` (PK)    | 1–9, also the QR number **and** the board slot |
| `earned`    | `boolean`     | claimed by a phone |
| `earned_at` | `timestamptz` | when it was claimed |

`START NEW TEAM` sets every row back to `earned = false`. This is also what
`/stage` does automatically after the STAGE CLEARED screen, so the QR pages
become scannable again for the next team.

---

## 4. Swapping the puzzle image

The placeholder in `public/puzzle/base.jpg` is a generated space scene
(planet, ring, grid, stars — no text). To use your own art:

1. Drop a **square** JPEG/PNG into `public/puzzle/` (e.g. `college.jpg`).
2. Either keep the name `base.jpg`, or change one constant in
   [`lib/config.ts`](lib/config.ts):

```ts
export const PUZZLE_IMAGE = "/puzzle/college.jpg";
```

That constant feeds the board, the tray thumbnails, the drag ghost and the
QR-2 sliding puzzle tiles, so a single edit re-skins the whole game. Busy,
high-contrast images with an obvious orientation make the jigsaw easier to
solve than flat/blurry ones.

---

## 5. Printing the QR codes

1. Open `/` on the final host URL.
2. Each of the 9 cells shows a mono caption — `QR 02 // SLIDING` for
   QR 2/4/6/8, `QR 01 // DIRECT` for the rest.
3. Click the **↓** button → a `orbit-qr-0n.png` (1000×1000, print-ready:
   black modules on white with an 8% quiet zone) is downloaded.
4. Print all 9 at ≥8 cm and scatter them. Players scan them with the phone
   camera — no app needed.

> The codes shown *on screen* are inverted (light modules on black) to match
> the cockpit design; the PNG export is always standard black-on-white so it
> prints and scans anywhere. Every current iOS/Android camera reads both.

---

## 6. Minigames (QR 2 / 4 / 6 / 8)

| QR | File | Game |
| -- | ---- | ---- |
| 2  | [`minigames/SlidingPuzzle.tsx`](minigames/SlidingPuzzle.tsx) | 3×3 sliding tiles cut from the puzzle image (always dealt solvable) |
| 4  | [`minigames/MemoryFlip.tsx`](minigames/MemoryFlip.tsx) | 4×4 memory flip, 8 geometric glyph pairs |
| 6  | [`minigames/SequenceTap.tsx`](minigames/SequenceTap.tsx) | watch a 5-pad sequence, repeat it (wrong pad = replay, never locked) |
| 8  | [`minigames/MazeGame.tsx`](minigames/MazeGame.tsx) | 10×10 maze, tap or arrow buttons, deterministic layout per QR |

All four have infinite retries and a `RESET` / `REPLAY` control.

---

## 7. Phone replay rule

Kept deliberately simple, no accounts, no fingerprinting:

- When a QR successfully claims a piece the phone sets
  `sessionStorage["orbit_used_<id>"] = "1"`.
- A QR whose row in `pieces` is already `earned` shows the LOCKED screen
  (“PIECE ALREADY ACTIVE / PLEASE CLOSE THIS TAB”) — for that phone *and* for
  any other phone that scans the same code.
- After the organiser resets (or the stage auto-resets), `earned` is false
  again, so the flag is ignored and every QR page works again.

To reset a single phone manually, clear that tab's session storage (or open
the page in a private tab).

---

## 8. Sound familiar? File map

```
app/layout.tsx          fonts, viewport, global styles
app/globals.css         monochrome tokens, square-corner rule, piece filter
app/page.tsx            admin  (/)
app/stage/page.tsx      laptop stage  (/stage)
app/qr/[id]/page.tsx    phone claim page  (/qr/1…9)
components/SpaceBg.tsx  starfield + base layout wrapper
components/Panel.tsx    square panel
components/TerminalButton.tsx
lib/config.ts           puzzle image, QR→minigame map, session helpers
lib/supabase.ts         client, realtime subscription, row helpers
lib/jigsaw.ts           deterministic jigsaw geometry + getPieceSVG()
minigames/*.tsx         the four minigames
public/puzzle/base.jpg  placeholder artwork
```

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

**Main jigsaw artwork:** `public/puzzle/final.png` — a generated space scene
(planet, ring, grid, stars — no text). To use your own art:

1. Drop a **square** PNG into `public/puzzle/` (e.g. `college.png`).
   JPEGs are converted to PNG and the original JPG is deleted — this project
   ships no `.jpg` files.
2. Either keep the name `final.png`, or change one constant in
   [`lib/config.ts`](lib/config.ts):

```ts
export const PUZZLE_IMAGE = "/puzzle/college.png";
```

That constant feeds the board ghost, the tray thumbnails, the drag ghost and
the jigsaw pieces, so a single edit re-skins the whole game. Busy,
high-contrast images with an obvious orientation make the jigsaw easier to
solve than flat/blurry ones.

---

## 5. Printing the QR codes

1. Open `/` on the final host URL.
2. Each of the 9 cells shows a mono caption — `QR 02 // INTRUDER` for
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

Logic and level design ported from the four standalone
[Project Hail Mary](https://github.com/) HTML games, re-skinned to the
cockpit: flat monochrome, hairlines, square corners, mono labels. The
original audio layer and the coloured HUD are dropped.

| QR | File | Game |
| -- | ---- | ---- |
| 2  | [`minigames/IntruderScan.tsx`](minigames/IntruderScan.tsx) | **Identify the Alien Intruder** — six glyphs built from the same five properties; exactly one deviates. Select it and confirm. Positions reshuffle per session; the answer never changes. |
| 4  | [`minigames/AlienSignal.tsx`](minigames/AlienSignal.tsx) | **Decode the Alien Signal** — a word is dealt from a fixed 32-word pool and mapped to alien glyphs, plus 0–2 decoy glyphs. Type what the ciphertext decodes to. |
| 6  | [`minigames/Transmission.tsx`](minigames/Transmission.tsx) | **Decode the Corrupted Transmission** — stage 1 unscrambles six fixed anagrams; stage 2 reorders the six words into the sentence. Two hints, no timers. |
| 8  | [`minigames/CircuitGrid.tsx`](minigames/CircuitGrid.tsx) | **Repair the Energy Circuit** — a fixed 3×3 board of wires with fixed starting rotations. Tap to rotate, then trace power from SOURCE to RECEIVER. |

QR 6 and QR 8 are fully deterministic — every player sees the same puzzle.
QR 2 and QR 4 shuffle per session without ever changing what counts as a
correct answer. All four have infinite retries, and every deal is
guaranteed solvable.

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
lib/config.ts           main puzzle image, QR→minigame map, session helpers
lib/supabase.ts         client, realtime subscription, row helpers
lib/jigsaw.ts           deterministic jigsaw geometry + getPieceSVG()
minigames/IntruderScan  QR 02  identify the alien intruder
minigames/AlienSignal   QR 04  decode the alien signal
minigames/Transmission  QR 06  decode the corrupted transmission
minigames/CircuitGrid   QR 08  repair the energy circuit
public/puzzle/final.png main jigsaw artwork (stage ghost + 9 pieces)
```

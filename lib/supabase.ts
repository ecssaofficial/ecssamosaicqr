import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ALL_PIECE_IDS, TOTAL_PIECES } from "./config";

/**
 * The whole game state lives in one Supabase table:
 *
 *   create table public.pieces (
 *     id        int primary key,          -- 1..9
 *     earned    boolean not null default false,
 *     earned_at timestamptz
 *   );
 *
 * Realtime is enabled on it, so every screen (admin, /stage, all phones)
 * sees claims the moment they happen. See README.md for the full SQL.
 */
export type PieceRow = {
  id: number;
  earned: boolean;
  earned_at: string | null;
};

export type PieceMap = Record<number, PieceRow>;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/* ------------------------------------------------------------------ *
 * Local dev fallback.
 *
 * If the Supabase env vars are absent the game still runs, but only
 * across browser tabs on ONE machine (localStorage + BroadcastChannel).
 * Hand out the URL to a phone and it will not sync — so this is for
 * development only, and the admin page says so out loud when it is
 * active. Set the two env vars and this path is never used.
 * ------------------------------------------------------------------ */

const LOCAL_KEY = "orbit_pieces_local";
const LOCAL_CHANNEL = "orbit_pieces_local_channel";
let localChannel: BroadcastChannel | null = null;

function emptyRows(): PieceRow[] {
  return ALL_PIECE_IDS.map((id) => ({ id, earned: false, earned_at: null }));
}

function normalize(rows: PieceRow[] | null | undefined): PieceRow[] {
  const byId = new Map<number, PieceRow>();
  for (const row of rows ?? []) {
    if (row && typeof row.id === "number") {
      byId.set(row.id, {
        id: row.id,
        earned: Boolean(row.earned),
        earned_at: row.earned_at ?? null,
      });
    }
  }
  return emptyRows().map((base) => byId.get(base.id) ?? base);
}

function channel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!localChannel) localChannel = new BroadcastChannel(LOCAL_CHANNEL);
  return localChannel;
}

function readLocal(): PieceRow[] {
  if (typeof window === "undefined") return emptyRows();
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return emptyRows();
    return normalize(JSON.parse(raw) as PieceRow[]);
  } catch {
    return emptyRows();
  }
}

function writeLocal(rows: PieceRow[]): void {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
  channel()?.postMessage("changed");
}

/* ------------------------------------------------------------------ *
 * Public data API — identical whether Supabase or the fallback is used.
 * ------------------------------------------------------------------ */

export async function fetchPieces(): Promise<PieceRow[]> {
  const supabase = getClient();
  if (!supabase) return readLocal();

  const { data, error } = await supabase
    .from("pieces")
    .select("id,earned,earned_at")
    .order("id");

  if (error) {
    console.error("[orbit] could not read pieces:", error.message);
    return emptyRows();
  }
  return normalize(data as PieceRow[]);
}

export async function earnPiece(id: number): Promise<void> {
  const earnedAt = new Date().toISOString();
  const supabase = getClient();

  if (!supabase) {
    const rows = readLocal().map((row) =>
      row.id === id ? { id: row.id, earned: true, earned_at: earnedAt } : row,
    );
    writeLocal(rows);
    return;
  }

  const { error } = await supabase
    .from("pieces")
    .upsert({ id, earned: true, earned_at: earnedAt }, { onConflict: "id" });

  if (error) console.error("[orbit] could not award piece:", error.message);
}

export async function resetPieces(): Promise<void> {
  const supabase = getClient();

  if (!supabase) {
    writeLocal(emptyRows());
    return;
  }

  // .gte keeps the statement explicitly scoped to the 9 rows.
  const { error } = await supabase
    .from("pieces")
    .update({ earned: false, earned_at: null })
    .gte("id", 1)
    .lte("id", TOTAL_PIECES);

  if (error) console.error("[orbit] could not reset pieces:", error.message);
}

let channelCounter = 0;

/** Subscribe to any change on the pieces table. Returns an unsubscribe fn. */
export function subscribePieces(onChange: () => void): () => void {
  const supabase = getClient();

  if (!supabase) {
    const bc = channel();
    if (!bc) return () => {};
    const handler = () => onChange();
    bc.addEventListener("message", handler);
    return () => bc.removeEventListener("message", handler);
  }

  channelCounter += 1;
  const channelName = `orbit-pieces-${channelCounter}`;

  // The listener must be registered before subscribe().
  const rt = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "pieces" },
      () => onChange(),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(rt);
  };
}

/** Link segment of the admin status line. Red semantics only via the
 *  caller: "LOCAL" means phones will not sync. */
export function dataSourceLabel(): string {
  return isSupabaseConfigured ? "LINK: OK" : "LINK: LOCAL";
}

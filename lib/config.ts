/**
 * ORBIT — game configuration.
 *
 * Everything a fest organiser might want to tweak lives here.
 */

/**
 * Deploy prefix. GitHub Pages serves a project site from
 * `/repo/`, so every absolute URL is built with `siteUrl()` /
 * `assetUrl()`. It is empty locally and for any root-domain host.
 * The workflow in .github/workflows/nextjs.yml sets it at build time.
 */
export const BASE_PATH = (
  process.env.NEXT_PUBLIC_BASE_PATH ?? ""
).replace(/\/+$/, "");

/** Prefix a site-absolute path ("/stage") for the current host. */
export function siteUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}

/** The puzzle artwork. Swap the file OR point this at a new path. */
export const PUZZLE_IMAGE = "/puzzle/base.jpg";

/** QR ids that are gated behind a minigame. Everything else awards instantly. */
export type MinigameType = "sliding" | "memory" | "sequence" | "maze";

export const MINIGAME_QRS: Record<number, MinigameType> = {
  2: "sliding",
  4: "memory",
  6: "sequence",
  8: "maze",
};

/** QR 1,3,5,7,9 = instant piece. */
export const DIRECT_QRS = [1, 3, 5, 7, 9];

export const TOTAL_PIECES = 9;

export const ALL_PIECE_IDS: number[] = Array.from(
  { length: TOTAL_PIECES },
  (_, i) => i + 1,
);

export function isMinigameQR(id: number): boolean {
  return Boolean(MINIGAME_QRS[id]);
}

export function minigameFor(id: number): MinigameType | null {
  return MINIGAME_QRS[id] ?? null;
}

export function isValidQrId(id: number): boolean {
  return Number.isInteger(id) && id >= 1 && id <= TOTAL_PIECES;
}

/** Absolute path of a QR page — used for the printed codes. */
export function qrPath(id: number): string {
  // Trailing slash keeps static hosts (GitHub Pages) on the directory URL.
  return siteUrl(`/qr/${id}/`);
}

export function label(n: number): string {
  return String(n).padStart(2, "0");
}

/* ------------------------------------------------------------------ *
 * Phone replay flag (section 8) — sessionStorage only, no accounts.
 * ------------------------------------------------------------------ */

export function usedFlagKey(id: number): string {
  return `orbit_used_${id}`;
}

export function markQrUsed(id: number): void {
  try {
    window.sessionStorage.setItem(usedFlagKey(id), "1");
  } catch {
    /* sessionStorage unavailable (private mode) — replay rule is advisory */
  }
}

export function isQrMarkedUsed(id: number): boolean {
  try {
    return window.sessionStorage.getItem(usedFlagKey(id)) === "1";
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Session stamp shown in the admin footer.
 * ------------------------------------------------------------------ */

const SESSION_KEY = "orbit_last_reset";

export function readSessionStamp(): string | null {
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function writeSessionStamp(at: Date = new Date()): string {
  const iso = at.toISOString();
  try {
    window.localStorage.setItem(SESSION_KEY, iso);
  } catch {
    /* ignore */
  }
  return iso;
}

/** Human readable stamp for the footer. */
export function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

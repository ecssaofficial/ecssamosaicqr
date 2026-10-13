"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import Panel from "@/components/Panel";
import SpaceBg from "@/components/SpaceBg";
import TerminalButton from "@/components/TerminalButton";
import {
  ALL_PIECE_IDS,
  MINIGAME_CAPTION,
  TOTAL_PIECES,
  formatStamp,
  label,
  minigameFor,
  qrPath,
  readSessionStamp,
  siteUrl,
  writeSessionStamp,
} from "@/lib/config";
import {
  dataSourceLabel,
  fetchPieces,
  isSupabaseConfigured,
  resetPieces,
  subscribePieces,
  type PieceRow,
} from "@/lib/supabase";

const EXPORT_SIZE = 1000;
const EXPORT_QR_SIZE = 840;

/**
 * Downloads the code and nothing else: white ground, black modules, 8% quiet
 * zone — no frame, no caption, no URL, so it prints and scans anywhere and
 * can be handed to an external QR generator unchanged.
 */
function renderQrPng(qrCanvas: HTMLCanvasElement, id: number) {
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_SIZE;
  canvas.height = EXPORT_SIZE;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);

  const inset = Math.round((EXPORT_SIZE - EXPORT_QR_SIZE) / 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qrCanvas, inset, inset, EXPORT_QR_SIZE, EXPORT_QR_SIZE);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `orbit-qr-${label(id)}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, "image/png");
}

export default function AdminPage() {
  const [pieces, setPieces] = useState<PieceRow[] | null>(null);
  const [origin, setOrigin] = useState<string | null>(null);
  const [stamp, setStamp] = useState<string | null>(null);
  const [exportId, setExportId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const exportHostRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    setPieces(await fetchPieces());
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    const stored = readSessionStamp();
    setStamp(stored ?? writeSessionStamp());
    void refresh();
    return subscribePieces(() => {
      void refresh();
    });
  }, [refresh]);

  // The hidden QR canvas only exists while an export is pending; once the
  // browser has painted it we save it as the PNG.
  useEffect(() => {
    if (exportId === null || !origin) return;
    const canvas = exportHostRef.current?.querySelector("canvas");
    setExportId(null);
    if (!canvas) return;
    renderQrPng(canvas, exportId);
  }, [exportId, origin]);

  const earned = pieces?.filter((p) => p.earned).length ?? 0;

  async function startNewTeam() {
    setBusy(true);
    await resetPieces();
    setStamp(writeSessionStamp());
    await refresh();
    setBusy(false);
  }

  /** PIECES 03/09 · SESSION 2026-10-13T12:40 · LINK: OK */
  const statusHead = [
    `PIECES ${label(earned)}/${label(TOTAL_PIECES)}`,
    `SESSION ${stamp ? formatStamp(stamp) : "—"}`,
  ].join(" · ");

  return (
    <SpaceBg>
      <header className="border-b border-white/10 px-6 pb-4 pt-6">
        <h1 className="text-2xl uppercase tracking-[0.35em] text-ink">
          ORBIT // CONTROL
        </h1>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-white/45">
          {statusHead} ·{" "}
          {/* red only when the link is broken — status semantics, thin usage */}
          <span className={isSupabaseConfigured ? "text-white/45" : "text-danger"}>
            {dataSourceLabel()}
          </span>
        </p>
      </header>

      <main className="grid flex-1 gap-6 p-6 lg:grid-cols-2">
        <Panel label="GAME CONTROL" headerRight="LIVE" className="h-fit">
          <div className="border border-white/15 bg-space px-5 py-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/45">
              PIECES EARNED
            </p>
            <p className="mt-2 font-mono text-4xl leading-none tracking-[0.1em] text-ink">
              {pieces ? label(earned) : "—"}
              <span className="text-white/25">/{label(TOTAL_PIECES)}</span>
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <TerminalButton
              variant="primary"
              onClick={startNewTeam}
              disabled={busy}
            >
              START NEW TEAM
            </TerminalButton>
            <TerminalButton
              onClick={() => window.open(siteUrl("/stage/"), "_blank", "noopener")}
            >
              OPEN STAGE
            </TerminalButton>
          </div>

          <dl className="mt-6 border-t border-white/10 pt-4 font-mono text-[10px] uppercase tracking-[0.3em]">
            {ALL_PIECE_IDS.map((id) => (
              <div
                key={id}
                className="flex items-center justify-between border-b border-white/10 py-2 last:border-b-0"
              >
                <dt className="text-white/45">PIECE {label(id)}</dt>
                <dd
                  className={
                    pieces?.[id - 1]?.earned ? "text-ink" : "text-white/25"
                  }
                >
                  {pieces?.[id - 1]?.earned ? "ACTIVE" : "IDLE"}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel label="QR CODES" headerRight="3×3" className="h-fit">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ALL_PIECE_IDS.map((id) => {
              const game = minigameFor(id);
              return (
                <div
                  key={id}
                  className="flex flex-col items-center border border-white/15 bg-space p-3"
                >
                  <div className="mt-1 flex h-[96px] w-[96px] items-center justify-center border border-white/10">
                    {origin ? (
                      <QRCodeCanvas
                        value={`${origin}${qrPath(id)}`}
                        size={94}
                        level="M"
                        marginSize={1}
                        bgColor="#000000"
                        fgColor="#F5F5F5"
                      />
                    ) : (
                      <span className="h-2 w-2 bg-ink animate-blink" />
                    )}
                  </div>
                  <p className="mt-3 w-full text-center font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">
                    QR {label(id)} //{" "}
                    {game ? MINIGAME_CAPTION[game] : "DIRECT"}
                  </p>
                  <TerminalButton
                    className="mt-3 h-7 w-7 px-0 py-0 text-[12px]"
                    onClick={() => setExportId(id)}
                    disabled={!origin}
                    aria-label={`Download QR ${label(id)} as PNG`}
                    title="DOWNLOAD PNG"
                  >
                    ↓
                  </TerminalButton>
                </div>
              );
            })}
          </div>
        </Panel>
      </main>

      {exportId !== null && origin ? (
        <div
          ref={exportHostRef}
          aria-hidden
          style={{
            position: "fixed",
            left: -100000,
            top: 0,
            opacity: 0,
            pointerEvents: "none",
          }}
        >
          <QRCodeCanvas
            value={`${origin}${qrPath(exportId)}`}
            size={EXPORT_QR_SIZE}
            level="M"
            marginSize={2}
            bgColor="#FFFFFF"
            fgColor="#000000"
          />
        </div>
      ) : null}
    </SpaceBg>
  );
}

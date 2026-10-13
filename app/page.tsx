"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import Panel from "@/components/Panel";
import SpaceBg from "@/components/SpaceBg";
import TerminalButton from "@/components/TerminalButton";
import {
  ALL_PIECE_IDS,
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
const EXPORT_QR_SIZE = 760;

const SHEET_FONT = "'Space Grotesk', system-ui, sans-serif";

/** Prints one QR: white modules on navy, thin cyan frame, "QR 01" caption. */
function renderQrSheet(qrCanvas: HTMLCanvasElement, id: number, origin: string) {
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_SIZE;
  canvas.height = EXPORT_SIZE;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#0B1220";
  ctx.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);

  ctx.strokeStyle = "#22D3EE";
  ctx.lineWidth = 3;
  ctx.strokeRect(25, 25, EXPORT_SIZE - 50, EXPORT_SIZE - 50);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#22D3EE";
  const captionCtx = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in captionCtx) captionCtx.letterSpacing = "14px";
  ctx.font = `600 66px ${SHEET_FONT}`;
  ctx.fillText(`QR ${label(id)}`, EXPORT_SIZE / 2, 112);
  if ("letterSpacing" in captionCtx) captionCtx.letterSpacing = "0px";

  const qrBox = EXPORT_QR_SIZE;
  const qrY = 190;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qrCanvas, (EXPORT_SIZE - qrBox) / 2, qrY, qrBox, qrBox);

  const game = minigameFor(id);
  ctx.fillStyle = "#64748B";
  ctx.font = `400 30px ${SHEET_FONT}`;
  if ("letterSpacing" in captionCtx) captionCtx.letterSpacing = "6px";
  ctx.fillText(
    game ? `MINIGAME: ${game.toUpperCase()}` : "DIRECT PIECE",
    EXPORT_SIZE / 2,
    190 + qrBox + 62,
  );
  if ("letterSpacing" in captionCtx) captionCtx.letterSpacing = "0px";

  ctx.fillStyle = "#64748B";
  ctx.font = `300 22px ${SHEET_FONT}`;
  ctx.fillText(`${origin}${qrPath(id)}`, EXPORT_SIZE / 2, EXPORT_SIZE - 68);

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
  // browser has painted it we compose the print sheet and save it.
  useEffect(() => {
    if (exportId === null || !origin) return;
    const canvas = exportHostRef.current?.querySelector("canvas");
    setExportId(null);
    if (!canvas) return;
    renderQrSheet(canvas, exportId, origin);
  }, [exportId, origin]);

  const earned = pieces?.filter((p) => p.earned).length ?? 0;

  async function startNewTeam() {
    setBusy(true);
    await resetPieces();
    setStamp(writeSessionStamp());
    await refresh();
    setBusy(false);
  }

  return (
    <SpaceBg>
      <header className="flex flex-wrap items-end justify-between gap-3 px-6 pt-6">
        <div>
          <h1 className="text-2xl uppercase tracking-[0.4em] text-ink">
            ORBIT // CONTROL
          </h1>
          <p className="mt-1 text-[10px] uppercase tracking-[0.4em] text-dim">
            STAGE 01
          </p>
        </div>
        <p
          className={`text-[10px] uppercase tracking-[0.3em] ${
            isSupabaseConfigured ? "text-success" : "text-danger"
          }`}
        >
          {dataSourceLabel()}
        </p>
      </header>

      <main className="grid flex-1 gap-6 p-6 lg:grid-cols-2">
        <Panel label="GAME CONTROL" className="h-fit">
          <div className="border border-dim bg-space px-5 py-6">
            <p className="text-[10px] uppercase tracking-[0.35em] text-dim">
              PIECES
            </p>
            <p className="mt-2 text-4xl tracking-[0.12em] text-ink">
              {pieces ? `${earned} / ${TOTAL_PIECES}` : `— / ${TOTAL_PIECES}`}
              <span className="ml-3 text-sm tracking-[0.35em] text-dim">
                EARNED
              </span>
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

          <dl className="mt-6 space-y-2 border-t border-dim pt-4 text-[10px] uppercase tracking-[0.3em] text-dim">
            {ALL_PIECE_IDS.map((id) => (
              <div key={id} className="flex items-center justify-between">
                <dt>PIECE {label(id)}</dt>
                <dd
                  className={
                    pieces?.[id - 1]?.earned ? "text-success" : "text-dim"
                  }
                >
                  {pieces?.[id - 1]?.earned ? "ACTIVE" : "IDLE"}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel label="QR CODES" className="h-fit">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ALL_PIECE_IDS.map((id) => {
              const game = minigameFor(id);
              return (
                <div
                  key={id}
                  className="flex flex-col items-center border border-dim bg-space p-3"
                >
                  <p className="w-full text-[10px] uppercase tracking-[0.3em] text-ink">
                    QR {label(id)}
                  </p>
                  <div className="mt-3 flex h-[96px] w-[96px] items-center justify-center bg-panel">
                    {origin ? (
                      <QRCodeCanvas
                        value={`${origin}${qrPath(id)}`}
                        size={96}
                        level="M"
                        marginSize={1}
                        bgColor="#0B1220"
                        fgColor="#FFFFFF"
                      />
                    ) : (
                      <span className="h-2 w-2 bg-primary animate-blink" />
                    )}
                  </div>
                  <p
                    className={`mt-3 w-full text-[9px] uppercase tracking-[0.25em] ${
                      game ? "text-secondary" : "text-dim"
                    }`}
                  >
                    {game ? `GAME: ${game.toUpperCase()}` : "DIRECT"}
                  </p>
                  <TerminalButton
                    className="mt-3 w-full px-2 py-1 text-[9px]"
                    onClick={() => setExportId(id)}
                    disabled={!origin}
                  >
                    PNG
                  </TerminalButton>
                </div>
              );
            })}
          </div>
        </Panel>
      </main>

      <footer className="px-6 pb-6 pt-2 text-[10px] uppercase tracking-[0.3em] text-dim">
        SESSION: {stamp ? formatStamp(stamp) : "—"}
      </footer>

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
            bgColor="#0B1220"
            fgColor="#FFFFFF"
          />
        </div>
      ) : null}
    </SpaceBg>
  );
}

import { ALL_PIECE_IDS } from "@/lib/config";
import QrClaim from "./QrClaim";

/**
 * Static export (GitHub Pages): the nine printed codes are pre-rendered at
 * build time. /qr/anything-else simply does not exist on the deployed site.
 */
export function generateStaticParams() {
  return ALL_PIECE_IDS.map((id) => ({ id: String(id) }));
}

export default function QrPage({ params }: { params: { id: string } }) {
  return <QrClaim id={params.id} />;
}

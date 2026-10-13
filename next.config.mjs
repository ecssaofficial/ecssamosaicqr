/**
 * Sub-path hosting (GitHub Pages serves a project site from /repo/).
 *
 * The workflow passes NEXT_PUBLIC_BASE_PATH. If it is missing we fall back to
 * the repository name while running inside GitHub Actions, so the stock
 * workflow deploys correctly without manual configuration. User / organisation
 * sites (…github.io) are served from the domain root and get no prefix.
 */
function normalize(value) {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}` : "";
}

function resolveBasePath() {
  if (process.env.NEXT_PUBLIC_BASE_PATH !== undefined) {
    return normalize(process.env.NEXT_PUBLIC_BASE_PATH);
  }
  const repo = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
  const inActions = process.env.GITHUB_ACTIONS === "true";
  if (inActions && repo && !repo.toLowerCase().endsWith(".github.io")) {
    return normalize(repo);
  }
  return "";
}

const basePath = resolveBasePath();

// Make the prefix visible to the client bundle (inlined at build time) so the
// QR codes and the puzzle image URL match the hosting prefix exactly.
process.env.NEXT_PUBLIC_BASE_PATH = basePath;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Static HTML export — this is what .github/workflows/nextjs.yml uploads.
  output: "export",

  // Directory URLs (/qr/1/) so every static host can serve the printed codes.
  trailingSlash: true,

  // No server-side image pipeline in a static export.
  images: { unoptimized: true },

  basePath,
};

export default nextConfig;

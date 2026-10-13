import { fileURLToPath } from "node:url";

/**
 * PostCSS config.
 *
 * The third plugin lives in its own file (postcss.strip-gradient.cjs) and
 * is referenced by absolute path: Next.js resolves PostCSS plugins by name
 * through require.resolve(), which does not accept relative specifiers.
 * See that file for what it strips and why.
 *
 * @type {import('postcss-load-config').Config}
 */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
    [fileURLToPath(new URL("./postcss.strip-gradient.cjs", import.meta.url))]:
      {},
  },
};

export default config;

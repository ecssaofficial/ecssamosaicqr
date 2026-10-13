import type { Config } from "tailwindcss";

/**
 * ORBIT colour rules:
 *
 *  1. FLAT PALETTE ONLY. Black, white and the space palette below are the
 *     only colours in the UI — no tints, no shades, no alpha-modified
 *     fills/borders/text. Every surface is one of these solid values.
 *  2. NO GRADIENTS, anywhere. The gradient utilities are pinned to `none`
 *     below so a gradient cannot render even if one is written by mistake.
 *  3. SQUARE CORNERS ONLY. Every radius utility resolves to 0.
 *  4. Alpha is allowed in exactly one place: soft glow shadows (an effect,
 *     not a colour fill) — see the glow utilities in globals.css.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./minigames/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        space: "#050810", // flat space background
        panel: "#0B1220", // panel / box background
        primary: "#22D3EE", // cyan
        secondary: "#8B5CF6", // violet
        success: "#22C55E", // green
        danger: "#EF4444", // red
        ink: "#E2E8F0", // primary text
        dim: "#64748B", // secondary text / quiet structure
        cleared: "#052E16", // win-screen background
      },
      fontFamily: {
        sans: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
      },
      // gradients are never allowed — every gradient utility renders nothing
      backgroundImage: {
        "gradient-to-t": "none",
        "gradient-to-tr": "none",
        "gradient-to-r": "none",
        "gradient-to-br": "none",
        "gradient-to-b": "none",
        "gradient-to-bl": "none",
        "gradient-to-l": "none",
        "gradient-to-tl": "none",
      },
    },
    // SQUARE CORNERS ONLY — every radius utility resolves to 0.
    borderRadius: {
      none: "0px",
      sm: "0px",
      DEFAULT: "0px",
      md: "0px",
      lg: "0px",
      xl: "0px",
      "2xl": "0px",
      "3xl": "0px",
      full: "0px",
    },
  },
  plugins: [],
};

export default config;

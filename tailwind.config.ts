import type { Config } from "tailwindcss";

/**
 * ORBIT — monochrome spacecraft cockpit.
 *
 * PALETTE (strictly monochrome):
 *   #000000 background · #0A0A0A panel surface
 *   #F5F5F5 primary text / inverted surface · #FFFFFF white for structure
 *   Hairlines are white at low alpha (10 / 15 / 25 / 35 / 45%)
 *   #FF3B30 red is the ONLY hue, and only for locked / error / wrong-slot.
 *
 * RULES:
 *   1. No gradients anywhere (none are configured, none are used).
 *   2. No coloured shadows or glows — depth comes from borders and tone.
 *   3. Square corners only: every radius utility resolves to 0.
 *   4. Hierarchy comes from size, weight and opacity — never colour.
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
        space: "#000000", // cockpit background
        panel: "#0A0A0A", // instrument faceplate surface
        ink: "#F5F5F5", // primary text + inverted surfaces
        danger: "#FF3B30", // locked / error only
      },
      fontFamily: {
        sans: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "ui-monospace", "monospace"],
      },
      transitionDuration: {
        150: "150ms",
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

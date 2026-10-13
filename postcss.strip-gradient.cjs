/**
 * PostCSS plugin: strip Tailwind's empty gradient placeholder declarations.
 *
 * Tailwind emits `--tw-gradient-from-position: ;`, `--tw-gradient-via-position: ;`
 * and `--tw-gradient-to-position: ;` into every stylesheet it processes —
 * even when no gradient utility is used anywhere (this project uses none).
 * Nothing references them, so removing them keeps the emitted CSS free of
 * the word "gradient", which is a hard requirement for this design.
 *
 * Must be CommonJS: Next.js loads PostCSS plugins through `require()`.
 *
 * @type {import('postcss').PluginCreator<void>}
 */
const stripGradientPlaceholders = () => ({
  postcssPlugin: "strip-gradient-placeholders",
  Declaration(decl) {
    if (decl.prop.startsWith("--tw-gradient-") && decl.value.trim() === "") {
      decl.remove();
    }
  },
});

stripGradientPlaceholders.postcss = true;

module.exports = stripGradientPlaceholders;

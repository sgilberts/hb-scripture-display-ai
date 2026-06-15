/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/renderer/index.html",
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
    "./src/renderer/components/**/*.{js,ts,jsx,tsx}",
    "./src/shared/**/*.{js,ts}"
  ],
  theme: {
    extend: {
      colors: {
        "outline": "#86948a",
        "on-error-container": "#ffdad6",
        "background": "#131316",
        "live-preview-bg": "#000000",
        "secondary-container": "#ee9800",
        "surface-container-high": "#2a2a2d",
        "tertiary-fixed": "#d5e3fd",
        "surface-dim": "#131316",
        "secondary-fixed-dim": "#ffb95f",
        "on-surface": "#e4e1e6",
        "surface-container-highest": "#353438",
        "on-primary-container": "#00422b",
        "on-secondary-fixed-variant": "#653e00",
        "tertiary": "#b9c7e0",
        "outline-variant": "#3c4a42",
        "tertiary-fixed-dim": "#b9c7e0",
        "surface-container": "#1f1f22",
        "surface-bright": "#39393c",
        "primary": "#4edea3",
        "primary-container": "#10b981",
        "surface-tint": "#4edea3",
        "on-primary-fixed": "#002113",
        "error": "#ffb4ab",
        "on-tertiary-fixed-variant": "#3a485c",
        "inverse-on-surface": "#303033",
        "on-surface-variant": "#bbcabf",
        "status-online": "#4edea3",
        "surface-variant": "#353438",
        "on-tertiary": "#233144",
        "surface-container-lowest": "#0e0e11",
        "error-container": "#93000a",
        "on-primary": "#003824",
        "inverse-surface": "#e4e1e6",
        "tertiary-container": "#95a4bb",
        "primary-fixed": "#6ffbbe",
        "status-emergency": "#93000a",
        "on-background": "#e4e1e6",
        "on-secondary": "#472a00",
        "on-secondary-container": "#5b3800",
        "on-error": "#690005",
        "primary-fixed-dim": "#4edea3",
        "on-tertiary-container": "#2c3a4e",
        "on-primary-fixed-variant": "#005236",
        "inverse-primary": "#006c49",
        "surface-container-low": "#1b1b1e",
        "secondary-fixed": "#ffddb8",
        "on-tertiary-fixed": "#0d1c2f",
        "secondary": "#ffb95f",
        "on-secondary-fixed": "#2a1700",
        "surface": "#131316"
      },
      borderRadius: {
        "DEFAULT": "0.125rem",
        "lg": "0.25rem",
        "xl": "0.5rem",
        "full": "9999px"
      },
      spacing: {
        "panel-margin": "1px",
        "container-padding": "12px",
        "unit": "4px",
        "component-gap": "4px",
        "gutter": "8px"
      },
      fontFamily: {
        "label-caps": ["JetBrains Mono", "monospace"],
        "body-sm": ["Inter", "sans-serif"],
        "headline-md": ["Inter", "sans-serif"],
        "code-sm": ["JetBrains Mono", "monospace"],
        "display-lg": ["Inter", "sans-serif"],
        "status-nano": ["Inter", "sans-serif"]
      }
    }
  },
  plugins: []
};

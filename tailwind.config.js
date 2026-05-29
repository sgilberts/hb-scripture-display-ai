/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
    "./src/renderer/components/**/*.{js,ts,jsx,tsx}",
    "./src/shared/**/*.{js,ts}"
  ],
  theme: {
    extend: {}
  },
  plugins: []
};

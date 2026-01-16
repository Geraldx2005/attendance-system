/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nero: {
          350: "var(--color-nero-350)",
        },
      },
    },
  },
  plugins: [],
};

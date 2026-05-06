/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#f7f8fb",
        ink: "#172033",
        muted: "#637083",
        line: "#dbe2ee",
        brand: "#2563eb"
      },
      boxShadow: {
        panel: "0 12px 30px rgba(16, 24, 40, 0.08)"
      }
    }
  },
  plugins: []
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      opacity: {
        "3": "0.03",
        "8": "0.08",
        "12": "0.12",
        "15": "0.15",
        "35": "0.35",
        "45": "0.45",
        "85": "0.85"
      },
      fontFamily: {
        heading: ["Sora", "sans-serif"],
        body: ["Manrope", "sans-serif"]
      },
      colors: {
        ink: "#0A0F1C",
        panel: "#111827",
        mint: "#2dd4bf",
        ember: "#fb7185",
        neon: "#22d3ee"
      },
      boxShadow: {
        panel: "0 20px 40px -20px rgba(34, 211, 238, 0.35)"
      }
    }
  },
  plugins: []
};

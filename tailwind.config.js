/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0e1a",
        panel: "#111827",
        panel2: "#1a2232",
        border: "#243046",
        ink: "#e6edf6",
        dim: "#8b97ab",
        accent: "#6ee7b7",
        accent2: "#38bdf8",
        danger: "#f87171",
        warn: "#fbbf24",
        xp: "#a78bfa",
        streak: "#fb923c",
        high: "#22c55e",
        med: "#f59e0b",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(110, 231, 183, 0.25)",
        glowPurple: "0 0 20px rgba(167, 139, 250, 0.35)",
      },
      animation: {
        pulseSlow: "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

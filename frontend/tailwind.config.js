/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f8fafc",
        card: "#ffffff",
        line: "#e5e7eb",
        ink: "#111827",
        muted: "#6b7280",
        primary: "#2563eb",
        success: "#16a34a",
        warning: "#f59e0b",
        danger: "#dc2626",
      },
      boxShadow: {
        panel: "0 1px 2px rgba(17, 24, 39, 0.04)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "SFMono-Regular",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

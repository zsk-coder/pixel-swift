import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.vue",
    "./components/**/*.vue",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2563EB",
          dark: "#1D4ED8",
          light: "#3B82F6",
          50: "#EFF6FF",
          100: "#DBEAFE",
        },
        brand: {
          DEFAULT: "#2563EB",
          dark: "#1D4ED8",
          light: "#3B82F6",
          50: "#EFF6FF",
          100: "#DBEAFE",
        },
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        text: {
          primary: "#1F2937",
          secondary: "#6B7280",
        },
        surface: {
          DEFAULT: "#F9FAFB",
          card: "#FFFFFF",
          border: "#E5E7EB",
        },
        dark: {
          bg: "#111827",
          card: "#1F2937",
          text: "#F9FAFB",
          border: "#374151",
        },
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans SC", "system-ui", "sans-serif"],
      },
      fontSize: {
        "page-title": ["32px", { lineHeight: "1.2", fontWeight: "700" }],
        section: ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        body: ["16px", { lineHeight: "1.6", fontWeight: "400" }],
        btn: ["16px", { lineHeight: "1", fontWeight: "500" }],
        caption: ["14px", { lineHeight: "1.5", fontWeight: "400" }],
      },
      borderRadius: {
        btn: "8px",
        card: "12px",
        input: "8px",
        modal: "16px",
      },
      boxShadow: {
        low: "0 1px 2px rgba(0,0,0,0.05)",
        mid: "0 4px 6px rgba(0,0,0,0.1)",
        high: "0 10px 15px rgba(0,0,0,0.1)",
      },
      maxWidth: {
        content: "1200px",
      },
      spacing: {
        "4.5": "18px",
      },
    },
  },
  plugins: [],
} satisfies Config;

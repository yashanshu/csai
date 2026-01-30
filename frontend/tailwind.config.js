import daisyui from "daisyui";

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  daisyui: {
    themes: [
      {
        relay: {
          primary: "#1f7a5d",
          "primary-content": "#f6f4f1",
          secondary: "#d48a5d",
          "secondary-content": "#1a1917",
          accent: "#2b5f77",
          "accent-content": "#f6f4f1",
          neutral: "#1f2933",
          "neutral-content": "#f6f4f1",
          "base-100": "#f6f4f1",
          "base-200": "#ece6df",
          "base-300": "#ded6ce",
          "base-content": "#1a1917",
          info: "#2b5f77",
          success: "#2f855a",
          warning: "#c57b33",
          error: "#c2413b",
        },
      },
      {
        "relay-dark": {
          primary: "#6ee7b7",
          "primary-content": "#0b1110",
          secondary: "#f4b183",
          "secondary-content": "#1a1110",
          accent: "#7dd3fc",
          "accent-content": "#0b1110",
          neutral: "#111827",
          "neutral-content": "#e5e7eb",
          "base-100": "#0b0f14",
          "base-200": "#111827",
          "base-300": "#1f2937",
          "base-content": "#e5e7eb",
          info: "#38bdf8",
          success: "#34d399",
          warning: "#f59e0b",
          error: "#f87171",
        },
      },
      "light",
    ],
  },
  plugins: [daisyui],
};

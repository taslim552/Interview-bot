// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#050b18",
          900: "#0b1426",
          800: "#111f3b"
        },
        slatepro: {
          200: "#c8d3e6",
          300: "#9fb3cc",
          400: "#6f87a6"
        },
        accent: {
          500: "#42a5ff",
          400: "#6cb9ff"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(108, 185, 255, 0.35), 0 0 32px rgba(66, 165, 255, 0.25)",
        card: "0 24px 60px rgba(4, 10, 24, 0.55)"
      },
      fontFamily: {
        sans: ["Sora", "Manrope", "Segoe UI", "Tahoma", "Geneva", "Verdana", "sans-serif"]
      }
    }
  },
  plugins: []
};

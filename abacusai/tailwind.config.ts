import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        surface: "#0b1020",
        panel: "#121a31",
        accent: "#6d8bff"
      }
    }
  },
  plugins: []
}

export default config

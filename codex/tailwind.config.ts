import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 18px 50px rgba(20, 24, 32, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;

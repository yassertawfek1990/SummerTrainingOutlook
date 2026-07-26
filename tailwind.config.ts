import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1a1a2e",
        gold: "#d4af37",
        silver: "#c0c0c0",
        bronze: "#cd7f32",
      },
    },
  },
  plugins: [],
};
export default config;

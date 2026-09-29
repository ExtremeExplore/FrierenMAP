import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { viteSingleFile } from "vite-plugin-singlefile"
import path from "path" // Přidá se tohle pro práci s cestami

export default defineConfig({
  base: './',
  plugins: [
    react(),
                            viteSingleFile()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"), // Tady Rollupovi vysvětlíme, co je to "@"
    },
  },
});

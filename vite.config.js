import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { analyzer } from "vite-bundle-analyzer";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === "analyze" && analyzer({ analyzerMode: "server" }),
  ].filter(Boolean),

  server: {
    port: 5175,
  },

  build: {
    chunkSizeWarningLimit: 150,

    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "vendor-react", test: /node_modules\/react(-dom)?\// },
            { name: "vendor-router", test: /node_modules\/react-router(-dom)?\// },
            { name: "vendor-icons", test: /node_modules\/lucide-react\// },
            { name: "vendor-docx", test: /node_modules\/(docx|html-to-docx)\// },
          ],
        },
      },
    },
  },
}));
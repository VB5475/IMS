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
        manualChunks(id) {
          if (id.includes("node_modules/xlsx")) return "vendor-xlsx";
          if (id.includes("node_modules/jspdf")) return "vendor-jspdf";
          if (id.includes("node_modules/qrcode")) return "vendor-qrcode";
          if (id.includes("html2canvas")) return "vendor-html2canvas";
          if (id.includes("node_modules/qz-tray")) return "vendor-qz-tray";
          if (id.includes("react-datepicker")) return "vendor-datepicker";
          if (id.includes("dayjs")) return "vendor-dayjs";
          if (/node_modules\/react(-dom)?\//.test(id)) return "vendor-react";
          if (/node_modules\/react-router(-dom)?\//.test(id)) return "vendor-router";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (/node_modules\/(docx|html-to-docx)\//.test(id)) return "vendor-docx";
        },
      },
    },
  },
}));
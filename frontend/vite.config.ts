import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.VITE_PORT || 8080);
  const apiUrl = (env.VITE_API_URL || "http://127.0.0.1:4000")
    .replace(/localhost/gi, "127.0.0.1")
    .replace("[::1]", "127.0.0.1");

  return {
    server: {
      host: true,
      port,
      hmr: {
        overlay: false,
      },
      proxy: {
        "/api": {
          target: apiUrl,
          changeOrigin: true,
          cookiePathRewrite: "/",
        },
      },
    },
    plugins: [react()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react/jsx-runtime", "react-router-dom"],
    },
  };
});

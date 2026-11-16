import { Readable } from "node:stream";
import { defineConfig } from "vite";

const networkUrl = "https://github.com/official-pikafish/Networks/releases/download/master-net/pikafish.nnue";
const networkPaths = new Set(["/engine/pikafish.nnue", "/engine/pikafish-network.php"]);

function isolationHeaders() {
  return {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Resource-Policy": "same-origin"
  };
}

async function serveNetwork(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.end("Method not allowed");
    return;
  }

  try {
    const response = await fetch(networkUrl, { method: req.method });
    if (!response.ok) {
      res.statusCode = response.status;
      res.end(`Pikafish NNUE download failed: ${response.status}`);
      return;
    }

    res.statusCode = response.status;
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Cache-Control", "public, max-age=86400");
    const contentLength = response.headers.get("content-length");
    if (contentLength) res.setHeader("Content-Length", contentLength);
    if (req.method === "HEAD" || !response.body) {
      res.end();
      return;
    }
    Readable.fromWeb(response.body).on("error", (error) => {
      console.error("Pikafish NNUE stream failed:", error);
      if (!res.headersSent) res.statusCode = 502;
      res.destroy(error);
    }).pipe(res);
  } catch (error) {
    console.error("Pikafish NNUE proxy failed:", error);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end("Unable to fetch the Pikafish NNUE network.");
    } else {
      res.destroy(error);
    }
  }
}

function pikafishNetwork() {
  const handler = (req, res, next) => {
    if (!networkPaths.has(req.url?.split("?")[0] ?? "")) return next();
    void serveNetwork(req, res);
  };

  return {
    name: "pikafish-network-proxy",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    }
  };
}

export default defineConfig({
  plugins: [pikafishNetwork()],
  server: { headers: isolationHeaders() },
  preview: { headers: isolationHeaders() }
});

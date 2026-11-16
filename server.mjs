import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { Readable } from "node:stream";

const distRoot = resolve("dist");
const networkUrl = "https://github.com/official-pikafish/Networks/releases/download/master-net/pikafish.nnue";
const port = Number(process.env.PORT ?? 4173);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm"
};

function setIsolationHeaders(response) {
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
}

async function serveNetwork(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
    return;
  }

  try {
    const upstream = await fetch(networkUrl, { method: request.method });
    if (!upstream.ok) {
      response.writeHead(upstream.status).end(`Pikafish NNUE download failed: ${upstream.status}`);
      return;
    }

    const headers = {
      "Content-Type": "application/octet-stream",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Cache-Control": "public, max-age=86400"
    };
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers["Content-Length"] = contentLength;
    response.writeHead(upstream.status, headers);
    if (request.method === "HEAD" || !upstream.body) {
      response.end();
      return;
    }
    Readable.fromWeb(upstream.body).on("error", (error) => {
      console.error("Pikafish NNUE stream failed:", error);
      response.destroy(error);
    }).pipe(response);
  } catch (error) {
    console.error("Pikafish NNUE proxy failed:", error);
    if (!response.headersSent) response.writeHead(502).end("Unable to fetch the Pikafish NNUE network.");
    else response.destroy(error);
  }
}

createServer((request, response) => {
  setIsolationHeaders(response);
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (pathname === "/engine/pikafish.nnue") {
    void serveNetwork(request, response);
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
    return;
  }

  let relativePath;
  try {
    relativePath = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  } catch {
    response.writeHead(400).end("Invalid path");
    return;
  }
  const filePath = resolve(distRoot, `.${relativePath}`);
  if (filePath !== distRoot && !filePath.startsWith(`${distRoot}${sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    if (!statSync(filePath).isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }
  } catch {
    response.writeHead(404).end("Not found");
    return;
  }

  response.setHeader("Content-Type", mimeTypes[extname(filePath)] ?? "application/octet-stream");
  response.setHeader("Cache-Control", "no-cache");
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(filePath).on("error", (error) => {
    console.error("Static file read failed:", error);
    if (!response.headersSent) response.writeHead(500);
    response.destroy(error);
  }).pipe(response);
}).listen(port, () => {
  console.log(`Xiangqi Studio is running at http://localhost:${port}`);
});

let command;

async function fetchNetwork(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`NNUE-hämtning misslyckades: ${response.status}`);
  const total = Number(response.headers.get("content-length")) || 0;
  if (!response.body) return new Uint8Array(await response.arrayBuffer());

  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    self.postMessage({ type: "net-progress", loaded, total });
  }

  const network = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    network.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return network;
}

self.addEventListener("message", async ({ data }) => {
  if (data?.type === "init") {
    try {
      const networkPromise = fetchNetwork(data.netUrl);
      importScripts(data.jsUrl);
      const createEngine = self.Pikafish;
      if (typeof createEngine !== "function") throw new Error("Pikafish WebAssembly-modul saknas.");

      const module = await createEngine({
        locateFile: (file) => file.endsWith(".wasm") ? data.wasmUrl : file,
        mainScriptUrlOrBlob: data.jsUrl,
        print: (line) => self.postMessage({ type: "line", line: String(line) }),
        printErr: (line) => self.postMessage({ type: "stderr", line: String(line) })
      });

      module.FS.writeFile("/pikafish.nnue", await networkPromise);
      const initialize = module.cwrap("pikafish_initialize", null, []);
      command = module.cwrap("pikafish_command", null, ["string"]);
      initialize();
      self.postMessage({ type: "ready" });
    } catch (error) {
      self.postMessage({
        type: "error",
        error: error instanceof Error ? error.message : String(error)
      });
    }
    return;
  }

  if (data?.type === "command" && typeof data.command === "string") {
    if (!command) {
      self.postMessage({ type: "error", error: "Pikafish är inte redo ännu." });
      return;
    }
    command(data.command);
  }
});

# Xiangqi Studio

A browser-based Xiangqi game in Swedish. It uses [xiangqiboard.js](https://github.com/lengyanyu258/xiangqiboardjs) for the board, [xiangqi.js](https://github.com/lengyanyu258/xiangqi.js) for legal moves, and a WebAssembly build of Pikafish as the opponent.

## Run locally

Requirements: Node.js 20 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The page must be served from localhost (not opened as a `file://` URL). The first time you start a game, the server streams Pikafish's approximately 50 MB NNUE network from the official Pikafish Networks release. The board and rules are available before that download; the engine is initialized only when you start a game.

For a production build:

```sh
npm run build
npm start
```

`npm start` serves the built app and provides the same-origin NNUE download endpoint required by browsers. The app needs internet access to download the network on the first game. It sets COOP/COEP headers for Pikafish's WebAssembly threads; host it with these headers intact. If deploying elsewhere, provide `/engine/pikafish.nnue` as a same-origin streamed proxy to the official network release and set `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.

Difficulty changes Pikafish's search depth. The search depths are capped to keep browser play responsive.

## Engine and licensing

The browser engine is built from official Pikafish commit `8d8db92f77190dece8bd4fca9609fe2eab531844` using the browser-build patch and build script in `public/engine/`. Its source is GPL-3.0-or-later; see [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md). The NNUE network is fetched from the official [Pikafish Networks `master-net` release](https://github.com/official-pikafish/Networks/releases/tag/master-net); its accompanying NNUE license restricts commercial use without permission. That release is rolling, so rebuild the engine alongside a newer network if Pikafish reports an incompatible network. Review the engine and network licenses before deploying or using commercially.

To rebuild the browser engine, check out that Pikafish commit, apply `public/engine/source.patch`, install Emscripten 3.1.74, then run `PIKAFISH_SRC_DIR=/path/to/Pikafish/src PIKAFISH_COPYING=/path/to/Pikafish/Copying.txt bash public/engine/build.sh public/engine`.

See [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md) for bundled library notices.

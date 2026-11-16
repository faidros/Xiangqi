const difficulties = {
  beginner: {
    label: "Nybörjare",
    depth: 4,
    hint: "Ett lugnt tempo med kortare sökningar och enklare motstånd."
  },
  easy: {
    label: "Lätt",
    depth: 7,
    hint: "För dig som vill lära dig grunderna och prova nya idéer."
  },
  medium: {
    label: "Medel",
    depth: 10,
    hint: "Balanserat motstånd för den som kan grunderna."
  },
  hard: {
    label: "Svår",
    depth: 13,
    hint: "En utmaning som kräver planering och noggrannhet."
  },
  expert: {
    label: "Expert",
    depth: 16,
    hint: "Pikafish spelar på full styrka. Lycka till!"
  }
};

const elements = {
  difficulty: document.querySelector("#difficulty"),
  difficultyHint: document.querySelector("#difficulty-hint"),
  startButton: document.querySelector("#start-button"),
  undoButton: document.querySelector("#undo-button"),
  flipButton: document.querySelector("#flip-button"),
  engineBadge: document.querySelector("#engine-badge"),
  engineError: document.querySelector("#engine-error"),
  engineProgress: document.querySelector("#engine-progress"),
  progressLabel: document.querySelector("#progress-label"),
  progressValue: document.querySelector("#progress-value"),
  progressBar: document.querySelector("#progress-bar"),
  opponentLevel: document.querySelector("#opponent-level"),
  engineTurnDot: document.querySelector("#engine-turn-dot"),
  humanTurnDot: document.querySelector("#human-turn-dot"),
  movesList: document.querySelector("#moves-list"),
  movesTotal: document.querySelector("#moves-total"),
  moveCount: document.querySelector("#move-count")
};

let game = new Xiangqi();
let board;
let engineWorker;
let engineReady = false;
let engineThinking = false;
let gameStarted = false;
let moves = [];
let engineErrors = [];

function selectedDifficulty() {
  return difficulties[elements.difficulty.value] ?? difficulties.medium;
}

function setEngineBadge(label, state = "") {
  elements.engineBadge.className = `engine-badge ${state}`.trim();
  elements.engineBadge.querySelector("span").textContent = label;
}

function setMessage(message, state = "") {
  setEngineBadge(message, state);
  elements.engineTurnDot.classList.toggle("active", state === "thinking");
  elements.humanTurnDot.classList.toggle("active", !engineThinking && gameStarted && game.turn() === "r");
}

function updateMoveLog() {
  elements.movesTotal.textContent = String(moves.length);
  elements.moveCount.textContent = `Drag ${Math.ceil(moves.length / 2)}`;
  elements.undoButton.disabled = !gameStarted || moves.length === 0;

  if (moves.length === 0) {
    elements.movesList.className = "moves-list empty-moves";
    elements.movesList.innerHTML = '<span class="empty-moves-icon" aria-hidden="true">象</span><p>Dina drag visas här när partiet börjar.</p>';
    return;
  }

  elements.movesList.className = "moves-list";
  const rows = [];
  for (let index = 0; index < moves.length; index += 2) {
    const red = moves[index];
    const black = moves[index + 1];
    rows.push(
      `<div class="move-row"><span class="move-row-number">${String(index / 2 + 1).padStart(2, "0")}</span><span>${red}</span><span class="${black ? "" : "empty-ply"}">${black ?? "—"}</span></div>`
    );
  }
  elements.movesList.innerHTML = rows.join("");
  elements.movesList.scrollTop = elements.movesList.scrollHeight;
}

function addMove(move) {
  moves.push(`${move.from}–${move.to}`);
  updateMoveLog();
}

function updateBoardStatus() {
  if (!gameStarted) {
    setMessage(engineReady ? "Redo" : "Avstängd");
    return;
  }

  if (game.game_over()) {
    engineThinking = false;
    setMessage("Partiet avslutat");
    elements.startButton.querySelector("span").textContent = "Spela igen";
    elements.startButton.disabled = false;
    elements.undoButton.disabled = moves.length === 0;
    return;
  }

  if (engineThinking) {
    setMessage("Pikafish tänker …", "thinking");
    return;
  }

  if (game.turn() === "r") {
    setMessage(game.in_check() ? "Du står i schack" : "Din tur", "ready");
  } else {
    setMessage(game.in_check() ? "Pikafish står i schack" : "Pikafish spelar", "thinking");
  }
}

function canDrag(source, piece) {
  if (!gameStarted || engineThinking || game.game_over() || game.turn() !== "r") return false;
  return piece.startsWith("r");
}

function onDrop(source, target) {
  if (!gameStarted || engineThinking) return "snapback";
  const move = game.move({ from: source, to: target });
  if (move === null) return "snapback";

  addMove(move);
  updateBoardStatus();
  if (game.game_over()) {
    updateBoardStatus();
    return;
  }
  requestEngineMove();
}

function onSnapEnd() {
  board.position(game.fen());
}

function initializeBoard() {
  board = Xiangqiboard("game-board", {
    position: "start",
    draggable: true,
    showNotation: false,
    pieceTheme: "/vendor/xiangqiboard/img/xiangqipieces/graphic/{piece}.svg",
    boardTheme: "/vendor/xiangqiboard/img/xiangqiboards/wikimedia/xiangqiboard.svg",
    onDragStart: canDrag,
    onDrop,
    onSnapEnd
  });
  updateBoardLabels();
  window.addEventListener("resize", () => board.resize());
}

function updateBoardLabels() {
  const flipped = board.orientation() === "black";
  const ranks = flipped ? ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] : ["9", "8", "7", "6", "5", "4", "3", "2", "1", "0"];
  const files = flipped ? ["i", "h", "g", "f", "e", "d", "c", "b", "a"] : ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  document.querySelector(".board-rank-labels").replaceChildren(...ranks.map((rank) => Object.assign(document.createElement("span"), { textContent: rank })));
  document.querySelector(".board-file-labels").replaceChildren(...files.map((file) => Object.assign(document.createElement("span"), { textContent: file })));
}

function showEngineError(message) {
  engineThinking = false;
  engineReady = false;
  gameStarted = false;
  if (engineWorker) engineWorker.terminate();
  engineWorker = null;
  elements.engineProgress.hidden = true;
  elements.engineError.hidden = false;
  elements.engineError.textContent = message;
  elements.startButton.disabled = false;
  elements.startButton.querySelector("span").textContent = engineReady ? "Nytt parti" : "Försök igen";
  elements.undoButton.disabled = true;
  elements.engineTurnDot.classList.remove("active");
  elements.humanTurnDot.classList.remove("active");
  setEngineBadge("Motorfel");
}

function sendEngineCommand(command) {
  if (!engineWorker) throw new Error("Pikafish-motorn är inte startad.");
  engineWorker.postMessage({ type: "command", command });
}

function engineFen() {
  const fields = game.fen().split(" ");
  if (fields[1] === "r") fields[1] = "w";
  return fields.join(" ");
}

function startEngine() {
  if (engineWorker) engineWorker.terminate();
  engineReady = false;
  engineErrors = [];
  elements.engineError.hidden = true;
  elements.engineProgress.hidden = false;
  elements.progressLabel.textContent = "Hämtar motorn …";
  elements.progressValue.textContent = "";
  elements.progressBar.style.width = "0%";
  elements.startButton.disabled = true;
  setEngineBadge("Laddar …", "loading");

  engineWorker = new Worker("/engine/pikafish-worker.js");
  engineWorker.addEventListener("error", (event) => {
    showEngineError(`Motorn kunde inte starta. ${event.message || "Kontrollera att appen körs via npm run dev eller npm start."}`);
  });
  engineWorker.addEventListener("message", ({ data }) => {
    if (data.type === "net-progress") {
      elements.progressLabel.textContent = "Hämtar Xiangqi-nätverket …";
      if (data.total > 0) {
        const percent = Math.min(100, Math.round((data.loaded / data.total) * 100));
        elements.progressValue.textContent = `${percent}%`;
        elements.progressBar.style.width = `${percent}%`;
      } else {
        elements.progressValue.textContent = `${Math.round(data.loaded / 1_000_000)} MB`;
        elements.progressBar.style.width = `${Math.max(7, (data.loaded / 50_700_000) * 100)}%`;
      }
      return;
    }

    if (data.type === "error") {
      showEngineError(`Motorn rapporterade ett fel: ${data.error}`);
      return;
    }

    if (data.type === "stderr") {
      const message = data.line.trim();
      if (message) {
        engineErrors.push(message);
        showEngineError(`Pikafish rapporterade ett fel: ${engineErrors.join(" ")}`);
      }
      return;
    }

    if (data.type === "ready") {
      elements.progressLabel.textContent = "Startar Pikafish …";
      elements.progressValue.textContent = "";
      sendEngineCommand("uci");
      return;
    }

    if (data.type !== "line") return;
    const line = data.line.trim();

    if (line === "uciok") {
      sendEngineCommand("isready");
    } else if (line === "readyok" && !engineReady) {
      engineReady = true;
      elements.engineProgress.hidden = true;
      elements.startButton.disabled = false;
      elements.startButton.querySelector("span").textContent = "Nytt parti";
      startNewGame();
    } else if (line.startsWith("info depth ") && engineThinking) {
      const depth = line.match(/\bdepth (\d+)/)?.[1];
      if (depth) elements.progressLabel.textContent = `Pikafish analyserar · djup ${depth}`;
    } else if (line.startsWith("info string ") && /(invalid|unsupported|error|failed|fatal)/i.test(line)) {
      engineErrors.push(line.slice("info string ".length));
      showEngineError(`Pikafish rapporterade ett fel: ${engineErrors.join(" ")}`);
    } else if (line.startsWith("Unknown command:")) {
      showEngineError(`Pikafish förstod inte kommandot: ${line}`);
    } else if (line.startsWith("bestmove ") && engineThinking) {
      applyEngineMove(line.split(/\s+/)[1]);
    }
  });

  engineWorker.postMessage({
    type: "init",
    jsUrl: `${location.origin}/engine/pikafish.js`,
    wasmUrl: `${location.origin}/engine/pikafish.wasm`,
    netUrl: `${location.origin}/engine/pikafish.nnue`
  });
}

function startNewGame() {
  if (engineThinking) sendEngineCommand("stop");
  engineThinking = false;
  gameStarted = true;
  game.reset();
  sendEngineCommand("ucinewgame");
  sendEngineCommand("isready");
  moves = [];
  board.position(game.fen());
  elements.engineProgress.hidden = true;
  elements.engineError.hidden = true;
  elements.startButton.disabled = false;
  elements.startButton.querySelector("span").textContent = "Nytt parti";
  elements.opponentLevel.textContent = selectedDifficulty().label.toUpperCase();
  updateMoveLog();
  updateBoardStatus();
}

function requestEngineMove() {
  if (!engineReady || !gameStarted) return;
  engineThinking = true;
  const level = selectedDifficulty();
  elements.opponentLevel.textContent = level.label.toUpperCase();
  elements.engineProgress.hidden = false;
  elements.progressLabel.textContent = "Pikafish analyserar …";
  elements.progressValue.textContent = "";
  elements.progressBar.style.width = "100%";
  updateBoardStatus();
  sendEngineCommand(`position fen ${engineFen()}`);
  sendEngineCommand(`go depth ${level.depth}`);
}

function applyEngineMove(uciMove) {
  engineThinking = false;
  elements.engineProgress.hidden = true;
  if (!/^[a-i][0-9][a-i][0-9]$/.test(uciMove)) {
    if (uciMove === "(none)" || uciMove === "0000") {
      updateBoardStatus();
      return;
    }
    showEngineError(`Pikafish returnerade ett ogiltigt drag (${uciMove}).`);
    return;
  }

  const move = game.move(uciMove);
  if (move === null) {
    showEngineError(`Pikafish föreslog ett ogiltigt drag (${uciMove}). Kontrollera att motorfilerna hör ihop.`);
    return;
  }
  addMove(move);
  board.position(game.fen());
  updateBoardStatus();
}

function undoMove() {
  if (!gameStarted || moves.length === 0) return;
  if (engineThinking) {
    engineThinking = false;
    sendEngineCommand("stop");
    elements.engineProgress.hidden = true;
  }

  const pliesToUndo = moves.length % 2 === 0 ? 2 : 1;
  for (let index = 0; index < pliesToUndo; index += 1) {
    game.undo();
    moves.pop();
  }
  board.position(game.fen());
  elements.startButton.querySelector("span").textContent = "Nytt parti";
  updateMoveLog();
  updateBoardStatus();
}

elements.difficulty.addEventListener("change", () => {
  const level = selectedDifficulty();
  elements.difficultyHint.textContent = level.hint;
  if (gameStarted && moves.length === 0) elements.opponentLevel.textContent = level.label.toUpperCase();
});

elements.startButton.addEventListener("click", () => {
  if (engineReady) startNewGame();
  else startEngine();
});

elements.undoButton.addEventListener("click", undoMove);
elements.flipButton.addEventListener("click", () => {
  board.orientation("flip");
  updateBoardLabels();
});

initializeBoard();
elements.difficultyHint.textContent = selectedDifficulty().hint;
updateMoveLog();
updateBoardStatus();

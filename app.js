/* global Chess */
const game = new Chess();

const boardEl = document.getElementById("board");
const turnLabel = document.getElementById("turnLabel");
const movesList = document.getElementById("movesList");
const clockWhiteEl = document.getElementById("clockWhite");
const clockBlackEl = document.getElementById("clockBlack");

const btnNew = document.getElementById("btnNew");
const btnUndo = document.getElementById("btnUndo");

const sheet = document.getElementById("sheet");
const btnMenu = document.getElementById("btnMenu");
const btnResume = document.getElementById("btnResume");
const btnResign = document.getElementById("btnResign");
const btnCloseSheet = document.getElementById("btnCloseSheet");

const toastEl = document.getElementById("toast");

const glyph = {
  p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
  P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔"
};

let selected = null;
let legalTargets = new Set();
let lastMoveSquares = { from: null, to: null };

// simple clocks for local, 5+0
let clocks = {
  wMs: 5 * 60_000,
  bMs: 5 * 60_000,
  running: true,
  lastTickAt: Date.now()
};

function pad2(n){
  return String(n).padStart(2, "0");
}
function fmtMs(ms){
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${pad2(m)}:${pad2(r)}`;
}

function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.add("hidden"), 1400);
}

function squareColor(fileIdx, rankIdx){
  return (fileIdx + rankIdx) % 2 === 0 ? "dark" : "light";
}

function tick(){
  if(!clocks.running) return;

  const now = Date.now();
  const dt = now - clocks.lastTickAt;
  clocks.lastTickAt = now;

  if (game.game_over && game.game_over()) {
    clocks.running = false;
    renderClocks();
    return;
  }

  const turn = game.turn();
  if(turn === "w") clocks.wMs -= dt;
  else clocks.bMs -= dt;

  if(clocks.wMs <= 0 || clocks.bMs <= 0){
    clocks.running = false;
    toast("TIME");
  }

  renderClocks();
}

function renderClocks(){
  clockWhiteEl.textContent = fmtMs(clocks.wMs);
  clockBlackEl.textContent = fmtMs(clocks.bMs);
}

function clearSelection(){
  selected = null;
  legalTargets = new Set();
}

function renderMoves(){
  const history = game.history({ verbose: true });
  if(history.length === 0){
    movesList.textContent = "—";
    return;
  }

  const rows = [];
  for(let i = 0; i < history.length; i += 2){
    const moveNo = (i / 2) + 1;
    const w = history[i] ? history[i].san : "";
    const b = history[i + 1] ? history[i + 1].san : "";
    rows.push(`${moveNo}. ${w} ${b}`.trim());
  }
  movesList.textContent = rows.join("\n");
}

function render(){
  boardEl.innerHTML = "";

  const board = game.board();
  for(let r = 0; r < 8; r++){
    for(let f = 0; f < 8; f++){
      const piece = board[r][f];
      const fileChar = String.fromCharCode("a".charCodeAt(0) + f);
      const rankChar = String(8 - r);
      const sq = `${fileChar}${rankChar}`;

      const sqEl = document.createElement("div");
      sqEl.className = `sq ${squareColor(f, r)}`;
      sqEl.dataset.sq = sq;

      if(selected === sq) sqEl.classList.add("sel");
      if(legalTargets.has(sq)) sqEl.classList.add("move");

      if(lastMoveSquares.from === sq || lastMoveSquares.to === sq) {
        sqEl.classList.add("last");
      }

      if(piece){
        const isWhite = piece.color === "w";
        const key = isWhite ? piece.type.toUpperCase() : piece.type;
        const pEl = document.createElement("div");
        pEl.className = `piece ${isWhite ? "white" : "black"}`;
        pEl.textContent = glyph[key] || "?";
        sqEl.appendChild(pEl);
      }

      sqEl.addEventListener("click", onSquareTap);
      boardEl.appendChild(sqEl);
    }
  }

  turnLabel.textContent = game.turn() === "w" ? "WHITE TO MOVE" : "BLACK TO MOVE";
  renderMoves();
  renderClocks();
}

function onSquareTap(e){
  const sq = e.currentTarget.dataset.sq;

  if(!clocks.running){
    toast("GAME OVER");
    return;
  }

  // make move if target
  if(selected && legalTargets.has(sq)){
    const move = game.move({ from: selected, to: sq, promotion: "q" });
    if(!move){
      clearSelection();
      render();
      return;
    }

    lastMoveSquares = { from: move.from, to: move.to };
    clearSelection();
    render();

    if (game.isGameOver()) {
      clocks.running = false;

      if (game.isCheckmate()) toast("CHECKMATE");
      else toast("DRAW");

      return;
    }

    return;
  }

  // select piece
  const piece = game.get(sq);
  if(!piece){
    clearSelection();
    render();
    return;
  }

  if(piece.color !== game.turn()){
    toast("NOT YOUR TURN");
    clearSelection();
    render();
    return;
  }

  selected = sq;
  legalTargets = new Set(game.moves({ square: sq, verbose: true }).map(m => m.to));
  render();
}

function resetGame(){
  game.reset();
  clearSelection();
  lastMoveSquares = { from: null, to: null };

  clocks = {
    wMs: 5 * 60_000,
    bMs: 5 * 60_000,
    running: true,
    lastTickAt: Date.now()
  };

  render();
}

btnNew.addEventListener("click", resetGame);

btnUndo.addEventListener("click", () => {
  if(!clocks.running) return;
  // undo 1 ply (можно сделать 2, если хочешь pass-and-play)
  const m = game.undo();
  if(m){
    lastMoveSquares = { from: null, to: null };
    clearSelection();
    render();
  }
});

btnMenu.addEventListener("click", () => sheet.classList.remove("hidden"));
btnResume.addEventListener("click", () => sheet.classList.add("hidden"));
btnCloseSheet.addEventListener("click", () => sheet.classList.add("hidden"));

btnResign.addEventListener("click", () => {
  sheet.classList.add("hidden");
  clocks.running = false;
  toast("RESIGN");
});

// timer loop
setInterval(tick, 200);

// init
resetGame();

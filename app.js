/* global Chess */
const game = new Chess();

const boardEl = document.getElementById("board");
const turnLabel = document.getElementById("turnLabel");
const movesList = document.getElementById("movesList");

const btnNew = document.getElementById("btnNew");
const btnUndo = document.getElementById("btnUndo");

const sheet = document.getElementById("sheet");
const btnMenu = document.getElementById("btnMenu");
const btnResume = document.getElementById("btnResume");
const btnResign = document.getElementById("btnResign");
const btnCloseSheet = document.getElementById("btnCloseSheet");

// Simple piece glyph mapping, позже заменим на стеклянные SVG
const glyph = {
  p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
  P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔"
};

let selected = null;          // "e2"
let legalTargets = new Set(); // squares

function squareColor(fileIdx, rankIdx){
  return (fileIdx + rankIdx) % 2 === 0 ? "dark" : "light";
}

function render(){
  boardEl.innerHTML = "";

  const board = game.board(); // [rank8..rank1][file a..h]
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
}

function onSquareTap(e){
  const sq = e.currentTarget.dataset.sq;

  // If tap on a legal target, make move
  if(selected && legalTargets.has(sq)){
    const move = game.move({ from: selected, to: sq, promotion: "q" });
    clearSelection();

    if(!move){
      render();
      return;
    }
    render();
    return;
  }

  // Otherwise, select piece if it's current side
  const piece = game.get(sq);
  if(!piece){
    clearSelection();
    render();
    return;
  }

  if(piece.color !== game.turn()){
    clearSelection();
    render();
    return;
  }

  selected = sq;
  legalTargets = new Set(game.moves({ square: sq, verbose: true }).map(m => m.to));
  render();
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
    const w = history[i] ? san(history[i]) : "";
    const b = history[i + 1] ? san(history[i + 1]) : "";
    rows.push(`${moveNo}. ${w} ${b}`.trim());
  }

  movesList.textContent = rows.join("\n");
}

function san(m){
  return m.san;
}

btnNew.addEventListener("click", () => {
  game.reset();
  clearSelection();
  render();
});

btnUndo.addEventListener("click", () => {
  game.undo();
  game.undo(); // undo pair for local pass-and-play feel
  clearSelection();
  render();
});

// Pause sheet
btnMenu.addEventListener("click", () => sheet.classList.remove("hidden"));
btnResume.addEventListener("click", () => sheet.classList.add("hidden"));
btnCloseSheet.addEventListener("click", () => sheet.classList.add("hidden"));

btnResign.addEventListener("click", () => {
  sheet.classList.add("hidden");
  // MVP: just reset. Потом сделаем нормальный end state.
  game.reset();
  clearSelection();
  render();
});

render();

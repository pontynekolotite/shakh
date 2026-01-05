/* global Chess */
(() => {
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

  const promo = document.getElementById("promo");
  const promoBtns = Array.from(document.querySelectorAll(".promo__btn"));

  const toastEl = document.getElementById("toast");

  // iOS: блокируем жесты зума
  ["gesturestart","gesturechange","gestureend"].forEach(evt => {
    document.addEventListener(evt, (e) => e.preventDefault(), { passive: false });
  });

  // Unicode пока как плейсхолдер. Потом заменим на SVG стеклянных фигур.
  const glyph = {
    p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
    P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔"
  };

  let selected = null;
  let legalTargets = new Set();
  let lastMoveSquares = { from: null, to: null };

  // drag state
  let dragging = null; // { from, pieceEl, ghostEl }
  let pendingPromotion = null; // { from, to }

  // clocks 5+0 local
  let clocks = {
    wMs: 5 * 60_000,
    bMs: 5 * 60_000,
    running: true,
    lastTickAt: Date.now()
  };

  function pad2(n){ return String(n).padStart(2, "0"); }
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
    toastEl._t = setTimeout(() => toastEl.classList.add("hidden"), 1200);
  }

  function clearSelection(){
    selected = null;
    legalTargets = new Set();
  }

  function squareColor(fileIdx, rankIdx){
    return (fileIdx + rankIdx) % 2 === 0 ? "dark" : "light";
  }

  function getSquareFromPoint(x, y){
    const el = document.elementFromPoint(x, y);
    if(!el) return null;
    const sqEl = el.closest?.(".sq");
    return sqEl ? sqEl.dataset.sq : null;
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

  function renderClocks(){
    clockWhiteEl.textContent = fmtMs(clocks.wMs);
    clockBlackEl.textContent = fmtMs(clocks.bMs);
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
        if(lastMoveSquares.from === sq || lastMoveSquares.to === sq) sqEl.classList.add("last");

        if(piece){
          const isWhite = piece.color === "w";
          const key = isWhite ? piece.type.toUpperCase() : piece.type;

          const pEl = document.createElement("div");
          pEl.className = `piece ${isWhite ? "white" : "black"}`;
          pEl.textContent = glyph[key] || "?";
          pEl.dataset.piece = piece.type;
          pEl.dataset.color = piece.color;
          pEl.dataset.sq = sq;

          // drag start on pointerdown
          pEl.addEventListener("pointerdown", onPiecePointerDown, { passive: false });

          // tap-to-move: click selects too
          pEl.addEventListener("click", () => onSquareTap(sq), { passive: true });

          sqEl.appendChild(pEl);
        }

        // tap on square
        sqEl.addEventListener("click", () => onSquareTap(sq), { passive: true });
        boardEl.appendChild(sqEl);
      }
    }

    turnLabel.textContent = game.turn() === "w" ? "WHITE TO MOVE" : "BLACK TO MOVE";
    renderMoves();
    renderClocks();
  }

  function onSquareTap(sq){
    if(!clocks.running) return;

    // if selected and tap target
    if(selected && legalTargets.has(sq)){
      tryMove(selected, sq);
      return;
    }

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

  function needsPromotion(from, to){
    const p = game.get(from);
    if(!p || p.type !== "p") return false;
    const rank = to[1];
    return (p.color === "w" && rank === "8") || (p.color === "b" && rank === "1");
  }

  function openPromotion(from, to){
    pendingPromotion = { from, to };
    promo.classList.remove("hidden");
  }

  function closePromotion(){
    promo.classList.add("hidden");
  }

  promoBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      if(!pendingPromotion) return;
      const promoPiece = btn.dataset.p; // q r b n
      const { from, to } = pendingPromotion;
      pendingPromotion = null;
      closePromotion();
      tryMove(from, to, promoPiece);
    });
  });

  function tryMove(from, to, promotion){
    if(needsPromotion(from, to) && !promotion){
      openPromotion(from, to);
      return;
    }

    const move = game.move({ from, to, promotion: promotion || "q" });
    if(!move){
      toast("ILLEGAL");
      clearSelection();
      render();
      return;
    }

    lastMoveSquares = { from: move.from, to: move.to };
    clearSelection();
    render();

    if(game.isGameOver()){
      clocks.running = false;
      if(game.isCheckmate()) toast("CHECKMATE");
      else toast("DRAW");
    }
  }

  function onPiecePointerDown(e){
    if(!clocks.running) return;
    if(promo && !promo.classList.contains("hidden")) return; // while promotion

    const pieceEl = e.currentTarget;
    const from = pieceEl.dataset.sq;
    const color = pieceEl.dataset.color;

    // only current side can start drag
    if(color !== game.turn()){
      toast("NOT YOUR TURN");
      return;
    }

    // prevent page scroll
    e.preventDefault();
    pieceEl.setPointerCapture?.(e.pointerId);

    // set selection and legal targets
    selected = from;
    legalTargets = new Set(game.moves({ square: from, verbose: true }).map(m => m.to));
    render();

    // create ghost (copy style)
    const ghost = pieceEl.cloneNode(true);
    ghost.classList.add("ghost");
    ghost.style.width = `${pieceEl.getBoundingClientRect().width}px`;
    ghost.style.height = `${pieceEl.getBoundingClientRect().height}px`;
    document.body.appendChild(ghost);

    dragging = { from, pieceEl, ghostEl: ghost };

    moveGhost(e.clientX, e.clientY);

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp, { passive: false });
    window.addEventListener("pointercancel", onPointerUp, { passive: false });
  }

  function moveGhost(x, y){
    if(!dragging) return;
    dragging.ghostEl.style.left = `${x}px`;
    dragging.ghostEl.style.top = `${y}px`;
  }

  function onPointerMove(e){
    if(!dragging) return;
    e.preventDefault();
    moveGhost(e.clientX, e.clientY);

    const sq = getSquareFromPoint(e.clientX, e.clientY);
    // live highlight: just re-render only if needed
    // simple: do nothing here, targets already shown
    // можно добавить hover подсветку позже
    void sq;
  }

  function onPointerUp(e){
    if(!dragging) return;
    e.preventDefault();

    const { from, ghostEl } = dragging;
    dragging = null;

    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);

    ghostEl.remove();

    const to = getSquareFromPoint(e.clientX, e.clientY);
    if(!to){
      clearSelection();
      render();
      return;
    }

    if(!legalTargets.has(to)){
      clearSelection();
      render();
      return;
    }

    tryMove(from, to);
  }

  function tick(){
    if(!clocks.running) return;

    const now = Date.now();
    const dt = now - clocks.lastTickAt;
    clocks.lastTickAt = now;

    if(game.isGameOver()){
      clocks.running = false;
      renderClocks();
      return;
    }

    if(game.turn() === "w") clocks.wMs -= dt;
    else clocks.bMs -= dt;

    if(clocks.wMs <= 0 || clocks.bMs <= 0){
      clocks.running = false;
      toast("TIME");
    }

    renderClocks();
  }

  function resetGame(){
    game.reset();
    clearSelection();
    lastMoveSquares = { from: null, to: null };
    pendingPromotion = null;
    closePromotion();

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

    // undo one ply
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

  setInterval(tick, 200);
  resetGame();
})();

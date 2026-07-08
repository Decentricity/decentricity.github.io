(function (root) {
  "use strict";

  const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const BACK_RANK = ["r", "n", "b", "q", "k", "b", "n", "r"];
  const WHITE = "w";
  const BLACK = "b";

  const PIECE_NAMES = {
    p: "pawn",
    n: "knight",
    b: "bishop",
    r: "rook",
    q: "queen",
    k: "king"
  };

  const PIECE_SYMBOLS = {
    w: {
      k: "♔",
      q: "♕",
      r: "♖",
      b: "♗",
      n: "♘",
      p: "♙"
    },
    b: {
      k: "♚",
      q: "♛",
      r: "♜",
      b: "♝",
      n: "♞",
      p: "♟"
    }
  };

  const KNIGHT_STEPS = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];

  const KING_STEPS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ];

  const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  let state = createInitialState();
  let selected = null;
  let legalActions = [];
  let elements = {};

  function createInitialState() {
    const board = createBlankBoard();

    for (let col = 0; col < 8; col += 1) {
      board[0][col] = createPiece(BLACK, BACK_RANK[col]);
      board[1][col] = createPiece(BLACK, "p");
      board[6][col] = createPiece(WHITE, "p");
      board[7][col] = createPiece(WHITE, BACK_RANK[col]);
    }

    return {
      board,
      turn: WHITE,
      shells: { w: null, b: null },
      capturedBy: { w: [], b: [] },
      gameOver: false,
      result: "",
      history: []
    };
  }

  function createBlankBoard() {
    return Array.from({ length: 8 }, () => Array(8).fill(null));
  }

  function createPiece(color, type) {
    return { color, type };
  }

  function clonePiece(piece) {
    return piece ? { color: piece.color, type: piece.type } : null;
  }

  function cloneBoard(board) {
    return board.map((row) => row.map(clonePiece));
  }

  function cloneState(source) {
    return {
      board: cloneBoard(source.board),
      turn: source.turn,
      shells: { w: source.shells.w, b: source.shells.b },
      capturedBy: {
        w: source.capturedBy.w.map(clonePiece),
        b: source.capturedBy.b.map(clonePiece)
      },
      gameOver: source.gameOver,
      result: source.result,
      history: source.history.slice()
    };
  }

  function opposite(color) {
    return color === WHITE ? BLACK : WHITE;
  }

  function colorName(color) {
    return color === WHITE ? "White" : "Black";
  }

  function inBounds(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  function coordsToSquare(row, col) {
    return `${FILES[col]}${8 - row}`;
  }

  function squareToCoords(square) {
    const file = square[0];
    const rank = Number(square[1]);
    return {
      row: 8 - rank,
      col: FILES.indexOf(file)
    };
  }

  function sameCoords(a, b) {
    return a && b && a.row === b.row && a.col === b.col;
  }

  function pieceName(type) {
    return PIECE_NAMES[type] || "piece";
  }

  function pieceSymbol(piece) {
    return piece ? PIECE_SYMBOLS[piece.color][piece.type] : "";
  }

  function findKing(currentState, color) {
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const piece = currentState.board[row][col];
        if (piece && piece.color === color && piece.type === "k") {
          return { row, col };
        }
      }
    }
    return null;
  }

  function generateLegalActionsForSquare(currentState, row, col, forColor, options) {
    const piece = currentState.board[row][col];
    const color = forColor || currentState.turn;

    if (!piece || piece.color !== color || currentState.gameOver) {
      return [];
    }

    if (piece.type === "k") {
      return generateKingActions(currentState, row, col, piece, options);
    }

    const pseudoMoves = generatePseudoMoves(currentState, row, col, piece.type, { shellMove: false });

    if (currentState.shells[piece.color]) {
      return pseudoMoves;
    }

    return pseudoMoves.filter((action) => moveKeepsUnshelledKingSafe(currentState, action, piece.color));
  }

  function generateKingActions(currentState, row, col, king, options) {
    const shell = currentState.shells[king.color];

    // Unshelled kings obey ordinary king movement and king-safety rules.
    // Shelled kings stop using king movement and attachment entirely; they use the shell piece only.
    if (!shell) {
      const attachActions = generateAttachActions(currentState, row, col, king);
      const kingMoves = generatePseudoMoves(currentState, row, col, "k", { shellMove: false });
      return kingMoves
        .filter((action) => moveKeepsUnshelledKingSafe(currentState, action, king.color))
        .concat(attachActions);
    }

    const shellMoves = generatePseudoMoves(currentState, row, col, shell, { shellMove: true });
    return options && options.includeDetach
      ? shellMoves.concat(generateDetachActions(currentState, row, col, king))
      : shellMoves;
  }

  function generateAttachActions(currentState, row, col, king) {
    const actions = [];

    for (const [dr, dc] of KING_STEPS) {
      const targetRow = row + dr;
      const targetCol = col + dc;

      if (!inBounds(targetRow, targetCol)) {
        continue;
      }

      const target = currentState.board[targetRow][targetCol];
      if (target && target.color === king.color && target.type !== "k") {
        actions.push({
          kind: "attach",
          king: { row, col },
          from: { row: targetRow, col: targetCol },
          shell: target.type
        });
      }
    }

    return actions;
  }

  function generateDetachActions(currentState, row, col, king) {
    const shell = currentState.shells[king.color];

    if (!shell) {
      return [];
    }

    // Unshelling moves the carried shell piece away from the king. The king
    // stays put, loses the shell, and must be safe as a normal unshelled king.
    return generatePseudoMoves(currentState, row, col, shell, { shellMove: false })
      .map((action) => ({
        kind: "detach",
        from: { row, col },
        to: action.to,
        shell,
        capture: action.capture,
        promotion: action.promotion
      }))
      .filter((action) => detachKeepsUnshelledKingSafe(currentState, action, king.color));
  }

  function generatePseudoMoves(currentState, row, col, movementType, options) {
    const piece = currentState.board[row][col];
    if (!piece) {
      return [];
    }

    const actions = [];
    const shellMove = Boolean(options && options.shellMove);

    if (movementType === "p") {
      addPawnMoves(currentState, actions, row, col, piece.color, shellMove);
      return actions;
    }

    if (movementType === "n") {
      for (const [dr, dc] of KNIGHT_STEPS) {
        addStepMove(currentState, actions, row, col, row + dr, col + dc, shellMove);
      }
      return actions;
    }

    if (movementType === "k") {
      for (const [dr, dc] of KING_STEPS) {
        addStepMove(currentState, actions, row, col, row + dr, col + dc, shellMove);
      }
      return actions;
    }

    if (movementType === "b" || movementType === "q") {
      addSlidingMoves(currentState, actions, row, col, BISHOP_DIRS, shellMove);
    }

    if (movementType === "r" || movementType === "q") {
      addSlidingMoves(currentState, actions, row, col, ROOK_DIRS, shellMove);
    }

    return actions;
  }

  function addPawnMoves(currentState, actions, row, col, color, shellMove) {
    const direction = color === WHITE ? -1 : 1;
    const startRow = color === WHITE ? 6 : 1;
    const promotionRow = color === WHITE ? 0 : 7;
    const oneRow = row + direction;
    const twoRow = row + direction * 2;

    if (inBounds(oneRow, col) && !currentState.board[oneRow][col]) {
      actions.push(createMoveAction(currentState, row, col, oneRow, col, {
        shellMove,
        promotion: !shellMove && oneRow === promotionRow
      }));

      if (
        row === startRow &&
        inBounds(twoRow, col) &&
        !currentState.board[twoRow][col]
      ) {
        actions.push(createMoveAction(currentState, row, col, twoRow, col, {
          shellMove,
          promotion: false
        }));
      }
    }

    for (const dc of [-1, 1]) {
      const targetRow = row + direction;
      const targetCol = col + dc;

      if (!inBounds(targetRow, targetCol)) {
        continue;
      }

      const target = currentState.board[targetRow][targetCol];
      if (isLegalCaptureTarget(currentState, color, target)) {
        actions.push(createMoveAction(currentState, row, col, targetRow, targetCol, {
          shellMove,
          promotion: !shellMove && targetRow === promotionRow
        }));
      }
    }
  }

  function addStepMove(currentState, actions, row, col, targetRow, targetCol, shellMove) {
    if (!inBounds(targetRow, targetCol)) {
      return;
    }

    const piece = currentState.board[row][col];
    const target = currentState.board[targetRow][targetCol];

    if (!target || isLegalCaptureTarget(currentState, piece.color, target)) {
      actions.push(createMoveAction(currentState, row, col, targetRow, targetCol, { shellMove }));
    }
  }

  function addSlidingMoves(currentState, actions, row, col, directions, shellMove) {
    const piece = currentState.board[row][col];

    for (const [dr, dc] of directions) {
      let targetRow = row + dr;
      let targetCol = col + dc;

      while (inBounds(targetRow, targetCol)) {
        const target = currentState.board[targetRow][targetCol];

        if (!target) {
          actions.push(createMoveAction(currentState, row, col, targetRow, targetCol, { shellMove }));
        } else {
          if (isLegalCaptureTarget(currentState, piece.color, target)) {
            actions.push(createMoveAction(currentState, row, col, targetRow, targetCol, { shellMove }));
          }
          break;
        }

        targetRow += dr;
        targetCol += dc;
      }
    }
  }

  function isLegalCaptureTarget(currentState, movingColor, target) {
    if (!target || target.color === movingColor) {
      return false;
    }

    // Unshelled kings are protected by check/checkmate rules and are not normal capture targets.
    // If one is ever captured through an edge case, applyActionToState still treats it as game over.
    if (target.type === "k" && !currentState.shells[target.color]) {
      return false;
    }

    return true;
  }

  function createMoveAction(currentState, fromRow, fromCol, toRow, toCol, options) {
    const target = currentState.board[toRow][toCol];
    return {
      kind: "move",
      from: { row: fromRow, col: fromCol },
      to: { row: toRow, col: toCol },
      capture: Boolean(target),
      shellMove: Boolean(options && options.shellMove),
      promotion: Boolean(options && options.promotion)
    };
  }

  function moveKeepsUnshelledKingSafe(currentState, action, color) {
    const next = simulateMoveOnly(currentState, action);
    return !isInCheck(next, color);
  }

  function detachKeepsUnshelledKingSafe(currentState, action, color) {
    const next = simulateDetachOnly(currentState, action);
    return !isInCheck(next, color);
  }

  function simulateMoveOnly(currentState, action) {
    const next = cloneState(currentState);
    const moving = next.board[action.from.row][action.from.col];

    next.board[action.from.row][action.from.col] = null;
    next.board[action.to.row][action.to.col] = action.promotion
      ? createPiece(moving.color, "q")
      : moving;

    return next;
  }

  function simulateDetachOnly(currentState, action) {
    const next = cloneState(currentState);
    const king = next.board[action.from.row][action.from.col];

    next.shells[king.color] = null;
    next.board[action.to.row][action.to.col] = action.promotion
      ? createPiece(king.color, "q")
      : createPiece(king.color, action.shell);

    return next;
  }

  function isInCheck(currentState, color) {
    if (currentState.shells[color]) {
      return false;
    }

    const king = findKing(currentState, color);
    if (!king) {
      return true;
    }

    return isSquareAttackedBy(currentState, king.row, king.col, opposite(color));
  }

  function isSquareAttackedBy(currentState, row, col, attackerColor) {
    for (let fromRow = 0; fromRow < 8; fromRow += 1) {
      for (let fromCol = 0; fromCol < 8; fromCol += 1) {
        const piece = currentState.board[fromRow][fromCol];

        if (!piece || piece.color !== attackerColor) {
          continue;
        }

        if (pieceAttacksSquare(currentState, piece, fromRow, fromCol, row, col)) {
          return true;
        }
      }
    }

    return false;
  }

  function pieceAttacksSquare(currentState, piece, fromRow, fromCol, targetRow, targetCol) {
    if (piece.type === "k") {
      const shell = currentState.shells[piece.color];
      return shell
        ? movementAttacksSquare(currentState.board, shell, piece.color, fromRow, fromCol, targetRow, targetCol)
        : movementAttacksSquare(currentState.board, "k", piece.color, fromRow, fromCol, targetRow, targetCol);
    }

    return movementAttacksSquare(currentState.board, piece.type, piece.color, fromRow, fromCol, targetRow, targetCol);
  }

  function movementAttacksSquare(board, type, color, fromRow, fromCol, targetRow, targetCol) {
    const dr = targetRow - fromRow;
    const dc = targetCol - fromCol;
    const absDr = Math.abs(dr);
    const absDc = Math.abs(dc);

    if (type === "p") {
      const direction = color === WHITE ? -1 : 1;
      return dr === direction && absDc === 1;
    }

    if (type === "n") {
      return (absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2);
    }

    if (type === "k") {
      return Math.max(absDr, absDc) === 1;
    }

    if (type === "b") {
      return absDr === absDc && absDr > 0 && pathIsClear(board, fromRow, fromCol, targetRow, targetCol);
    }

    if (type === "r") {
      return (dr === 0 || dc === 0) && (absDr + absDc > 0) && pathIsClear(board, fromRow, fromCol, targetRow, targetCol);
    }

    if (type === "q") {
      const diagonal = absDr === absDc && absDr > 0;
      const straight = (dr === 0 || dc === 0) && (absDr + absDc > 0);
      return (diagonal || straight) && pathIsClear(board, fromRow, fromCol, targetRow, targetCol);
    }

    return false;
  }

  function pathIsClear(board, fromRow, fromCol, targetRow, targetCol) {
    const stepRow = Math.sign(targetRow - fromRow);
    const stepCol = Math.sign(targetCol - fromCol);
    let row = fromRow + stepRow;
    let col = fromCol + stepCol;

    while (row !== targetRow || col !== targetCol) {
      if (board[row][col]) {
        return false;
      }

      row += stepRow;
      col += stepCol;
    }

    return true;
  }

  function getAllLegalActions(currentState, color) {
    const actions = [];

    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        actions.push(...generateLegalActionsForSquare(currentState, row, col, color, { includeDetach: true }));
      }
    }

    return actions;
  }

  function applyActionToState(currentState, action) {
    if (!action || currentState.gameOver) {
      return currentState;
    }

    const next = cloneState(currentState);
    let actorColor = currentState.turn;
    let logEntry = "";

    if (action.kind === "attach") {
      const king = next.board[action.king.row][action.king.col];
      const shellPiece = next.board[action.from.row][action.from.col];

      if (!king || king.type !== "k" || !shellPiece || next.shells[king.color]) {
        return currentState;
      }

      actorColor = king.color;
      next.board[action.from.row][action.from.col] = null;
      next.shells[actorColor] = shellPiece.type;
      logEntry = `${colorName(actorColor)} king attached ${articleFor(pieceName(shellPiece.type))} ${pieceName(shellPiece.type)} from ${coordsToSquare(action.from.row, action.from.col)}.`;
    } else if (action.kind === "detach") {
      const king = next.board[action.from.row][action.from.col];
      const target = next.board[action.to.row][action.to.col];

      if (
        !king ||
        king.type !== "k" ||
        !next.shells[king.color] ||
        !detachKeepsUnshelledKingSafe(currentState, action, king.color)
      ) {
        return currentState;
      }

      actorColor = king.color;

      if (target) {
        next.capturedBy[actorColor].push(clonePiece(target));
      }

      next.shells[actorColor] = null;
      next.board[action.to.row][action.to.col] = action.promotion
        ? createPiece(actorColor, "q")
        : createPiece(actorColor, action.shell);

      logEntry = `${colorName(actorColor)} king unshelled ${articleFor(pieceName(action.shell))} ${pieceName(action.shell)} to ${coordsToSquare(action.to.row, action.to.col)}`;

      if (target) {
        logEntry += `, capturing ${colorName(target.color).toLowerCase()} ${pieceName(target.type)}`;
      }

      if (action.promotion) {
        logEntry += " and promoting it to queen";
      }

      logEntry += ".";

      if (target && target.type === "k") {
        const wasShelled = Boolean(currentState.shells[target.color]);
        next.shells[target.color] = null;
        next.gameOver = true;
        next.result = wasShelled
          ? `${colorName(actorColor)} unshelled onto the shelled ${colorName(target.color).toLowerCase()} king. ${colorName(actorColor)} wins.`
          : `${colorName(actorColor)} unshelled onto the unshelled ${colorName(target.color).toLowerCase()} king. ${colorName(actorColor)} wins.`;
      }
    } else if (action.kind === "move") {
      const moving = next.board[action.from.row][action.from.col];
      const target = next.board[action.to.row][action.to.col];

      if (!moving) {
        return currentState;
      }

      actorColor = moving.color;
      const fromSquare = coordsToSquare(action.from.row, action.from.col);
      const toSquare = coordsToSquare(action.to.row, action.to.col);
      const movedAs = moving.type === "k" && next.shells[moving.color]
        ? `${pieceName(next.shells[moving.color])}-shelled king`
        : pieceName(moving.type);

      if (target) {
        next.capturedBy[actorColor].push(clonePiece(target));
      }

      next.board[action.from.row][action.from.col] = null;
      next.board[action.to.row][action.to.col] = action.promotion
        ? createPiece(moving.color, "q")
        : moving;

      logEntry = `${colorName(actorColor)} ${movedAs} ${fromSquare}${target ? "x" : "-"}${toSquare}`;

      if (action.promotion) {
        logEntry += " and promoted to queen";
      }

      logEntry += ".";

      if (target && target.type === "k") {
        const wasShelled = Boolean(next.shells[target.color]);
        next.shells[target.color] = null;
        next.gameOver = true;
        next.result = wasShelled
          ? `${colorName(actorColor)} captured the shelled ${colorName(target.color).toLowerCase()} king. ${colorName(actorColor)} wins.`
          : `${colorName(actorColor)} captured the unshelled ${colorName(target.color).toLowerCase()} king. ${colorName(actorColor)} wins.`;
      }
    }

    if (logEntry) {
      next.history.push(logEntry);
    }

    if (!next.gameOver) {
      next.turn = opposite(actorColor);
      settleGameStatus(next);
    }

    return next;
  }

  function articleFor(word) {
    return /^[aeiou]/i.test(word) ? "an" : "a";
  }

  function settleGameStatus(currentState) {
    const color = currentState.turn;
    const inCheck = isInCheck(currentState, color);
    const legalCount = getAllLegalActions(currentState, color).length;

    if (inCheck && legalCount === 0) {
      currentState.gameOver = true;
      currentState.result = `${colorName(color)} is checkmated. ${colorName(opposite(color))} wins.`;
      return;
    }

    if (!inCheck && legalCount === 0) {
      currentState.gameOver = true;
      currentState.result = `Draw by no legal moves for ${colorName(color).toLowerCase()}.`;
    }
  }

  function applyActionBySquares(currentState, fromSquare, toSquare) {
    const from = squareToCoords(fromSquare);
    const to = squareToCoords(toSquare);
    const actions = generateLegalActionsForSquare(currentState, from.row, from.col, currentState.turn);
    const action = actions.find((candidate) => {
      if (candidate.kind === "move") {
        return candidate.to.row === to.row && candidate.to.col === to.col;
      }

      return candidate.from.row === to.row && candidate.from.col === to.col;
    });

    return action ? applyActionToState(currentState, action) : currentState;
  }

  function createScenario(name) {
    if (name === "standard") {
      return createInitialState();
    }

    const scenario = createEmptyScenario();

    if (name === "unshelled-checkmate" || name === "fools-mate") {
      place(scenario, "h1", WHITE, "k");
      place(scenario, "f3", BLACK, "k");
      place(scenario, "g2", BLACK, "q");
      scenario.turn = WHITE;
    } else if (name === "knight-shell") {
      place(scenario, "e4", WHITE, "k");
      place(scenario, "f4", WHITE, "n");
      place(scenario, "a8", BLACK, "k");
      scenario.turn = WHITE;
    } else if (name === "bishop-shell") {
      place(scenario, "e4", WHITE, "k");
      place(scenario, "d3", WHITE, "b");
      place(scenario, "a8", BLACK, "k");
      scenario.turn = WHITE;
    } else if (name === "rook-shell") {
      place(scenario, "e4", WHITE, "k");
      place(scenario, "e3", WHITE, "r");
      place(scenario, "a8", BLACK, "k");
      scenario.turn = WHITE;
    } else if (name === "queen-shell") {
      place(scenario, "e4", WHITE, "k");
      place(scenario, "d4", WHITE, "q");
      place(scenario, "a8", BLACK, "k");
      scenario.turn = WHITE;
    } else if (name === "white-pawn-shell") {
      place(scenario, "e4", WHITE, "k");
      place(scenario, "e5", WHITE, "p");
      place(scenario, "a8", BLACK, "k");
      scenario.turn = WHITE;
    } else if (name === "black-pawn-shell") {
      place(scenario, "a1", WHITE, "k");
      place(scenario, "d5", BLACK, "k");
      place(scenario, "d4", BLACK, "p");
      scenario.turn = BLACK;
    } else if (name === "shelled-capture") {
      place(scenario, "e4", WHITE, "k");
      place(scenario, "a8", BLACK, "k");
      place(scenario, "e8", BLACK, "r");
      scenario.shells.w = "n";
      scenario.turn = BLACK;
    }

    settleGameStatus(scenario);
    return scenario;
  }

  function createEmptyScenario() {
    return {
      board: createBlankBoard(),
      turn: WHITE,
      shells: { w: null, b: null },
      capturedBy: { w: [], b: [] },
      gameOver: false,
      result: "",
      history: []
    };
  }

  function place(currentState, square, color, type) {
    const coords = squareToCoords(square);
    currentState.board[coords.row][coords.col] = createPiece(color, type);
  }

  function initUi() {
    elements = {
      board: document.getElementById("board"),
      newGameButton: document.getElementById("newGameButton"),
      scenarioSelect: document.getElementById("scenarioSelect"),
      loadScenarioButton: document.getElementById("loadScenarioButton"),
      menuButton: document.getElementById("menuButton"),
      closeMenuButton: document.getElementById("closeMenuButton"),
      menuBackdrop: document.getElementById("menuBackdrop"),
      appMenu: document.getElementById("appMenu"),
      moveHint: document.getElementById("moveHint"),
      turnStatus: document.getElementById("turnStatus"),
      whiteShellStatus: document.getElementById("whiteShellStatus"),
      blackShellStatus: document.getElementById("blackShellStatus"),
      checkStatus: document.getElementById("checkStatus"),
      capturedByWhite: document.getElementById("capturedByWhite"),
      capturedByBlack: document.getElementById("capturedByBlack"),
      resultBanner: document.getElementById("resultBanner"),
      moveLog: document.getElementById("moveLog")
    };

    elements.newGameButton.addEventListener("click", () => {
      state = createInitialState();
      selected = null;
      legalActions = [];
      elements.scenarioSelect.value = "standard";
      render();
    });

    elements.loadScenarioButton.addEventListener("click", () => {
      state = createScenario(elements.scenarioSelect.value);
      selected = null;
      legalActions = [];
      render();
      closeMenu();
    });

    elements.menuButton.addEventListener("click", openMenu);
    elements.closeMenuButton.addEventListener("click", closeMenu);
    elements.menuBackdrop.addEventListener("click", closeMenu);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    });

    registerServiceWorker();
    render();
  }

  function openMenu() {
    elements.menuBackdrop.hidden = false;
    elements.appMenu.setAttribute("aria-hidden", "false");
    elements.menuButton.setAttribute("aria-expanded", "true");
    document.body.classList.add("menu-open");

    requestAnimationFrame(() => {
      elements.menuBackdrop.classList.add("open");
      elements.appMenu.classList.add("open");
    });
  }

  function closeMenu() {
    if (!elements.appMenu) {
      return;
    }

    elements.menuBackdrop.classList.remove("open");
    elements.appMenu.classList.remove("open");
    elements.appMenu.setAttribute("aria-hidden", "true");
    elements.menuButton.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");

    window.setTimeout(() => {
      if (!elements.appMenu.classList.contains("open")) {
        elements.menuBackdrop.hidden = true;
      }
    }, 190);
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || window.location.protocol === "file:") {
      return;
    }

    navigator.serviceWorker.register("service-worker.js").catch(() => {
      // Local static hosting still works if service worker registration is unavailable.
    });
  }

  function render() {
    renderBoard();
    renderStatus();
    renderHint();
  }

  function renderBoard() {
    if (!elements.board) {
      return;
    }

    elements.board.replaceChildren();
    const whiteKing = findKing(state, WHITE);
    const blackKing = findKing(state, BLACK);
    const whiteInCheck = isInCheck(state, WHITE);
    const blackInCheck = isInCheck(state, BLACK);

    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const square = document.createElement("button");
        const piece = state.board[row][col];
        const action = actionForTarget(row, col);
        const isSelected = sameCoords(selected, { row, col });
        const isLight = (row + col) % 2 === 0;
        const squareName = coordsToSquare(row, col);

        square.type = "button";
        square.className = `square ${isLight ? "light" : "dark"}`;
        square.dataset.row = String(row);
        square.dataset.col = String(col);
        square.setAttribute("role", "gridcell");
        square.setAttribute("aria-label", squareLabel(squareName, piece, action));

        if (piece) {
          square.classList.add("has-piece");
        }

        if (isSelected) {
          square.classList.add("selected");
        }

        if (action) {
          square.classList.add(action.kind === "attach" ? "attach" : action.kind === "detach" ? "detach" : "legal");
          if ((action.kind === "move" || action.kind === "detach") && action.capture) {
            square.classList.add("capture");
          }
        }

        if (
          (whiteInCheck && whiteKing && whiteKing.row === row && whiteKing.col === col) ||
          (blackInCheck && blackKing && blackKing.row === row && blackKing.col === col)
        ) {
          square.classList.add("check");
        }

        if (row === 7) {
          const file = document.createElement("span");
          file.className = "coord file";
          file.textContent = FILES[col];
          square.appendChild(file);
        }

        if (col === 0) {
          const rank = document.createElement("span");
          rank.className = "coord rank";
          rank.textContent = String(8 - row);
          square.appendChild(rank);
        }

        if (piece) {
          const pieceSpan = document.createElement("span");
          pieceSpan.className = `piece ${piece.color === BLACK ? "black-piece" : "white-piece"}`;
          pieceSpan.textContent = pieceSymbol(piece);
          square.appendChild(pieceSpan);

          if (piece.type === "k" && state.shells[piece.color]) {
            const shellPiece = createPiece(piece.color, state.shells[piece.color]);
            const hat = document.createElement("span");
            hat.className = `shell-hat ${piece.color === BLACK ? "black-piece" : "white-piece"}`;
            hat.textContent = pieceSymbol(shellPiece);
            hat.title = `${pieceName(state.shells[piece.color])} shell`;
            square.appendChild(hat);
          }
        }

        square.addEventListener("click", onSquareClick);
        elements.board.appendChild(square);
      }
    }
  }

  function squareLabel(squareName, piece, action) {
    const parts = [squareName];

    if (piece) {
      parts.push(`${colorName(piece.color)} ${pieceName(piece.type)}`);
      if (piece.type === "k" && state.shells[piece.color]) {
        parts.push(`with ${pieceName(state.shells[piece.color])} shell`);
      }
    } else {
      parts.push("empty");
    }

    if (action) {
      parts.push(action.kind === "attach" ? "attach target" : action.kind === "detach" ? "unshell target" : "legal move");
    }

    return parts.join(", ");
  }

  function actionForTarget(row, col) {
    return legalActions.find((action) => {
      if (action.kind === "move" || action.kind === "detach") {
        return action.to.row === row && action.to.col === col;
      }

      return action.from.row === row && action.from.col === col;
    });
  }

  function onSquareClick(event) {
    if (state.gameOver) {
      return;
    }

    const row = Number(event.currentTarget.dataset.row);
    const col = Number(event.currentTarget.dataset.col);
    const action = actionForTarget(row, col);

    if (selected && action) {
      state = applyActionToState(state, action);
      selected = null;
      legalActions = [];
      render();
      return;
    }

    const piece = state.board[row][col];

    if (
      selected &&
      selected.row === row &&
      selected.col === col &&
      piece &&
      piece.color === state.turn &&
      piece.type === "k" &&
      state.shells[piece.color]
    ) {
      selected.mode = selected.mode === "detach" ? "move" : "detach";
      legalActions = selected.mode === "detach"
        ? generateDetachActions(state, row, col, piece)
        : generateLegalActionsForSquare(state, row, col, state.turn);
      render();
      return;
    }

    if (piece && piece.color === state.turn) {
      selected = { row, col, mode: "move" };
      legalActions = generateLegalActionsForSquare(state, row, col, state.turn);
      render();
      return;
    }

    selected = null;
    legalActions = [];
    render();
  }

  function renderStatus() {
    if (!elements.turnStatus) {
      return;
    }

    elements.turnStatus.textContent = state.gameOver ? "Game over" : `${colorName(state.turn)} to move`;
    elements.whiteShellStatus.textContent = formatShellStatus(WHITE);
    elements.blackShellStatus.textContent = formatShellStatus(BLACK);
    elements.checkStatus.textContent = formatCheckStatus();
    renderCapturedList(elements.capturedByWhite, WHITE);
    renderCapturedList(elements.capturedByBlack, BLACK);

    if (state.gameOver) {
      elements.resultBanner.hidden = false;
      elements.resultBanner.textContent = state.result;
    } else {
      elements.resultBanner.hidden = true;
      elements.resultBanner.textContent = "";
    }

    elements.moveLog.replaceChildren();
    state.history.forEach((entry) => {
      const item = document.createElement("li");
      item.textContent = entry;
      elements.moveLog.appendChild(item);
    });
  }

  function formatShellStatus(color) {
    const king = findKing(state, color);

    if (!king) {
      return "King captured";
    }

    return state.shells[color] ? `${capitalize(pieceName(state.shells[color]))} shell` : "None";
  }

  function formatCheckStatus() {
    const statuses = [];

    for (const color of [WHITE, BLACK]) {
      const king = findKing(state, color);

      if (!king) {
        statuses.push(`${colorName(color)} king captured`);
      } else if (state.shells[color]) {
        statuses.push(`${colorName(color)} shelled`);
      } else if (isInCheck(state, color)) {
        statuses.push(`${colorName(color)} in check`);
      }
    }

    return statuses.length ? statuses.join("; ") + "." : "No checks.";
  }

  function formatCaptured(color) {
    const captured = state.capturedBy[color];
    return captured.length ? captured.map(pieceSymbol).join(" ") : "None";
  }

  function renderCapturedList(element, color) {
    const captured = state.capturedBy[color];

    element.textContent = formatCaptured(color);
    element.classList.toggle("empty-captured", captured.length === 0);
    element.classList.toggle("has-captured-pieces", captured.length > 0);
  }

  function renderHint() {
    if (!elements.moveHint) {
      return;
    }

    if (state.gameOver) {
      elements.moveHint.textContent = state.result;
      return;
    }

    if (!selected) {
      elements.moveHint.textContent = "Select a piece to see legal moves. Shell targets are marked separately from movement.";
      return;
    }

    const piece = state.board[selected.row][selected.col];
    const moveCount = legalActions.filter((action) => action.kind === "move").length;
    const attachCount = legalActions.filter((action) => action.kind === "attach").length;
    const detachCount = legalActions.filter((action) => action.kind === "detach").length;
    const square = coordsToSquare(selected.row, selected.col);

    if (!piece) {
      elements.moveHint.textContent = "Select a piece to see legal moves.";
      return;
    }

    if (piece.type === "k" && state.shells[piece.color] && selected.mode === "detach") {
      elements.moveHint.textContent = detachCount
        ? `Unshelling mode: choose where the ${pieceName(state.shells[piece.color])} shell lands. ${detachCount} legal unshell targets.`
        : `Unshelling mode: the ${pieceName(state.shells[piece.color])} shell has no legal landing square that leaves the king safe.`;
      return;
    }

    if (piece.type === "k" && state.shells[piece.color]) {
      elements.moveHint.textContent = `${colorName(piece.color)} king on ${square} has a ${pieceName(state.shells[piece.color])} shell: ${moveCount} shell moves. Click the king again to unshell.`;
      return;
    }

    if (piece.type === "k") {
      elements.moveHint.textContent = `${colorName(piece.color)} unshelled king on ${square}: ${moveCount} king moves, ${attachCount} attach targets.`;
      return;
    }

    elements.moveHint.textContent = `${colorName(piece.color)} ${pieceName(piece.type)} on ${square}: ${moveCount} legal moves.`;
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  const api = {
    createInitialState,
    createScenario,
    cloneState,
    generateLegalActionsForSquare,
    generateDetachActions,
    getAllLegalActions,
    applyActionToState,
    applyActionBySquares,
    isInCheck,
    isSquareAttackedBy,
    squareToCoords,
    coordsToSquare,
    pieceName
  };

  root.HermitCrabChess = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", initUi);
  }
}(typeof globalThis !== "undefined" ? globalThis : window));

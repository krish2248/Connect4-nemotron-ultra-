const gameLogic = require('./gameLogic');

const { COLS, ROWS, EMPTY, switchPlayer, checkWin } = gameLogic;

// Difficulty tuning. `depth` is the minimax search depth; `random` is the
// probability of playing a (non-losing) random move instead of the best one,
// which makes the easier bots feel human rather than robotic.
const DIFFICULTY = {
  easy: { depth: 2, random: 0.45 },
  medium: { depth: 4, random: 0.12 },
  hard: { depth: 7, random: 0 }
};

// Column search order, centre-first — better moves are usually central, so
// this makes alpha-beta pruning cut far more branches.
const COLUMN_ORDER = (() => {
  const centre = Math.floor(COLS / 2);
  return Array.from({ length: COLS }, (_, c) => c)
    .sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre));
})();

const WIN_SCORE = 1000000;

function cloneBoard(board) {
  return board.map(col => col.slice());
}

function validMoves(board) {
  return COLUMN_ORDER.filter(c => board[c][ROWS - 1] === EMPTY);
}

// Drop a piece into `col`, returning the row it landed on (or -1 if full).
function dropInPlace(board, col, player) {
  for (let row = 0; row < ROWS; row++) {
    if (board[col][row] === EMPTY) {
      board[col][row] = player;
      return row;
    }
  }
  return -1;
}

function undo(board, col, row) {
  board[col][row] = EMPTY;
}

// Score a single 4-cell window from the bot's perspective.
function scoreWindow(cells, bot, opp) {
  let botCount = 0;
  let oppCount = 0;
  let empty = 0;
  for (const cell of cells) {
    if (cell === bot) botCount++;
    else if (cell === opp) oppCount++;
    else empty++;
  }
  if (botCount > 0 && oppCount > 0) return 0; // blocked window, no value

  if (botCount === 4) return 100;
  if (botCount === 3 && empty === 1) return 8;
  if (botCount === 2 && empty === 2) return 3;
  if (oppCount === 4) return -100;
  // Weight defence slightly higher than offence so the bot respects threats.
  if (oppCount === 3 && empty === 1) return -10;
  if (oppCount === 2 && empty === 2) return -3;
  return 0;
}

// Heuristic board evaluation from the bot's point of view.
function evaluate(board, bot, opp) {
  let score = 0;

  // Centre control bonus.
  const centre = Math.floor(COLS / 2);
  for (let row = 0; row < ROWS; row++) {
    if (board[centre][row] === bot) score += 3;
    else if (board[centre][row] === opp) score -= 3;
  }

  const directions = [
    [1, 0],  // horizontal
    [0, 1],  // vertical
    [1, 1],  // diagonal up-right
    [1, -1]  // diagonal down-right
  ];

  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      for (const [dc, dr] of directions) {
        const endC = c + 3 * dc;
        const endR = r + 3 * dr;
        if (endC < 0 || endC >= COLS || endR < 0 || endR >= ROWS) continue;
        const cells = [
          board[c][r],
          board[c + dc][r + dr],
          board[c + 2 * dc][r + 2 * dr],
          board[endC][endR]
        ];
        score += scoreWindow(cells, bot, opp);
      }
    }
  }

  return score;
}

// Minimax with alpha-beta pruning. Returns { score, col }.
function minimax(board, depth, alpha, beta, maximizing, bot, opp) {
  const moves = validMoves(board);

  if (moves.length === 0) {
    return { score: 0, col: null }; // draw
  }
  if (depth === 0) {
    return { score: evaluate(board, bot, opp), col: null };
  }

  let bestCol = moves[0];

  if (maximizing) {
    let best = -Infinity;
    for (const col of moves) {
      const row = dropInPlace(board, col, bot);
      let score;
      if (checkWin(board, col, row, bot).win) {
        score = WIN_SCORE + depth; // faster wins score higher
      } else {
        score = minimax(board, depth - 1, alpha, beta, false, bot, opp).score;
      }
      undo(board, col, row);
      if (score > best) {
        best = score;
        bestCol = col;
      }
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return { score: best, col: bestCol };
  }

  let best = Infinity;
  for (const col of moves) {
    const row = dropInPlace(board, col, opp);
    let score;
    if (checkWin(board, col, row, opp).win) {
      score = -WIN_SCORE - depth;
    } else {
      score = minimax(board, depth - 1, alpha, beta, true, bot, opp).score;
    }
    undo(board, col, row);
    if (score < best) {
      best = score;
      bestCol = col;
    }
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return { score: best, col: bestCol };
}

// Find any column that gives `player` an immediate win, else null.
function findWinningMove(board, player) {
  for (const col of validMoves(board)) {
    const row = dropInPlace(board, col, player);
    const won = checkWin(board, col, row, player).win;
    undo(board, col, row);
    if (won) return col;
  }
  return null;
}

/**
 * Choose the bot's column.
 * @param {number[][]} board  column-major board (board[col][row])
 * @param {number} botPlayer  1 or 2
 * @param {string} difficulty 'easy' | 'medium' | 'hard'
 * @returns {number|null} chosen column, or null if the board is full
 */
function chooseMove(board, botPlayer, difficulty = 'medium') {
  const settings = DIFFICULTY[difficulty] || DIFFICULTY.medium;
  const opp = switchPlayer(botPlayer);
  const moves = validMoves(board);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  // 1. Take an immediate win — always.
  const winning = findWinningMove(board, botPlayer);
  if (winning !== null) return winning;

  // 2. Block the opponent's immediate win. The easy bot occasionally misses it.
  const skipBlock = difficulty === 'easy' && Math.random() < 0.3;
  if (!skipBlock) {
    const block = findWinningMove(board, opp);
    if (block !== null) return block;
  }

  // 3. Sometimes just play a random legal move (keeps easier bots beatable).
  if (settings.random > 0 && Math.random() < settings.random) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  // 4. Full minimax search.
  const clone = cloneBoard(board);
  const { col } = minimax(clone, settings.depth, -Infinity, Infinity, true, botPlayer, opp);
  return col !== null && col !== undefined ? col : moves[0];
}

module.exports = { chooseMove, evaluate, DIFFICULTY };

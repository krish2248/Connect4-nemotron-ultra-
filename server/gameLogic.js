const ROOMS = 7;
const COLS = 7;
const ROWS = 6;
const EMPTY = 0;
const PLAYER1 = 1;
const PLAYER2 = 2;
const PLAYER_COLORS = { 1: 'yellow', 2: 'red' };

function createGameState() {
  const board = Array.from({ length: COLS }, () => Array(ROWS).fill(EMPTY));
  return {
    board,
    currentPlayer: PLAYER1,
    moveCount: 0,
    winner: null,
    winningCoords: null,
    isDraw: false,
    nearWins: { 1: 0, 2: 0 }
  };
}

function dropCoin(board, col, player) {
  if (col < 0 || col >= COLS) return { success: false, reason: 'invalidColumn' };
  if (board[col][ROWS - 1] !== EMPTY) return { success: false, reason: 'columnFull' };

  for (let row = 0; row < ROWS; row++) {
    if (board[col][row] === EMPTY) {
      board[col][row] = player;
      return { success: true, row, board };
    }
  }
  return { success: false, reason: 'columnFull' };
}

function checkWin(board, col, row, player) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];

  for (const [dc, dr] of directions) {
    let count = 1;
    const coords = [[col, row]];

    for (const dir of [1, -1]) {
      let c = col + dc * dir;
      let r = row + dr * dir;
      while (c >= 0 && c < COLS && r >= 0 && r < ROWS && board[c][r] === player) {
        count++;
        coords.push([c, r]);
        c += dc * dir;
        r += dr * dir;
      }
    }

    if (count >= 4) {
      return { win: true, winningCoords: coords };
    }
  }

  return { win: false, winningCoords: null };
}

function checkDraw(board) {
  for (let c = 0; c < COLS; c++) {
    if (board[c][ROWS - 1] === EMPTY) return false;
  }
  return true;
}

function getValidMoves(board) {
  const moves = [];
  for (let c = 0; c < COLS; c++) {
    if (board[c][ROWS - 1] === EMPTY) moves.push(c);
  }
  return moves;
}

function checkNearWin(board, player) {
  const opponent = player === PLAYER1 ? PLAYER2 : PLAYER1;
  let nearWins = 0;

  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (board[c][r] !== EMPTY) continue;

      board[c][r] = opponent;
      const result = checkWin(board, c, r, opponent);
      if (result.win) nearWins++;
      board[c][r] = EMPTY;
    }
  }

  return nearWins;
}

function serializeForClient(gameState, playerId) {
  return {
    board: gameState.board,
    currentPlayer: gameState.currentPlayer,
    moveCount: gameState.moveCount,
    winner: gameState.winner,
    winningCoords: gameState.winningCoords,
    isDraw: gameState.isDraw,
    nearWins: gameState.nearWins
  };
}

function serializeForOpponent(gameState) {
  return serializeForClient(gameState, null);
}

module.exports = {
  COLS,
  ROWS,
  EMPTY,
  PLAYER1,
  PLAYER2,
  PLAYER_COLORS,
  createGameState,
  dropCoin,
  checkWin,
  checkDraw,
  getValidMoves,
  checkNearWin,
  serializeForClient,
  serializeForOpponent
};
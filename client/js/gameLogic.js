const COLS = 7;
const ROWS = 6;
const EMPTY = 0;
const PLAYER1 = 1;
const PLAYER2 = 2;

export const ClientGameLogic = {
  getDropRow(board, col) {
    for (let row = 0; row < ROWS; row++) {
      if (board[col][row] === EMPTY) return row;
    }
    return -1;
  },

  isValidMove(board, col) {
    return col >= 0 && col < COLS && board[col][ROWS - 1] === EMPTY;
  },

  getValidMoves(board) {
    const moves = [];
    for (let c = 0; c < COLS; c++) {
      if (board[c][ROWS - 1] === EMPTY) moves.push(c);
    }
    return moves;
  },

  checkWin(board, col, row, player) {
    const directions = [
      [1, 0],   // horizontal
      [0, 1],   // vertical
      [1, 1],   // diagonal /
      [1, -1]   // diagonal \
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

      if (count >= 4) return { win: true, winningCoords: coords };
    }

    return { win: false, winningCoords: null };
  },

  checkDraw(board) {
    for (let c = 0; c < COLS; c++) {
      if (board[c][ROWS - 1] === EMPTY) return false;
    }
    return true;
  },

  checkNearWin(board, player) {
    const opponent = player === PLAYER1 ? PLAYER2 : PLAYER1;
    let nearWins = 0;

    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (board[c][r] !== EMPTY) continue;

        board[c][r] = opponent;
        const result = this.checkWin(board, c, r, opponent);
        if (result.win) nearWins++;
        board[c][r] = EMPTY;
      }
    }

    return nearWins;
  }
};
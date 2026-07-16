const gameLogic = require('./gameLogic');
const timer = require('./timer');
const rooms = require('./rooms');

function send(ws, type, payload) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

function broadcast(room, type, payload, excludeWs = null) {
  if (!room) return;
  room.players.forEach(player => {
    if (player.ws && player.ws.readyState === 1 && player.ws !== excludeWs) {
      send(player.ws, type, payload);
    }
  });
}

function handleMessage(ws, message, roomsModule) {
  const { type, payload } = message;

  switch (type) {
    case 'createRoom':
      handleCreateRoom(ws, payload);
      break;
    case 'joinRoom':
      handleJoinRoom(ws, payload);
      break;
    case 'dropCoin':
      handleDropCoin(ws, payload);
      break;
    case 'requestRematch':
      handleRequestRematch(ws, payload);
      break;
    case 'requestReconnect':
      handleRequestReconnect(ws, payload);
      break;
    case 'requestState':
      handleRequestState(ws, payload);
      break;
    default:
      console.warn('Unknown message type:', type);
  }
}

function handleCreateRoom(ws, payload) {
  const { name, password, playerName } = payload;
  const { roomId, playerId } = rooms.createRoom(name, password, ws, playerName);
  const room = rooms.getRoom(roomId);

  send(ws, 'roomCreated', {
    roomId,
    roomName: room.name,
    playerId,
    playerColor: 'yellow',
    isHost: true
  });
}

function handleJoinRoom(ws, payload) {
  const { roomId, password, playerName } = payload;
  const result = rooms.joinRoom(roomId, password, ws, playerName);

  if (result.error) {
    send(ws, 'roomError', { code: result.error, message: result.message });
    return;
  }

  const { room } = result;
  const player = room.players.find(p => p.id === result.playerId);
  const opponent = room.players.find(p => p.id !== result.playerId);

  send(ws, 'roomJoined', {
    roomId: room.id,
    roomName: room.name,
    players: room.players.map(p => ({ id: p.id, name: p.name, color: p.color, isHost: p.isHost })),
    playerId: result.playerId,
    playerColor: player.color,
    gameState: room.gameState ? gameLogic.serializeForClient(room.gameState, result.playerId) : null
  });

  if (opponent && opponent.ws && opponent.ws.readyState === 1) {
    send(opponent.ws, 'roomJoined', {
      roomId: room.id,
      roomName: room.name,
      players: room.players.map(p => ({ id: p.id, name: p.name, color: p.color, isHost: p.isHost })),
      playerId: opponent.id,
      playerColor: opponent.color,
      gameState: room.gameState ? gameLogic.serializeForClient(room.gameState, opponent.id) : null
    });
  }

  if (room.players.length === 2) {
    startGame(room);
  }
}

function startGame(room) {
  room.gameState = gameLogic.createGameState();
  room.status = 'playing';
  room.lastActivity = Date.now();

  const state1 = gameLogic.serializeForClient(room.gameState, room.players[0].id);
  const state2 = gameLogic.serializeForClient(room.gameState, room.players[1].id);

  room.players.forEach((player, i) => {
    if (player.ws && player.ws.readyState === 1) {
      send(player.ws, 'gameStart', {
        gameState: i === 0 ? state1 : state2,
        countdown: 3
      });
    }
  });

  setTimeout(() => {
    timer.startTurnTimer(room, gameLogic.YELLOW);
  }, 3500);
}

function handleDropCoin(ws, payload) {
  const { column } = payload;
  const room = rooms.getRoom(ws.roomId);

  if (!room || room.status !== 'playing') return;
  if (!room.gameState || room.gameState.winner || room.gameState.isDraw) return;

  const currentPlayerNum = room.gameState.currentPlayer;
  const playerColor = currentPlayerNum === gameLogic.YELLOW ? 'yellow' : 'red';
  const isCurrentPlayer = ws.playerColor === playerColor;

  if (!isCurrentPlayer) {
    send(ws, 'coinError', { reason: 'notYourTurn', column });
    return;
  }

  const result = gameLogic.dropCoin(room.gameState.board, column, currentPlayerNum);

  if (!result.success) {
    send(ws, 'coinError', { reason: result.reason, column });
    return;
  }

  room.gameState.moveCount++;
  room.lastActivity = Date.now();

  const winResult = gameLogic.checkWin(room.gameState.board, column, result.row, currentPlayerNum);
  let isDraw = false;

  if (winResult.win) {
    room.gameState.winner = currentPlayerNum;
    room.gameState.winningCoords = winResult.winningCoords;
    room.status = 'finished';
    timer.stopTurnTimer(room);
  } else if (gameLogic.checkDraw(room.gameState.board)) {
    room.gameState.isDraw = true;
    isDraw = true;
    room.status = 'finished';
    timer.stopTurnTimer(room);
  } else {
    room.gameState.currentPlayer = gameLogic.switchPlayer(currentPlayerNum);
    timer.switchTurn(room);
  }

  const state1 = gameLogic.serializeForClient(room.gameState, room.players[0].id);
  const state2 = gameLogic.serializeForClient(room.gameState, room.players[1].id);

  room.players.forEach((player, i) => {
    if (player.ws && player.ws.readyState === 1) {
      send(player.ws, 'coinDropped', {
        column,
        row: result.row,
        player: currentPlayerNum,
        board: room.gameState.board
      });

      send(player.ws, 'gameState', i === 0 ? state1 : state2);
    }
  });

  if (room.status === 'finished') {
    setTimeout(() => {
      const stats = generateGameStats(room);
      room.players.forEach((player, i) => {
        if (player.ws && player.ws.readyState === 1) {
          send(player.ws, 'gameEnd', {
            winner: room.gameState.winner,
            winningCoords: room.gameState.winningCoords,
            isDraw: room.gameState.isDraw,
            stats: i === 0 ? stats.player1 : stats.player2
          });
        }
      });
    }, 500);
  }
}

function generateGameStats(room) {
  const duration = Date.now() - room.gameState.startedAt;
  const moves = room.gameState.moveCount;

  return {
    player1: {
      duration,
      totalMoves: Math.ceil(moves / 2)
    },
    player2: {
      duration,
      totalMoves: Math.floor(moves / 2)
    }
  };
}

function handleRequestRematch(ws, payload) {
  const room = rooms.getRoom(ws.roomId);
  if (!room || room.status !== 'finished') return;

  const opponent = room.players.find(p => p.id !== ws.playerId);
  if (opponent && opponent.ws && opponent.ws.readyState === 1) {
    send(opponent.ws, 'rematchOffered', { fromPlayerId: ws.playerId });
  }
}

function handleRematchAccepted(room) {
  room.gameState = gameLogic.createGameState();
  room.status = 'playing';
  room.lastActivity = Date.now();

  const state1 = gameLogic.serializeForClient(room.gameState, room.players[0].id);
  const state2 = gameLogic.serializeForClient(room.gameState, room.players[1].id);

  room.players.forEach((player, i) => {
    if (player.ws && player.ws.readyState === 1) {
      send(player.ws, 'rematchAccepted', { gameState: i === 0 ? state1 : state2 });
    }
  });

  setTimeout(() => {
    timer.startTurnTimer(room, gameLogic.YELLOW);
  }, 1000);
}

function handleRequestReconnect(ws, payload) {
  const { roomId, playerId } = payload;
  const result = rooms.handleReconnect(ws, roomId, playerId);

  if (result.error) {
    send(ws, 'roomError', { code: result.error, message: result.message });
    return;
  }

  const { room, gameState, timerState, player } = result;
  const opponent = room.players.find(p => p.id !== playerId);

  send(ws, 'stateSync', {
    gameState,
    timerState,
    playerColor: player.color,
    playerName: player.name,
    opponentName: opponent?.name || 'Opponent',
    opponentColor: opponent?.color || (player.color === 'yellow' ? 'red' : 'yellow')
  });

  if (opponent && opponent.ws && opponent.ws.readyState === 1) {
    send(opponent.ws, 'playerReconnected', { playerId });
  }
}

function handleRequestState(ws, payload) {
  const room = rooms.getRoom(ws.roomId);
  if (!room) return;

  const gameState = room.gameState ? gameLogic.serializeForClient(room.gameState, ws.playerId) : null;
  const timerState = timer.getTimerState(room);

  send(ws, 'stateSync', { gameState, timerState });
}

module.exports = {
  send,
  broadcast,
  handleMessage
};
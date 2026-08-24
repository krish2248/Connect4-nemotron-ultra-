const gameLogic = require('./gameLogic');
const timer = require('./timer');
const rooms = require('./rooms');
const ai = require('./ai');

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
  room.spectators.forEach(spectator => {
    if (spectator.ws && spectator.ws.readyState === 1 && spectator.ws !== excludeWs) {
      send(spectator.ws, type, payload);
    }
  });
}

function broadcastToSpectators(room, type, payload) {
  if (!room) return;
  room.spectators.forEach(spectator => {
    if (spectator.ws && spectator.ws.readyState === 1) {
      send(spectator.ws, type, payload);
    }
  });
}

function handleMessage(ws, message, roomsModule) {
  const { type, payload } = message;

  switch (type) {
    case 'createRoom':
      handleCreateRoom(ws, payload);
      break;
    case 'createSinglePlayer':
      handleCreateSinglePlayer(ws, payload);
      break;
    case 'joinRoom':
      handleJoinRoom(ws, payload);
      break;
    case 'joinSpectator':
      handleJoinSpectator(ws, payload);
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
    case 'sendChat':
      handleSendChat(ws, payload);
      break;
    case 'ping':
      // Client heartbeat — no response needed; the ws-level ping/pong in
      // server.js handles liveness.
      break;
    default:
      console.warn('Unknown message type:', type);
  }
}

function handleCreateRoom(ws, payload) {
  const { name, password, playerName, rating } = payload;
  const { roomId, playerId } = rooms.createRoom(name, password, ws, playerName, rating);
  const room = rooms.getRoom(roomId);

  send(ws, 'roomCreated', {
    roomId,
    roomName: room.name,
    playerId,
    playerColor: 'yellow',
    isHost: true
  });
}

function handleCreateSinglePlayer(ws, payload) {
  const { playerName, difficulty, rating } = payload;
  const { room, roomId, playerId } = rooms.createSinglePlayerRoom(playerName, difficulty, ws, rating);
  const bot = room.players.find(p => p.isBot);

  send(ws, 'roomCreated', {
    roomId,
    roomName: room.name,
    playerId,
    playerColor: 'yellow',
    isHost: true,
    singlePlayer: true,
    difficulty: room.difficulty,
    opponentName: bot.name
  });

  startGame(room);
}

function handleJoinRoom(ws, payload) {
  const { roomId, password, playerName, rating } = payload;
  const result = rooms.joinRoom(roomId, password, ws, playerName, rating);

  if (result.error) {
    send(ws, 'roomError', { code: result.error, message: result.message });
    return;
  }

  const { room } = result;
  const player = room.players.find(p => p.id === result.playerId);
  const opponent = room.players.find(p => p.id !== result.playerId);
  const playersList = () => room.players.map(p => ({ id: p.id, name: p.name, color: p.color, isHost: p.isHost, rating: Number.isFinite(p.rating) ? p.rating : null }));

  send(ws, 'roomJoined', {
    roomId: room.id,
    roomName: room.name,
    players: playersList(),
    playerId: result.playerId,
    playerColor: player.color,
    gameState: room.gameState ? gameLogic.serializeForClient(room.gameState, result.playerId) : null
  });

  if (opponent && opponent.ws && opponent.ws.readyState === 1) {
    send(opponent.ws, 'roomJoined', {
      roomId: room.id,
      roomName: room.name,
      players: playersList(),
      playerId: opponent.id,
      playerColor: opponent.color,
      gameState: room.gameState ? gameLogic.serializeForClient(room.gameState, opponent.id) : null
    });
  }

  if (room.players.length === 2) {
    startGame(room);
  }
}

function handleJoinSpectator(ws, payload) {
  const { roomId, spectatorName } = payload;
  const result = rooms.joinAsSpectator(roomId, ws, spectatorName);

  if (result.error) {
    send(ws, 'roomError', { code: result.error, message: result.message });
    return;
  }

  const { room, spectatorId, gameState, players } = result;

  send(ws, 'spectatorJoined', {
    roomId: room.id,
    roomName: room.name,
    spectatorId,
    players,
    gameState
  });
}

function startGame(room) {
  room.gameState = gameLogic.createGameState();
  room.status = 'playing';
  room.lastActivity = Date.now();

  const state1 = gameLogic.serializeForClient(room.gameState, room.players[0].id);
  const state2 = gameLogic.serializeForClient(room.gameState, room.players[1].id);
  const spectatorState = gameLogic.serializeForClient(room.gameState, null);

  room.players.forEach((player, i) => {
    if (player.ws && player.ws.readyState === 1) {
      send(player.ws, 'gameStart', {
        gameState: i === 0 ? state1 : state2,
        countdown: 3
      });
    }
  });

  room.spectators.forEach(spectator => {
    if (spectator.ws && spectator.ws.readyState === 1) {
      send(spectator.ws, 'gameStart', {
        gameState: spectatorState,
        countdown: 3
      });
    }
  });

  setTimeout(() => {
    advanceTurn(room);
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

  const outcome = applyMove(room, column, currentPlayerNum);
  if (!outcome.success) {
    send(ws, 'coinError', { reason: outcome.reason, column });
  }
}

// Apply a validated move for `playerNum`, then broadcast, resolve win/draw, and
// hand the turn onward. Shared by the human drop path and the AI bot.
function applyMove(room, column, playerNum) {
  const result = gameLogic.dropCoin(room.gameState.board, column, playerNum);
  if (!result.success) {
    return { success: false, reason: result.reason };
  }

  room.gameState.moveCount++;
  room.lastActivity = Date.now();

  const winResult = gameLogic.checkWin(room.gameState.board, column, result.row, playerNum);
  let gameOver = false;

  if (winResult.win) {
    room.gameState.winner = playerNum;
    room.gameState.winningCoords = winResult.winningCoords;
    room.status = 'finished';
    timer.stopTurnTimer(room);
    gameOver = true;
  } else if (gameLogic.checkDraw(room.gameState.board)) {
    room.gameState.isDraw = true;
    room.status = 'finished';
    timer.stopTurnTimer(room);
    gameOver = true;
  } else {
    room.gameState.currentPlayer = gameLogic.switchPlayer(playerNum);
  }

  broadcastMove(room, column, result.row, playerNum);

  if (gameOver) {
    scheduleGameEnd(room);
  } else {
    advanceTurn(room);
  }

  return { success: true, gameOver };
}

function broadcastMove(room, column, row, playerNum) {
  const state1 = gameLogic.serializeForClient(room.gameState, room.players[0].id);
  const state2 = gameLogic.serializeForClient(room.gameState, room.players[1].id);
  const spectatorState = gameLogic.serializeForClient(room.gameState, null);

  room.players.forEach((player, i) => {
    if (player.ws && player.ws.readyState === 1) {
      send(player.ws, 'coinDropped', {
        column,
        row,
        player: playerNum,
        board: room.gameState.board
      });
      send(player.ws, 'gameState', i === 0 ? state1 : state2);
    }
  });

  room.spectators.forEach(spectator => {
    if (spectator.ws && spectator.ws.readyState === 1) {
      send(spectator.ws, 'coinDropped', {
        column,
        row,
        player: playerNum,
        board: room.gameState.board
      });
      send(spectator.ws, 'gameState', spectatorState);
    }
  });
}

function scheduleGameEnd(room) {
  setTimeout(() => {
    const stats = generateGameStats(room);
    const elo = computeGameElo(room);

    room.players.forEach((player, i) => {
      if (player.ws && player.ws.readyState === 1) {
        send(player.ws, 'gameEnd', {
          winner: room.gameState.winner,
          winningCoords: room.gameState.winningCoords,
          isDraw: room.gameState.isDraw,
          stats: i === 0 ? stats.player1 : stats.player2,
          elo: elo.rated ? (elo.byPlayerId.get(player.id) || null) : { rated: false }
        });
      }
    });

    room.spectators.forEach(spectator => {
      if (spectator.ws && spectator.ws.readyState === 1) {
        send(spectator.ws, 'gameEnd', {
          winner: room.gameState.winner,
          winningCoords: room.gameState.winningCoords,
          isDraw: room.gameState.isDraw,
          stats: null
        });
      }
    });
  }, 500);
}

// Give the turn to whoever gameState.currentPlayer points at: start the human
// timer, or schedule the AI's move in single-player rooms.
function advanceTurn(room) {
  if (!room.gameState || room.gameState.winner || room.gameState.isDraw) return;
  const current = room.gameState.currentPlayer;

  if (room.isSinglePlayer && current === room.botPlayerNum) {
    scheduleBotMove(room);
  } else {
    timer.startTurnTimer(room, current);
  }
}

// After a short "thinking" pause, compute and play the bot's move.
function scheduleBotMove(room) {
  timer.stopTurnTimer(room);
  const botNum = room.botPlayerNum;
  const delay = 600 + Math.floor(Math.random() * 700);

  setTimeout(() => {
    if (rooms.getRoom(room.id) !== room) return;
    if (room.status !== 'playing') return;
    if (!room.gameState || room.gameState.winner || room.gameState.isDraw) return;
    if (room.gameState.currentPlayer !== botNum) return;

    const human = room.players.find(p => !p.isBot);
    if (human?.ws?.readyState === 1) {
      send(human.ws, 'botThinking', { thinking: true });
    }

    let col = ai.chooseMove(room.gameState.board, botNum, room.difficulty);
    if (col === null || col === undefined) {
      const valid = gameLogic.getValidMoves(room.gameState.board);
      if (valid.length === 0) return;
      col = valid[0];
    }
    applyMove(room, col, botNum);

    if (human?.ws?.readyState === 1) {
      send(human.ws, 'botThinking', { thinking: false });
    }
  }, delay);
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

  // Single-player: no opponent to ask — just restart against the bot.
  if (room.isSinglePlayer) {
    restartGame(room);
    return;
  }

  const opponent = room.players.find(p => p.id !== ws.playerId);
  if (opponent && opponent.ws && opponent.ws.readyState === 1) {
    send(opponent.ws, 'rematchOffered', { fromPlayerId: ws.playerId });
  }
}

function restartGame(room) {
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
    advanceTurn(room);
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
    roomId: room.id,
    gameState,
    timerState,
    playerColor: player.color,
    playerName: player.name,
    opponentName: opponent?.name || 'Opponent',
    opponentColor: opponent?.color || (player.color === 'yellow' ? 'red' : 'yellow'),
    opponentRating: opponent && Number.isFinite(opponent.rating) ? opponent.rating : null
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

const CHAT_MAX_LENGTH = 140;
const CHAT_MIN_INTERVAL_MS = 400;
const CHAT_BURST_LIMIT = 8;
const CHAT_BURST_WINDOW_MS = 10000;

// Resolve who is sending from this socket: a seated player or a spectator.
function identifySender(ws, room) {
  const player = room.players.find(p => p.id === ws.playerId);
  if (player) {
    return { id: player.id, name: player.name, color: player.color, isSpectator: false };
  }
  const spectator = room.spectators.find(s => s.id === ws.spectatorId);
  if (spectator) {
    return { id: spectator.id, name: spectator.name, color: null, isSpectator: true };
  }
  return null;
}

function sanitizeChatText(text) {
  if (typeof text !== 'string') return null;
  const cleaned = text.replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}

function allowChatRate(ws) {
  const now = Date.now();
  if (!ws.chatWindow) ws.chatWindow = [];
  // Drop timestamps outside the burst window.
  ws.chatWindow = ws.chatWindow.filter(t => now - t < CHAT_BURST_WINDOW_MS);
  if (ws.lastChatAt && now - ws.lastChatAt < CHAT_MIN_INTERVAL_MS) return false;
  if (ws.chatWindow.length >= CHAT_BURST_LIMIT) return false;
  ws.lastChatAt = now;
  ws.chatWindow.push(now);
  return true;
}

function handleSendChat(ws, payload) {
  const room = rooms.getRoom(ws.roomId);
  if (!room) return;

  const sender = identifySender(ws, room);
  if (!sender) return;

  const text = sanitizeChatText(payload?.text);
  if (!text) return;

  if (!allowChatRate(ws)) {
    send(ws, 'chatError', { message: 'Slow down — too many messages.' });
    return;
  }

  // isEmote is a short string (the emote itself); tolerate a bare `true` by
  // falling back to the message text.
  let emote = null;
  if (payload.isEmote === true) {
    emote = text;
  } else if (typeof payload.isEmote === 'string' && payload.isEmote.length > 0 && payload.isEmote.length <= 8) {
    emote = payload.isEmote;
  }

  broadcast(room, 'chatMessage', {
    senderId: sender.id,
    senderName: sender.name,
    senderColor: sender.color,
    text,
    isEmote: emote,
    isSpectator: sender.isSpectator,
    timestamp: Date.now()
  });
}

// Standard Elo with K=32. Returns the new ratings for [player1Num, player2Num]
// given their current ratings and the game outcome.
function computeElo(ratingA, ratingB, scoreA) {
  const K = 32;
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;
  const scoreB = 1 - scoreA;
  return {
    ratingA: Math.round(ratingA + K * (scoreA - expectedA)),
    ratingB: Math.round(ratingB + K * (scoreB - expectedB))
  };
}

// Build per-player Elo payloads for a finished multiplayer game. Returns
// { rated: boolean, byPlayerId: Map<playerId, {old, new, delta}> }.
function computeGameElo(room) {
  const humans = room.players.filter(p => !p.isBot);
  if (room.isSinglePlayer || humans.length !== 2) {
    return { rated: false, byPlayerId: new Map() };
  }

  const ratings = humans.map(p => Number.isFinite(p.rating) ? p.rating : 1000);

  // Seat num 1 is always the yellow player; humans[0] should be yellow but
  // resolve by colour so the mapping can never drift.
  const yellowIdx = humans.findIndex(p => p.color === 'yellow');
  const yellowRating = ratings[yellowIdx === -1 ? 0 : yellowIdx];
  const redRating = ratings[yellowIdx === -1 ? 1 : 1 - yellowIdx];

  const scoreYellow = room.gameState.isDraw ? 0.5 : (room.gameState.winner === 1 ? 1 : 0);
  const { ratingA, ratingB } = computeElo(yellowRating, redRating, scoreYellow);

  const byPlayerId = new Map();
  const yellowHuman = humans[yellowIdx === -1 ? 0 : yellowIdx];
  const redHuman = humans[humans.findIndex(p => p.id !== yellowHuman.id)];
  byPlayerId.set(yellowHuman.id, { old: yellowRating, new: ratingA, delta: ratingA - yellowRating });
  byPlayerId.set(redHuman.id, { old: redRating, new: ratingB, delta: ratingB - redRating });

  return { rated: true, byPlayerId };
}

module.exports = {
  send,
  broadcast,
  handleMessage,
  advanceTurn,
  scheduleBotMove
};
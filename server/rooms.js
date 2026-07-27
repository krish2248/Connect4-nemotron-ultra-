const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const gameLogic = require('./gameLogic');
const timer = require('./timer');

const rooms = new Map();
const ROOM_CLEANUP_INTERVAL = 60000;
const ROOM_MAX_INACTIVE = 5 * 60 * 1000;
const MAX_SPECTATORS = 10;

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generateUniqueRoomCode() {
  let code;
  do {
    code = generateRoomCode();
  } while (rooms.has(code));
  return code;
}

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(salt + password).digest('hex');
}

function createRoom(name, password, hostWs, hostName) {
  // The room id IS the shareable 6-char code (uppercase A-Z/2-9).
  const roomId = generateUniqueRoomCode();
  const roomCode = roomId;
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = password ? hashPassword(password, salt) : null;
  const playerId = uuidv4();

  const room = {
    id: roomId,
    code: roomCode,
    name: name || `Room ${roomCode}`,
    passwordHash,
    salt,
    players: [{
      id: playerId,
      name: hostName || 'Player 1',
      color: 'yellow',
      isHost: true,
      ws: hostWs,
      connected: true
    }],
    spectators: [],
    maxPlayers: 2,
    gameState: null,
    status: 'waiting',
    timerState: null,
    createdAt: Date.now(),
    lastActivity: Date.now()
  };

  hostWs.roomId = roomId;
  hostWs.playerId = playerId;
  hostWs.playerColor = 'yellow';

  rooms.set(roomId, room);
  startCleanupInterval();

  return { roomId, roomCode, playerId };
}

const BOT_NAMES = {
  easy: 'Computer (Easy)',
  medium: 'Computer (Medium)',
  hard: 'Computer (Hard)'
};

// Create a single-player room: the human is player 1 (yellow), an AI bot is
// player 2 (red). The bot has no websocket; the server drives its moves.
function createSinglePlayerRoom(playerName, difficulty, hostWs) {
  const roomId = generateUniqueRoomCode();
  const level = BOT_NAMES[difficulty] ? difficulty : 'medium';
  const playerId = uuidv4();

  const room = {
    id: roomId,
    code: roomId,
    name: `Solo vs ${BOT_NAMES[level]}`,
    passwordHash: null,
    salt: null,
    isSinglePlayer: true,
    difficulty: level,
    botPlayerNum: gameLogic.PLAYER2,
    players: [
      {
        id: playerId,
        name: playerName || 'Player 1',
        color: 'yellow',
        isHost: true,
        ws: hostWs,
        connected: true
      },
      {
        id: `bot-${roomId}`,
        name: BOT_NAMES[level],
        color: 'red',
        isHost: false,
        isBot: true,
        ws: null,
        connected: true
      }
    ],
    spectators: [],
    maxPlayers: 2,
    gameState: null,
    status: 'waiting',
    timerState: null,
    createdAt: Date.now(),
    lastActivity: Date.now()
  };

  hostWs.roomId = roomId;
  hostWs.playerId = playerId;
  hostWs.playerColor = 'yellow';

  rooms.set(roomId, room);
  startCleanupInterval();

  return { room, roomId, playerId };
}

function joinRoom(roomId, password, ws, playerName) {
  const room = rooms.get(roomId);
  if (!room) {
    return { error: 'roomNotFound', message: 'Room not found' };
  }

  if (room.status === 'finished') {
    return { error: 'gameFinished', message: 'Game already finished' };
  }

  if (room.players.length >= room.maxPlayers) {
    return { error: 'roomFull', message: 'Room is full' };
  }

  if (room.passwordHash) {
    if (!password) {
      return { error: 'passwordRequired', message: 'Password required' };
    }
    const attemptHash = hashPassword(password, room.salt);
    if (attemptHash !== room.passwordHash) {
      return { error: 'wrongPassword', message: 'Incorrect password' };
    }
  }

  const existingPlayer = room.players.find(p => p.name === playerName && p.connected);
  if (existingPlayer) {
    return { error: 'nameTaken', message: 'Name already taken' };
  }

  const playerId = uuidv4();
  const color = room.players[0].color === 'yellow' ? 'red' : 'yellow';

  const player = {
    id: playerId,
    name: playerName || `Player ${room.players.length + 1}`,
    color,
    isHost: false,
    ws,
    connected: true
  };

  room.players.push(player);
  room.lastActivity = Date.now();

  ws.roomId = roomId;
  ws.playerId = playerId;
  ws.playerColor = color;

  return { room, playerId };
}

function leaveRoom(ws) {
  const room = rooms.get(ws.roomId);
  if (!room) return;

  const player = room.players.find(p => p.id === ws.playerId);
  if (player) {
    player.connected = false;
    player.ws = null;
  }

  const opponent = room.players.find(p => p.id !== ws.playerId);
  if (opponent && opponent.ws && opponent.ws.readyState === 1) {
    const { broadcast } = require('./websocket');
    broadcast(room, 'playerDisconnected', { playerId: ws.playerId });
  }

  room.lastActivity = Date.now();
}

function joinAsSpectator(roomId, ws, spectatorName) {
  const room = rooms.get(roomId);
  if (!room) {
    return { error: 'roomNotFound', message: 'Room not found' };
  }

  if (room.status === 'finished') {
    return { error: 'gameFinished', message: 'Game already finished' };
  }

  if (room.spectators.length >= MAX_SPECTATORS) {
    return { error: 'roomFull', message: 'Spectator limit reached' };
  }

  const existingSpectator = room.spectators.find(s => s.name === spectatorName && s.connected);
  if (existingSpectator) {
    return { error: 'nameTaken', message: 'Name already taken' };
  }

  const spectatorId = uuidv4();
  const spectator = {
    id: spectatorId,
    name: spectatorName || `Spectator ${room.spectators.length + 1}`,
    ws,
    connected: true,
    joinedAt: Date.now()
  };

  room.spectators.push(spectator);
  room.lastActivity = Date.now();

  ws.roomId = roomId;
  ws.spectatorId = spectatorId;
  ws.isSpectator = true;

  const gameState = room.gameState ? gameLogic.serializeForClient(room.gameState, null) : null;

  return { room, spectatorId, gameState, players: room.players.map(p => ({ id: p.id, name: p.name, color: p.color, isHost: p.isHost })) };
}

function leaveSpectator(ws) {
  const room = rooms.get(ws.roomId);
  if (!room) return;

  const spectator = room.spectators.find(s => s.id === ws.spectatorId);
  if (spectator) {
    spectator.connected = false;
    spectator.ws = null;
  }

  room.lastActivity = Date.now();
}

function getRoom(roomId) {
  return rooms.get(roomId);
}

function getRoomByCode(code) {
  for (const room of rooms.values()) {
    if (room.code === code) return room;
  }
  return null;
}

function handleReconnect(ws, roomId, playerId) {
  const room = rooms.get(roomId);
  if (!room) {
    return { error: 'roomNotFound', message: 'Room not found' };
  }

  const player = room.players.find(p => p.id === playerId);
  if (!player) {
    return { error: 'playerNotFound', message: 'Player not found in room' };
  }

  if (player.connected && player.ws && player.ws.readyState === 1) {
    return { error: 'alreadyConnected', message: 'Player already connected' };
  }

  player.ws = ws;
  player.connected = true;
  room.lastActivity = Date.now();

  ws.roomId = roomId;
  ws.playerId = playerId;
  ws.playerColor = player.color;

  const gameState = room.gameState ? gameLogic.serializeForClient(room.gameState, playerId) : null;
  const timerState = timer.getTimerState(room);
  const opponent = room.players.find(p => p.id !== playerId);

  return { room, gameState, timerState, player, opponent };
}

function cleanupInactiveRooms() {
  const now = Date.now();
  for (const [id, room] of rooms.entries()) {
    // Clean up disconnected spectators
    room.spectators = room.spectators.filter(s => s.connected || s.ws?.readyState === 1);

    if (room.players.length === 0 && now - room.lastActivity > ROOM_MAX_INACTIVE) {
      rooms.delete(id);
    } else if (room.status === 'waiting' && now - room.lastActivity > ROOM_MAX_INACTIVE) {
      rooms.delete(id);
    } else if (room.status === 'playing') {
      // Only real (human) players keep a room alive; bots are always "connected".
      const humans = room.players.filter(p => !p.isBot);
      if (humans.length > 0 && humans.every(p => !p.connected) && now - room.lastActivity > ROOM_MAX_INACTIVE) {
        rooms.delete(id);
      }
    }
  }
}

let cleanupInterval = null;
function startCleanupInterval() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(cleanupInactiveRooms, ROOM_CLEANUP_INTERVAL);
}

function stopCleanupInterval() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

module.exports = {
  rooms,
  createRoom,
  createSinglePlayerRoom,
  joinRoom,
  joinAsSpectator,
  leaveRoom,
  leaveSpectator,
  getRoom,
  getRoomByCode,
  handleReconnect,
  cleanupInactiveRooms,
  startCleanupInterval,
  stopCleanupInterval,
  hashPassword,
  generateRoomCode
};
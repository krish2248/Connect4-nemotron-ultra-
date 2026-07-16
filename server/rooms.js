const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const gameLogic = require('./gameLogic');
const timer = require('./timer');

const rooms = new Map();
const ROOM_CLEANUP_INTERVAL = 60000;
const ROOM_MAX_INACTIVE = 5 * 60 * 1000;

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(salt + password).digest('hex');
}

function createRoom(name, password, hostWs, hostName) {
  const roomId = uuidv4();
  const roomCode = generateRoomCode();
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
    if (room.players.length === 0 && now - room.lastActivity > ROOM_MAX_INACTIVE) {
      rooms.delete(id);
    } else if (room.status === 'waiting' && now - room.lastActivity > ROOM_MAX_INACTIVE) {
      rooms.delete(id);
    } else if (room.status === 'playing' && room.players.every(p => !p.connected) && now - room.lastActivity > ROOM_MAX_INACTIVE) {
      rooms.delete(id);
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
  joinRoom,
  leaveRoom,
  getRoom,
  getRoomByCode,
  handleReconnect,
  cleanupInactiveRooms,
  startCleanupInterval,
  stopCleanupInterval,
  hashPassword,
  generateRoomCode
};
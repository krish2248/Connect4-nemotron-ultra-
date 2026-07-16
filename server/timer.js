const TURN_TIME = 30000;
const TICK_INTERVAL = 100;

function startTurnTimer(room, player) {
  stopTurnTimer(room);

  room.timerState = {
    currentPlayer: player,
    timeRemaining: TURN_TIME,
    turnStartTime: Date.now(),
    intervalId: null,
    skippedTurns: room.timerState?.skippedTurns || { 1: 0, 2: 0 }
  };

  room.timerState.intervalId = setInterval(() => {
    tickTimer(room);
  }, TICK_INTERVAL);

  broadcastTimerUpdate(room);
}

function stopTurnTimer(room) {
  if (room.timerState && room.timerState.intervalId) {
    clearInterval(room.timerState.intervalId);
    room.timerState.intervalId = null;
  }
}

function tickTimer(room) {
  if (!room.timerState) return;

  const elapsed = Date.now() - room.timerState.turnStartTime;
  room.timerState.timeRemaining = Math.max(0, TURN_TIME - elapsed);

  if (room.timerState.timeRemaining <= 0) {
    handleTurnTimeout(room);
    return;
  }

  if (elapsed % 1000 < TICK_INTERVAL) {
    broadcastTimerUpdate(room);
  }
}

function handleTurnTimeout(room) {
  stopTurnTimer(room);

  const skippedPlayer = room.timerState.currentPlayer;
  room.timerState.skippedTurns[skippedPlayer] = (room.timerState.skippedTurns[skippedPlayer] || 0) + 1;

  const nextPlayer = skippedPlayer === 1 ? 2 : 1;
  room.gameState.currentPlayer = nextPlayer;

  const { broadcast } = require('./websocket');
  broadcast(room, 'turnSkipped', { player: skippedPlayer, reason: 'timeout' });

  setTimeout(() => {
    if (room.gameState && !room.gameState.winner && !room.gameState.isDraw) {
      startTurnTimer(room, nextPlayer);
    }
  }, 500);
}

function broadcastTimerUpdate(room) {
  if (!room.timerState) return;

  const { broadcast } = require('./websocket');
  broadcast(room, 'turnChanged', {
    currentPlayer: room.timerState.currentPlayer,
    timeRemaining: room.timerState.timeRemaining
  });
}

function getTimerState(room) {
  if (!room.timerState) return null;
  return {
    currentPlayer: room.timerState.currentPlayer,
    timeRemaining: room.timerState.timeRemaining,
    turnStartTime: room.timerState.turnStartTime,
    skippedTurns: room.timerState.skippedTurns
  };
}

function setTimerState(room, state) {
  room.timerState = state;
  if (state.intervalId) {
    room.timerState.intervalId = setInterval(() => tickTimer(room), TICK_INTERVAL);
  }
}

function getTimeRemaining(room) {
  if (!room.timerState) return TURN_TIME;
  return room.timerState.timeRemaining;
}

module.exports = {
  TURN_TIME,
  startTurnTimer,
  stopTurnTimer,
  tickTimer,
  handleTurnTimeout,
  broadcastTimerUpdate,
  getTimerState,
  setTimerState,
  getTimeRemaining
};
import { GameSocket } from './websocket.js';
import { Board } from './board.js';
import { TimerRing } from './timer.js';
import { UI } from './ui.js';
import { Stats, Achievements } from './stats.js';
import { Reconnect } from './reconnect.js';
import { AudioManager } from './audio.js';

const App = {
  state: 'landing',
  ws: null,
  roomId: null,
  roomCode: null,
  playerId: null,
  playerColor: null,
  playerName: '',
  isHost: false,
  gameState: null,
  timerState: null,
  myTurn: false,
  board: null,
  timer: null,
  ui: null,
  stats: null,
  achievements: null,
  audio: null,
  reconnecting: false,
  selectedColumn: null,
  moveStartTime: 0,
  nearWinsTracked: { 1: 0, 2: 0 },
  timeoutsThisGame: { 1: 0, 2: 0 },
  blockedMovesThisGame: { 1: 0, 2: 0 },

  async init() {
    this.ui = new UI();
    this.audio = new AudioManager();
    this.stats = new Stats();
    this.achievements = new Achievements(this.stats);
    this.ws = new GameSocket(this.handleMessage.bind(this));
    await this.ws.connect();
    this.setupEventListeners();
    await this.checkReconnect();
    this.render();
  },

  setupEventListeners() {
    document.addEventListener('keydown', (e) => this.handleKeydown(e));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.state === 'playing') {
        this.ws.send('requestState', { roomId: this.roomId });
      }
    });
  },

  async checkReconnect() {
    const session = Reconnect.getSession();
    if (session && Date.now() - session.timestamp < 24 * 60 * 60 * 1000) {
      this.reconnecting = true;
      this.ui.showReconnecting(true);
      this.ws.send('requestReconnect', { roomId: session.roomId, playerId: session.playerId });
      setTimeout(() => {
        if (this.reconnecting) {
          this.reconnecting = false;
          this.ui.showReconnecting(false);
          Reconnect.clearSession();
          this.showToast('Reconnection failed', 'error');
        }
      }, 10000);
    }
  },

  handleMessage(message) {
    const { type, payload } = message;

    switch (type) {
      case 'roomCreated':
        this.handleRoomCreated(payload);
        break;
      case 'roomJoined':
        this.handleRoomJoined(payload);
        break;
      case 'roomError':
        this.handleRoomError(payload);
        break;
      case 'gameStart':
        this.handleGameStart(payload);
        break;
      case 'coinDropped':
        this.handleCoinDropped(payload);
        break;
      case 'gameState':
        this.handleGameState(payload);
        break;
      case 'turnChanged':
        this.handleTurnChanged(payload);
        break;
      case 'turnSkipped':
        this.handleTurnSkipped(payload);
        break;
      case 'gameEnd':
        this.handleGameEnd(payload);
        break;
      case 'playerDisconnected':
        this.handlePlayerDisconnected(payload);
        break;
      case 'playerReconnected':
        this.handlePlayerReconnected(payload);
        break;
      case 'rematchOffered':
        this.handleRematchOffered(payload);
        break;
      case 'rematchAccepted':
        this.handleRematchAccepted(payload);
        break;
      case 'stateSync':
        this.handleStateSync(payload);
        break;
      case 'coinError':
        this.handleCoinError(payload);
        break;
    }
  },

  handleRoomCreated(payload) {
    this.roomId = payload.roomId;
    this.playerId = payload.playerId;
    this.playerColor = payload.playerColor;
    this.isHost = payload.isHost;
    Reconnect.saveSession(this.roomId, this.playerId);
    this.state = 'waiting';
    this.render();
  },

  handleRoomJoined(payload) {
    this.roomId = payload.roomId;
    this.playerId = payload.playerId;
    this.playerColor = payload.playerColor;
    this.isHost = payload.players.find(p => p.id === this.playerId)?.isHost || false;
    Reconnect.saveSession(this.roomId, this.playerId);
    if (payload.gameState) {
      this.gameState = payload.gameState;
      this.state = 'playing';
    } else {
      this.state = 'waiting';
    }
    this.render();
  },

  handleRoomError(payload) {
    this.showToast(payload.message, 'error');
    if (payload.code === 'roomNotFound' || payload.code === 'roomFinished') {
      this.state = 'landing';
      this.render();
    }
  },

  handleGameStart(payload) {
    this.gameState = payload.gameState;
    this.state = 'playing';
    this.reconnecting = false;
    this.ui.showReconnecting(false);
    this.stats.startGame();
    this.render();
    if (payload.countdown) {
      this.ui.showCountdown(payload.countdown, () => {
        this.moveStartTime = Date.now();
      });
    } else {
      this.moveStartTime = Date.now();
    }
  },

  handleCoinDropped(payload) {
    const { column, row, player } = payload;
    const isMyMove = player === (this.playerColor === 'yellow' ? 1 : 2);
    const playerColor = player === 1 ? 'yellow' : 'red';
    const targetY = row * (this.getSlotSize() + this.getGap());

    if (this.board) {
      this.board.dropCoin(column, playerColor, targetY, isMyMove).then(() => {
        this.audio.playCoinDrop();
      });
    }

    if (isMyMove) {
      const moveTime = Date.now() - this.moveStartTime;
      this.stats.recordMove(this.playerColor === 'yellow' ? 1 : 2, moveTime);
      this.moveStartTime = 0;
    }
  },

  handleGameState(payload) {
    this.gameState = payload;
    this.myTurn = this.gameState.currentPlayer === (this.playerColor === 'yellow' ? 1 : 2);

    if (this.board && payload.board) {
      this.board.syncState(payload.board);
    }

    if (this.timer) {
      this.timer.setTime(this.timerState?.timeRemaining || 30);
    }

    if (this.myTurn && !this.moveStartTime) {
      this.moveStartTime = Date.now();
    }
  },

  handleTurnChanged(payload) {
    this.timerState = payload;
    this.myTurn = payload.currentPlayer === (this.playerColor === 'yellow' ? 1 : 2);

    if (this.timer) {
      this.timer.setTime(payload.timeRemaining);
      this.timer.setActive(this.myTurn);
    }

    if (this.myTurn) {
      this.moveStartTime = Date.now();
      this.audio.playButton();
    }
  },

  handleTurnSkipped(payload) {
    this.timeoutsThisGame[payload.player] = (this.timeoutsThisGame[payload.player] || 0) + 1;
    this.stats.recordTimeout(payload.player);
    this.showToast("Time's up! Turn skipped.", 'warning');
    this.audio.playTimeout();
  },

  handleGameEnd(payload) {
    const { winner, winningCoords, isDraw, stats } = payload;
    this.state = 'gameover';

    const myPlayerNum = this.playerColor === 'yellow' ? 1 : 2;

    if (winner) {
      const winnerColor = winner === 1 ? 'yellow' : 'red';
      const isWinner = winnerColor === this.playerColor;
      this.audio.playWin();
      this.stats.endGame(isWinner ? 'win' : 'loss', this.playerColor);
      this.ui.showWinBanner(
        isDraw ? 'Draw!' : (isWinner ? 'You Win!' : 'You Lose!'),
        winningCoords,
        isDraw
      );
      if (winningCoords && this.board) {
        this.board.highlightWinning(winningCoords);
      }
    } else {
      this.stats.endGame('draw', this.playerColor);
      this.audio.playDraw();
      this.ui.showWinBanner('Draw!', null, true);
    }

    setTimeout(() => {
      this.showGameOverStats(payload.stats);
    }, 2000);
  },

  handlePlayerDisconnected(payload) {
    this.showToast('Opponent disconnected', 'warning');
  },

  handlePlayerReconnected(payload) {
    this.showToast('Opponent reconnected', 'success');
  },

  handleRematchOffered(payload) {
    this.ui.showModal('Rematch Requested', 'Your opponent wants a rematch!', [
      { label: 'Accept', class: 'btn-primary', handler: () => this.acceptRematch() },
      { label: 'Decline', class: 'btn-secondary', handler: () => this.declineRematch() }
    ]);
  },

  handleRematchAccepted(payload) {
    this.gameState = payload.gameState;
    this.state = 'playing';
    if (this.board) this.board.reset();
    this.render();
    this.ui.closeAllModals();
  },

  handleStateSync(payload) {
    this.gameState = payload.gameState;
    this.timerState = payload.timerState;
    this.playerColor = payload.playerColor;
    this.reconnecting = false;
    this.ui.showReconnecting(false);

    if (this.gameState) {
      this.state = 'playing';
      this.myTurn = this.gameState.currentPlayer === (this.playerColor === 'yellow' ? 1 : 2);
      this.render();
      if (this.board && this.gameState.board) {
        this.board.syncState(this.gameState.board);
      }
      if (this.timer && this.timerState) {
        this.timer.setTime(this.timerState.timeRemaining);
        this.timer.setActive(this.myTurn);
      }
    } else {
      this.state = 'waiting';
      this.render();
    }
  },

  handleCoinError(payload) {
    if (payload.reason === 'columnFull' && this.board) {
      this.board.shakeColumn(payload.column);
      this.audio.playError();
    } else if (payload.reason === 'notYourTurn') {
      this.showToast('Not your turn!', 'warning');
    }
  },

  acceptRematch() {
    this.ws.send('requestRematch', { roomId: this.roomId });
    this.ui.closeAllModals();
  },

  declineRematch() {
    this.ui.closeAllModals();
  },

  showGameOverStats(serverStats) {
    const gameSummary = this.stats.getSessionSummary();
    const persistentStats = this.stats.getPersistentStats();
    const sessionStats = this.stats.getSessionStats();
    const achievements = this.achievements.getAll();

    const newUnlocks = this.achievements.checkUnlocks(gameSummary, sessionStats, persistentStats);
    newUnlocks.forEach(a => this.ui.showAchievementToast(a));

    const content = `
      <div style="margin-bottom: 24px;">
        <h3 style="margin-bottom: 12px; color: var(--yellow);">This Game</h3>
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-value">${this.formatTime(gameSummary.duration)}</div><div class="stat-label">Match Duration</div></div>
          <div class="stat-card"><div class="stat-value">${gameSummary.myMoves}</div><div class="stat-label">Your Moves</div></div>
          <div class="stat-card"><div class="stat-value">${gameSummary.oppMoves}</div><div class="stat-label">Opponent Moves</div></div>
          <div class="stat-card"><div class="stat-value">${gameSummary.myTimeouts}</div><div class="stat-label">Your Timeouts</div></div>
          <div class="stat-card"><div class="stat-value">${gameSummary.oppTimeouts}</div><div class="stat-label">Opp Timeouts</div></div>
          <div class="stat-card"><div class="stat-value">${gameSummary.myAvgMoveTime ? Math.round(gameSummary.myAvgMoveTime / 1000) + 's' : '-'}</div><div class="stat-label">Avg Think Time</div></div>
        </div>
      </div>
      
      <div style="margin-bottom: 24px;">
        <h3 style="margin-bottom: 12px; color: var(--yellow);">All Time</h3>
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-value">${persistentStats.totalGames}</div><div class="stat-label">Total Games</div></div>
          <div class="stat-card"><div class="stat-value">${persistentStats.totalWins}</div><div class="stat-label">Total Wins</div></div>
          <div class="stat-card"><div class="stat-value">${persistentStats.totalLosses}</div><div class="stat-label">Total Losses</div></div>
          <div class="stat-card"><div class="stat-value">${persistentStats.totalDraws}</div><div class="stat-label">Total Draws</div></div>
          <div class="stat-card"><div class="stat-value">${persistentStats.bestStreak}</div><div class="stat-label">Best Streak</div></div>
        </div>
      </div>

      <div>
        <h3 style="margin-bottom: 12px; color: var(--yellow);">Achievements</h3>
        <div class="achievements-grid" id="achievements-grid">
          ${achievements.map(a => `
            <div class="achievement-card ${a.unlocked ? 'unlocked' : 'locked'}">
              <span class="achievement-icon">${a.icon}</span>
              <div class="achievement-name">${a.name}</div>
              <div class="achievement-desc">${a.desc}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.ui.showModal('Stats & Achievements', content, [
      { label: 'Close', class: 'btn-secondary', handler: () => {} }
    ]);
  },

  formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  },

  handleKeydown(e) {
    if (this.state !== 'playing' || !this.myTurn) return;

    const col = parseInt(e.key);
    if (col >= 1 && col <= 7) {
      this.dropCoin(col - 1);
    }
  },

  dropCoin(column) {
    if (!this.myTurn || this.board?.isAnimating) return;
    this.ws.send('dropCoin', { column });
  },

  onColumnClick(column) {
    if (this.state === 'playing' && this.myTurn) {
      this.dropCoin(column);
    }
  },

  onColumnHover(column) {
    if (this.state === 'playing' && this.myTurn && this.board) {
      this.board.showPreview(column, this.playerColor);
    }
  },

  onColumnLeave() {
    if (this.board) this.board.hidePreview();
  },

  getSlotSize() {
    return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--slot-size')) || 64;
  },

  getGap() {
    return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 8;
  },

  showToast(message, type = 'info') {
    this.ui.showToast(message, type);
  },

  render() {
    const app = document.getElementById('app');
    app.innerHTML = '';

    switch (this.state) {
      case 'landing':
        app.appendChild(this.createLandingScreen());
        break;
      case 'waiting':
        app.appendChild(this.createWaitingScreen());
        break;
      case 'playing':
        app.appendChild(this.createGameScreen());
        break;
      case 'gameover':
        break;
    }
  },

  createLandingScreen() {
    const screen = document.createElement('div');
    screen.className = 'screen active';
    screen.innerHTML = `
      <div class="card" style="max-width: 420px; width: 100%;">
        <h1>Connect 4</h1>
        <p class="subtitle">Real-time 2-player online game</p>
        
        <div class="divider">Create Server</div>
        
        <div class="form-group">
          <label for="create-name">Server Name</label>
          <input type="text" id="create-name" placeholder="My Server" maxlength="30">
        </div>
        <div class="form-group">
          <label for="create-password">Password (optional)</label>
          <input type="password" id="create-password" placeholder="Leave empty for public" maxlength="20">
        </div>
        <div class="form-group">
          <label for="create-player-name">Your Name</label>
          <input type="text" id="create-player-name" placeholder="Player 1" maxlength="16" required>
        </div>
        <button class="btn btn-primary" id="btn-create-room">Create Server</button>
        
        <div class="divider">Join Server</div>
        
        <div class="form-group">
          <label for="join-room-id">Room Code</label>
          <input type="text" id="join-room-id" placeholder="ABC123" maxlength="6" style="text-transform: uppercase;">
        </div>
        <div class="form-group">
          <label for="join-password">Password</label>
          <input type="password" id="join-password" placeholder="If required" maxlength="20">
        </div>
        <div class="form-group">
          <label for="join-player-name">Your Name</label>
          <input type="text" id="join-player-name" placeholder="Player 2" maxlength="16" required>
        </div>
        <button class="btn btn-secondary" id="btn-join-room">Join Server</button>
      </div>
    `;

    setTimeout(() => {
      const createName = screen.querySelector('#create-name');
      const createPassword = screen.querySelector('#create-password');
      const createPlayerName = screen.querySelector('#create-player-name');
      const btnCreate = screen.querySelector('#btn-create-room');

      const joinRoomId = screen.querySelector('#join-room-id');
      const joinPassword = screen.querySelector('#join-password');
      const joinPlayerName = screen.querySelector('#join-player-name');
      const btnJoin = screen.querySelector('#btn-join-room');

      btnCreate.addEventListener('click', () => {
        this.createRoom(createName.value, createPassword.value, createPlayerName.value);
      });

      btnJoin.addEventListener('click', () => {
        this.joinRoom(joinRoomId.value.toUpperCase(), joinPassword.value, joinPlayerName.value);
      });

      [createName, createPassword, createPlayerName].forEach(el => {
        el.addEventListener('keypress', (e) => { if (e.key === 'Enter') btnCreate.click(); });
      });

      [joinRoomId, joinPassword, joinPlayerName].forEach(el => {
        el.addEventListener('keypress', (e) => { if (e.key === 'Enter') btnJoin.click(); });
      });

      createPlayerName.focus();
    }, 0);

    return screen;
  },

  createWaitingScreen() {
    const screen = document.createElement('div');
    screen.className = 'screen active waiting-screen';
    screen.innerHTML = `
      <div class="card" style="max-width: 420px; width: 100%; text-align: center;">
        <h1>Waiting for Opponent</h1>
        <p class="subtitle">Share the room code with a friend</p>
        
        <div class="room-code" id="waiting-room-code">${this.roomId}</div>
        
        <div class="players-list" style="margin-top: 24px;">
          <div class="player-waiting you">
            <span class="player-avatar ${this.playerColor}"></span>
            <span id="waiting-player-name">${this.playerName}</span>
            <span class="connected">You</span>
          </div>
          <div id="waiting-opponent">Waiting for opponent...</div>
        </div>
        
        <button class="btn btn-secondary" id="btn-copy-code" style="margin-top: 24px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy Room Code
        </button>
        
        <button class="btn btn-ghost" id="btn-leave-waiting" style="margin-top: 12px;">Leave</button>
      </div>
    `;

    setTimeout(() => {
      const btnCopy = screen.querySelector('#btn-copy-code');
      const btnLeave = screen.querySelector('#btn-leave-waiting');

      btnCopy.addEventListener('click', async () => {
        await navigator.clipboard.writeText(this.roomId);
        this.showToast('Room code copied!', 'success');
      });

      btnLeave.addEventListener('click', () => {
        this.disconnect();
      });
    }, 0);

    return screen;
  },

  createGameScreen() {
    const screen = document.createElement('div');
    screen.className = 'screen active board-screen';
    screen.innerHTML = `
      <div class="board-header">
        <div class="room-info">
          <span class="room-name">Connect 4</span>
          <span class="room-code" id="game-room-code">${this.roomId}</span>
        </div>
      </div>
      
      <div class="board-wrapper">
        <div id="board-frame" class="board-frame"></div>
      </div>
      
      <div class="game-header" style="display: flex; justify-content: space-between; width: 100%; max-width: 500px; margin-top: 12px;">
        <div class="player-panel" id="player1-panel">
          <div class="player-avatar yellow"></div>
          <div class="player-info">
            <div class="player-name" id="player1-name">Player 1</div>
          </div>
          <div class="timer-ring-container" id="timer1-ring"></div>
        </div>
        <div class="player-panel" id="player2-panel">
          <div class="player-avatar red"></div>
          <div class="player-info">
            <div class="player-name" id="player2-name">Player 2</div>
          </div>
          <div class="timer-ring-container" id="timer2-ring"></div>
        </div>
      </div>
      
      <div class="game-actions" style="margin-top: 16px;">
        <button class="btn btn-secondary stats-btn" id="btn-stats">Stats & Achievements</button>
        <button class="btn btn-ghost" id="btn-leave-game">Leave Game</button>
      </div>
    `;

    setTimeout(() => {
      const boardEl = screen.querySelector('#board-frame');
      if (boardEl && !this.board) {
        this.board = new Board(boardEl, (col) => this.dropCoin(col));
      } else if (this.board) {
        this.board.render();
      }

      const timer1El = screen.querySelector('#timer1-ring');
      const timer2El = screen.querySelector('#timer2-ring');
      if (timer1El && !this.timer) {
        this.timer = new TimerRing(timer1El);
      }

      if (this.gameState && this.timer) {
        this.timer.start(this.timerState?.timeRemaining || 30);
        this.timer.setActive(this.myTurn);
      }

      this.updatePlayerPanels();

      const btnStats = screen.querySelector('#btn-stats');
      const btnLeave = screen.querySelector('#btn-leave-game');

      btnStats.addEventListener('click', () => this.showStatsModal());
      btnLeave.addEventListener('click', () => this.disconnect());
    }, 0);

    return screen;
  },

  updatePlayerPanels() {
    const isYellow = this.playerColor === 'yellow';
    const p1 = document.getElementById('player1-panel');
    const p2 = document.getElementById('player2-panel');
    const n1 = document.getElementById('player1-name');
    const n2 = document.getElementById('player2-name');

    if (p1 && p2 && n1 && n2) {
      n1.textContent = isYellow ? `${this.playerName} (You)` : 'Opponent';
      n2.textContent = !isYellow ? `${this.playerName} (You)` : 'Opponent';

      p1.classList.toggle('active', this.myTurn && isYellow);
      p2.classList.toggle('active', this.myTurn && !isYellow);
    }
  },

  showStatsModal() {
    const persistent = this.stats.getPersistentStats();
    const session = this.stats.getSessionStats();
    const achievements = this.achievements.getAll();

    const content = `
      <div style="margin-bottom: 24px;">
        <h3 style="margin-bottom: 12px; color: var(--yellow);">Session Stats</h3>
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-value">${session.games}</div><div class="stat-label">Games</div></div>
          <div class="stat-card"><div class="stat-value">${session.wins}</div><div class="stat-label">Wins</div></div>
          <div class="stat-card"><div class="stat-value">${session.losses}</div><div class="stat-label">Losses</div></div>
          <div class="stat-card"><div class="stat-value">${session.draws}</div><div class="stat-label">Draws</div></div>
          <div class="stat-card"><div class="stat-value">${session.streak}</div><div class="stat-label">Streak</div></div>
        </div>
      </div>
      
      <div style="margin-bottom: 24px;">
        <h3 style="margin-bottom: 12px; color: var(--yellow);">All Time</h3>
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-value">${persistent.totalGames}</div><div class="stat-label">Total Games</div></div>
          <div class="stat-card"><div class="stat-value">${persistent.totalWins}</div><div class="stat-label">Total Wins</div></div>
          <div class="stat-card"><div class="stat-value">${persistent.totalLosses}</div><div class="stat-label">Total Losses</div></div>
          <div class="stat-card"><div class="stat-value">${persistent.totalDraws}</div><div class="stat-label">Total Draws</div></div>
          <div class="stat-card"><div class="stat-value">${persistent.bestStreak}</div><div class="stat-label">Best Streak</div></div>
        </div>
      </div>

      <div>
        <h3 style="margin-bottom: 12px; color: var(--yellow);">Achievements</h3>
        <div class="achievements-grid" id="achievements-grid">
          ${achievements.map(a => `
            <div class="achievement-card ${a.unlocked ? 'unlocked' : 'locked'}">
              <span class="achievement-icon">${a.icon}</span>
              <div class="achievement-name">${a.name}</div>
              <div class="achievement-desc">${a.desc}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.ui.showModal('Stats & Achievements', content, [
      { label: 'Close', class: 'btn-secondary', handler: () => {} }
    ]);
  },

  createRoom(name, password, playerName) {
    this.playerName = playerName || 'Player 1';
    this.ws.send('createRoom', { name, password, playerName: this.playerName });
  },

  joinRoom(roomId, password, playerName) {
    this.playerName = playerName || 'Player 2';
    this.ws.send('joinRoom', { roomId, password, playerName: this.playerName });
  },

  disconnect() {
    if (this.ws) this.ws.close();
    this.state = 'landing';
    this.roomId = null;
    this.playerId = null;
    this.gameState = null;
    this.timerState = null;
    Reconnect.clearSession();
    this.render();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
export { App };
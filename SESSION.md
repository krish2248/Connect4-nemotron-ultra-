# Connect 4 - Session Context

## Project Status: **COMPLETE & RUNNING**

## What Was Built
A real-time 2-player online Connect 4 game with:
- Node.js + `ws` WebSocket server (single port, serves static files)
- Vanilla HTML/CSS/JS frontend (no frameworks)
- Deployed to Render.com ready

---

## Architecture

### Server (`/server`)
| File | Purpose |
|------|---------|
| `server.js` | HTTP + WS server, static file serving from `/client` |
| `rooms.js` | Room management, SHA-256 password hashing, 5-min auto-cleanup |
| `gameLogic.js` | Authoritative 7×6 board, win/draw detection (4 directions) |
| `timer.js` | 30s server-authoritative turn timer, timeout = skip turn |
| `websocket.js` | C2S/S2C message routing protocol |

### Client (`/client`)
| File | Purpose |
|------|---------|
| `index.html` | Single entry point, loads 4 CSS + 9 JS modules |
| `css/main.css` | Design system (dark premium theme, CSS variables) |
| `css/board.css` | Board frame, slots, 60fps GPU coin animations |
| `css/ui.css` | Screens, modals, timer ring, stats, achievements |
| `css/animations.css` | Keyframes (drop, bounce, glow, confetti, banner) |
| `js/main.js` | App state, routing, WS handlers, screen rendering |
| `js/websocket.js` | WS client wrapper (reconnect, queue, heartbeat) |
| `js/board.js` | 60fps coin drops (gravity + bounce), hover preview |
| `js/timer.js` | SVG circular progress ring |
| `js/ui.js` | Toasts, modals, win banner, canvas confetti |
| `js/stats.js` | localStorage stats + 8 achievements |
| `js/gameLogic.js` | Client preview only (drop row, valid moves) |
| `js/reconnect.js` | Session restore from localStorage |
| `js/audio.js` | Web Audio API (coin drop, win, timeout, button) |

---

## Features Implemented
- ✅ Real-time 2-player via WebSocket
- ✅ Human-readable 6-char room codes
- ✅ Password-protected rooms (SHA-256 + salt)
- ✅ 30s turn timer (server-authoritative, synced to both clients)
- ✅ 60fps GPU-accelerated coin drops with bounce
- ✅ Win detection (horizontal, vertical, both diagonals) + draw
- ✅ Win animations: coin glow pulse, canvas confetti burst, banner scale/fade-in
- ✅ Stats tracking (session + persistent): games, wins, losses, draws, streak
- ✅ 8 Achievements with unlock toasts: Speed Demon, Comeback Kid, Perfect Game, Clutch, Marathon, First Blood, Untouchable, Time Waster
- ✅ Reconnection: refresh/brief disconnect restores game state
- ✅ Rematch system (play again in same room)
- ✅ Keyboard (1-7) + mouse/touch support
- ✅ Elegant Web Audio API sounds (coin drop, win arpeggio, timeout beep, button click)
- ✅ Responsive dark premium theme
- ✅ Respects `prefers-reduced-motion`

---

## WebSocket Protocol

### Client → Server
```
createRoom: { name, password, playerName }
joinRoom: { roomId, password, playerName }
dropCoin: { column }
requestRematch: { roomId }
requestReconnect: { roomId, playerId }
requestState: { roomId }
```

### Server → Client
```
roomCreated: { roomId, roomName, playerId, playerColor, isHost }
roomJoined: { roomId, roomName, players, playerId, playerColor, gameState }
roomError: { code, message }
gameStart: { gameState, countdown: 3 }
coinDropped: { column, row, player, board }
gameState: { board, currentPlayer, winner, winningCoords, isDraw, moveCount }
turnChanged: { currentPlayer, timeRemaining }
turnSkipped: { player, reason: 'timeout' }
gameEnd: { winner, winningCoords, isDraw, stats }
playerDisconnected: { playerId }
playerReconnected: { playerId }
rematchOffered: { fromPlayerId }
rematchAccepted: { gameState }
stateSync: { gameState, timerState }
```

---

## How to Run Locally
```bash
cd server
npm install
npm run dev    # with --watch auto-reload
# or
npm start      # production
```
Open http://localhost:3000 in two tabs to test.

---

## Deploy to Render.com (Live URL)

### 1. Push to GitHub
```bash
# Create repo at github.com/new named "connect4" (no README/license)
git remote set-url origin https://github.com/YOUR_USERNAME/connect4.git
git push -u origin master
```

### 2. Deploy on Render
1. Go to https://render.com → "New +" → "Web Service"
2. Connect GitHub → select `connect4` repo
3. Configure:
   - **Name**: `connect4`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Click "Create Web Service"

Render provides HTTPS URL (e.g., `https://connect4-xxxx.onrender.com`)

### 3. Test Multi-device
Open Render URL on desktop + phone. Create room on one, join on other.

---

## Current State
- **Server**: Running on `http://localhost:3000`
- **Git**: Committed (23 files), ready to push
- **All features**: Working end-to-end

---

## Next Steps (if continuing)
1. Push to GitHub (replace `YOUR_USERNAME`)
2. Deploy to Render
3. Test multi-device
4. Optional: Add spectator mode, chat, or AI opponent

---

*Session completed: All tasks done. Game is fully functional and deployable.*
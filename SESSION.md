# Connect 4 - Session Context

## Project Overview
Real-time 2-player online Connect 4 game with WebSocket server (Node.js + ws) and static frontend.

## Architecture
- **Server** (`/server`): Node.js HTTP + WebSocket server on single port (3000)
- **Client** (`/client`): Vanilla HTML/CSS/JS (no framework)
- **Deployment**: Render.com (free tier, auto-HTTPS)

## Completed Files

### Server
- `server/package.json` - ws ^8.17.0, uuid ^9.0.0
- `server/server.js` - HTTP + WS server, static file serving from `/client`
- `server/rooms.js` - Room management, SHA-256 password hashing, 5-min cleanup, 6-char human-readable codes
- `server/gameLogic.js` - Authoritative 7x6 board, win detection (4 dirs), draw detection
- `server/timer.js` - 30s turn timer, server-authoritative, timeout skip (not game over)
- `server/websocket.js` - Message routing (C2S/S2C protocol)

### Client
- `client/index.html` - Single entry point
- `client/css/main.css` - Design system (dark premium theme, CSS variables)
- `client/css/board.css` - Board frame, slots, 60fps GPU coin animations (gravity + bounce)
- `client/css/ui.css` - Screens, modals, timer ring, stats, achievements
- `client/css/animations.css` - Keyframes
- `client/js/main.js` - App state, routing, WS handlers, dynamic screen rendering
- `client/js/websocket.js` - WS client (auto-reconnect, queue, heartbeat)
- `client/js/board.js` - Board rendering, 60fps coin drops, hover preview
- `client/js/timer.js` - SVG circular progress ring
- `client/js/ui.js` - Toasts, modals, win banner, canvas confetti
- `client/js/stats.js` - localStorage stats + 8 achievements
- `client/js/gameLogic.js` - Client preview only (drop row, valid moves)
- `client/js/reconnect.js` - Session restore from localStorage
- `client/js/audio.js` - Web Audio API (coin drop, win, timeout, button)

## Features Implemented
- Real-time 2-player via WebSocket
- Room codes (6-char human-readable)
- Password-protected rooms (SHA-256 + salt)
- 30s turn timer (server-authoritative, synced)
- Coin drop animation (gravity ease-in + bounce, 60fps GPU)
- Win detection (horizontal, vertical, both diagonals) + draw
- Win animations (coin glow, confetti burst, banner entrance)
- Stats tracking + 8 achievements (persisted in localStorage)
- Reconnection handling (refresh/brief disconnect restores game)
- Rematch system (play again in same room)
- Keyboard (1-7) + mouse/touch support
- Elegant sound effects (Web Audio API)
- Responsive dark theme
- Respects `prefers-reduced-motion`

## WebSocket Protocol

### Client → Server
| Type | Payload |
|------|---------|
| `createRoom` | `{ name, password, playerName }` |
| `joinRoom` | `{ roomId, password, playerName }` |
| `dropCoin` | `{ column }` |
| `requestRematch` | `{ roomId }` |
| `requestReconnect` | `{ roomId, playerId }` |
| `requestState` | `{ roomId }` |

### Server → Client
| Type | Payload |
|------|---------|
| `roomCreated` | `{ roomId, roomName, playerId, playerColor, isHost }` |
| `roomJoined` | `{ roomId, roomName, players, playerId, playerColor, gameState }` |
| `roomError` | `{ code, message }` |
| `gameStart` | `{ gameState, countdown: 3 }` |
| `coinDropped` | `{ column, row, player, board }` |
| `gameState` | `{ board, currentPlayer, winner, winningCoords, isDraw, moveCount }` |
| `turnChanged` | `{ currentPlayer, timeRemaining }` |
| `turnSkipped` | `{ player, reason: 'timeout' }` |
| `gameEnd` | `{ winner, winningCoords, isDraw, stats }` |
| `playerDisconnected` | `{ playerId }` |
| `playerReconnected` | `{ playerId }` |
| `rematchOffered` | `{ fromPlayerId }` |
| `rematchAccepted` | `{ gameState }` |
| `stateSync` | `{ gameState, timerState }` |

## Achievements
1. **Speed Demon** - Win averaging <5s/move
2. **Comeback Kid** - Win after 3-in-row disadvantage
3. **Perfect Game** - Win without any blocked moves
4. **Clutch** - Win with <3s on timer
5. **Marathon** - Game reaches 42nd move
6. **First Blood** - Win first game ever
7. **Untouchable** - Win 3 games in a row
8. **Time Waster** - Win with 2+ timeouts

## Next Steps (To Deploy)

### 1. Create GitHub Repository
```bash
# Go to https://github.com/new and create repo named "connect4"
# Do NOT initialize with README, .gitignore, or license
```

### 2. Push to GitHub
```bash
git remote set-url origin https://github.com/YOUR_USERNAME/connect4.git
git push -u origin master
```

### 3. Deploy to Render.com
1. Go to https://render.com → New + → Web Service
2. Connect GitHub, select `connect4` repo
3. Configure:
   - Name: `connect4`
   - Region: closest to you
   - Branch: `master`
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Create Web Service

Render provides HTTPS URL (e.g., `https://connect4-xxxx.onrender.com`)

### 4. Test Multi-device
Open Render URL on desktop + phone. Create room on one, join on other.

## Local Development
```bash
cd server
npm install
npm run dev  # auto-reload on changes
# Open http://localhost:3000
```

## Key Design Decisions
- Single Node.js server (HTTP + WS on same port)
- SHA-256 password hashing (Node crypto, zero deps)
- Room cleanup: 5 min inactivity for empty/waiting rooms
- Server-authoritative game logic + timer (prevents cheating)
- 60fps coin drops: CSS `transform: translate3d()` + `will-change: transform`
- Confetti: Canvas particles (100 particles, physics-based)
- Sound: Web Audio API (sine/square oscillators, no audio files)
- Screens dynamically rendered by main.js (no static HTML screens)
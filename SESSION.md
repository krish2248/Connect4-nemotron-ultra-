# Connect 4 - Session Context

## Project Status: **LIVE ON RENDER** ✅

**Live URL**: https://connect4-nemotron-ultra.onrender.com

---

## What Was Built
A real-time 2-player online Connect 4 game with:
- Node.js + `ws` WebSocket server (single port, serves static files)
- Vanilla HTML/CSS/JS frontend (no frameworks)
- Deployed to Render.com (free tier, auto-HTTPS)

---

## Architecture

### Server (`/server`)
| File | Purpose |
|------|---------|
| `server.js` | HTTP + WS server, static file serving from `/client` |
| `rooms.js` | Room management, SHA-256 password hashing, 5-min auto-cleanup, single-player bot rooms |
| `gameLogic.js` | Authoritative 7×6 board, win/draw detection (4 directions) |
| `timer.js` | 30s server-authoritative turn timer, timeout = skip turn |
| `websocket.js` | C2S/S2C message routing, `applyMove`/`advanceTurn` turn engine, AI move scheduling |
| `ai.js` | Single-player AI: minimax + alpha-beta, difficulty-based depth, immediate win/block |

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
- ✅ **Single-player vs AI** (Easy / Medium / Hard) — server-side minimax opponent
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
createSinglePlayer: { playerName, difficulty }   # difficulty: easy|medium|hard
joinRoom: { roomId, password, playerName }
dropCoin: { column }
requestRematch: { roomId }
requestReconnect: { roomId, playerId }
requestState: { roomId }
```

### Server → Client
```
roomCreated: { roomId, roomName, playerId, playerColor, isHost, singlePlayer?, difficulty?, opponentName? }
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

## Deploy to Render.com (Already Done)

### 1. GitHub Repository
**URL**: https://github.com/krish2248/Connect4-nemotron-ultra-

### 2. Render Service
**URL**: https://connect4-nemotron-ultra.onrender.com
- Runtime: Node.js
- Build: `npm install`
- Start: `npm start`
- Auto-deploys on push to `master`

### 3. Test Multi-device
Open Render URL on desktop + phone. Create room on one, join with 6-char code on other.

---

## Current State
- **Server**: Deployed on Render (HTTPS, auto-redeploy on push)
- **Git**: https://github.com/krish2248/Connect4-nemotron-ultra- (latest commit `9c31f51`)
- **All features**: Working end-to-end

## Single-Player AI (`server/ai.js`)
- Human is always player 1 (yellow); the bot is player 2 (red) with no websocket —
  the server drives its moves. Created via `createSinglePlayer`; the room starts
  immediately (no waiting screen).
- **Algorithm**: minimax with alpha-beta pruning, centre-first move ordering.
  - `easy`: depth 2, 45% random moves, occasionally misses a block.
  - `medium`: depth 4, 12% random moves.
  - `hard`: depth 7, always optimal within the search horizon.
- Always takes an immediate win; blocks the opponent's immediate win (except the
  easy bot, sometimes). Heuristic scores 4-cell windows + centre control.
- **Turn engine**: `websocket.applyMove()` applies any move (human or bot) and
  `advanceTurn()` decides whether to start the human timer or schedule the bot.
  The bot "thinks" for 600–1300ms, then plays. The human keeps the 30s timer; the
  bot is never timed out.
- **Rematch**: single-player "Play Again" restarts instantly against the bot (no
  opponent to ask). Reachable from the game-over stats modal (Play Again / Main Menu).

### Bugs Fixed
0. **Blocking: game could not complete a single turn.** `websocket.js` referenced
   `gameLogic.YELLOW`, `gameLogic.switchPlayer`, and `timer.switchTurn` — none of
   which existed — and `server.js` called `rooms.handleDisconnect` (only
   `leaveRoom` exists). Added `YELLOW`/`RED`/`switchPlayer` to `gameLogic`,
   `switchTurn` to `timer`, and fixed the disconnect handler. Turn flow now routes
   through `advanceTurn`.
1. **`cleanupRooms` import alias** in `server.js` (was `cleanupInactiveRooms` in `rooms.js`)
2. **`.gitignore` encoding** — was UTF-16 LE, which git can't parse, so
   `server/node_modules/` was never actually ignored. Rewritten as UTF-8. (`e7a518d`)
3. **Blank screen on HTTPS deploy** (`7bc627b`):
   - `websocket.js` hardcoded `ws://`, blocked as mixed content on the HTTPS
     Render site. Now picks `wss://` on `https:` pages.
   - `main.js` awaited `ws.connect()` before `render()`, but `connect()`'s promise
     only resolves on open and never rejects on failure — a blocked socket hung
     `init()` forever and nothing rendered. Now renders first, connects in a
     try/catch.
4. **Join "just refreshes the page"** (`9c31f51`) — `createRoom` sent a UUID as the
   room id but the Join input caps at 6 chars and the client uppercases it, so
   `rooms.get()` always missed → `roomNotFound` → landing screen re-rendered. The
   room id is now the unique 6-char code everywhere (create/share/join).

---

## Key Technical Decisions
1. **Single Node server** - HTTP + WS on same port, serves `/client` static files
2. **SHA-256 + salt** - Zero-dep password hashing (Node `crypto`)
3. **Room cleanup** - 5-min inactivity timeout for empty/waiting rooms
4. **Server-authoritative** - Board state, turns, timer all server-side
5. **60fps coin drops** - CSS `transform: translate3d()` + `will-change: transform`
6. **Confetti** - Canvas particles (100 particles, physics-based)
7. **Sounds** - Web Audio API oscillators (no audio files needed)
8. **Screens dynamic** - main.js renders screens, no static HTML screens
9. **Reconnection** - localStorage session, `requestReconnect` → `stateSync`

---

## Achievements (8 Total)
| ID | Name | Condition |
|----|------|-----------|
| `speed_demon` | Speed Demon | Win averaging <5s/move |
| `comeback_kid` | Comeback Kid | Win after 3-in-row disadvantage |
| `perfect_game` | Perfect Game | Win without any blocked moves |
| `clutch` | Clutch | Win with <3s on timer |
| `marathon` | Marathon | Game reaches 42nd move |
| `first_blood` | First Blood | Win first game ever |
| `untouchable` | Untouchable | Win 3 games in a row |
| `time_waster` | Time Waster | Win with 2+ timeouts |

---

## Next Steps (if continuing)
1. Add spectator mode
2. Add chat/emotes
3. Add ELO/ranking system
4. Add custom themes
5. Show a subtle "thinking…" indicator on the bot panel during its turn

---

*Last updated: 2026-07-24 — Added single-player AI opponent (minimax, 3 difficulties) and fixed the blocking turn-engine reference bugs. Game live at https://connect4-nemotron-ultra.onrender.com*
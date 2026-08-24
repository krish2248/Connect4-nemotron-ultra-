# Connect 4 - Session Context

## Project Status: **LIVE ON RENDER** ✅

**Live URL**: https://connect4-nemotron-ultra.onrender.com

---

## ▶️ Resume Here (Next Time)

**Last commit:** `b4c537b` — *Add chat/emotes, ELO ranking, and custom themes* (pushed; Render auto-deploys).

**What just shipped:** Polish pass completing the feature set — last-move ring
highlight on the board, sound on/off toggle (landing + game + spectator screens,
persisted), remembered player names per form, and an ELO/tier chip on the
landing screen. README feature list refreshed.

**Verify:**
1. Play a move → the dropped coin shows a white ring until the next move.
2. Click 🔊 Sound on any screen → label flips to 🔇 and stays off after refresh.
3. Enter your name once → it's prefilled on next visit; landing shows your ⭐ rating + tier.
4. Full regression: two tabs create/join/chat/play — all good (20/20 automated WS tests).

**How to run locally:** `cd server && npm install && npm start` → open
http://localhost:3000.

**Remaining ideas (optional):** tournament brackets · move hints for beginners · profile avatars · spectator count display.

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
| `index.html` | Single entry point, loads 5 CSS + 12 JS modules |
| `css/main.css` | Design system (dark premium theme, CSS variables) |
| `css/board.css` | Board frame, slots, 60fps GPU coin animations |
| `css/ui.css` | Screens, modals, timer ring, stats, achievements |
| `css/chat.css` | Chat bubble/panel, emotes, floating emote animation |
| `css/animations.css` | Keyframes (drop, bounce, glow, confetti, banner) |
| `js/main.js` | App state, routing, WS handlers, screen rendering |
| `js/websocket.js` | WS client wrapper (reconnect, queue, heartbeat) |
| `js/board.js` | 60fps coin drops (gravity + bounce), hover preview |
| `js/timer.js` | SVG circular progress ring |
| `js/ui.js` | Toasts, modals, win banner, canvas confetti |
| `js/stats.js` | localStorage stats + 8 achievements |
| `js/chat.js` | Chat panel UI: messages, emote bar, unread badge, floaters |
| `js/rating.js` | Per-name ELO in localStorage + Bronze→Diamond tiers |
| `js/themes.js` | 6 themes as CSS-variable overrides on `<html>` |
| `js/gameLogic.js` | Client preview only (drop row, valid moves) |
| `js/reconnect.js` | Session restore from localStorage |
| `js/audio.js` | Web Audio API (coin drop, win, timeout, button, chat) |

---

## Features Implemented
- ✅ Real-time 2-player via WebSocket
- ✅ **Single-player vs AI** (Easy / Medium / Hard) — server-side minimax opponent
- ✅ **Bot thinking indicator** — animated "..." on Computer panel during AI turn
- ✅ **Spectator mode** — watch any active game by joining with room code
- ✅ **In-game chat + emotes** — players & spectators, rate-limited, unread badge, floating emote animation, chat sound
- ✅ **ELO ranking** — server-computed K=32 Elo on multiplayer games (bot games unrated), Bronze/Silver/Gold/Platinum/Diamond tiers, shown on player panels + stats modals
- ✅ **Custom themes** — 6 themes (Classic Dark, Midnight Blue, Forest Green, Sunset Purple, Neon Arcade, Daylight), persisted in localStorage
- ✅ **Last-move highlight** — white ring on the most recent coin
- ✅ **Sound toggle** — 🔊/🔇 button on landing, game and spectator screens; preference persisted
- ✅ **Remembered names** — per-form name memory + profile name drives the landing ELO chip
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
createRoom: { name, password, playerName, rating }
createSinglePlayer: { playerName, difficulty, rating }   # difficulty: easy|medium|hard
joinRoom: { roomId, password, playerName, rating }
joinSpectator: { roomId, spectatorName }
dropCoin: { column }
sendChat: { roomId, text, isEmote }   # isEmote: short string or null
requestRematch: { roomId }
requestReconnect: { roomId, playerId }
requestState: { roomId }
ping                                   # client heartbeat (no reply)
```

### Server → Client
```
roomCreated: { roomId, roomName, playerId, playerColor, isHost, singlePlayer?, difficulty?, opponentName? }
roomJoined: { roomId, roomName, players[{id,name,color,isHost,rating}], playerId, playerColor, gameState }
spectatorJoined: { roomId, roomName, spectatorId, players, gameState }
roomError: { code, message }
gameStart: { gameState, countdown: 3 }
coinDropped: { column, row, player, board }
gameState: { board, currentPlayer, winner, winningCoords, isDraw, moveCount }
turnChanged: { currentPlayer, timeRemaining }
turnSkipped: { player, reason: 'timeout' }
gameEnd: { winner, winningCoords, isDraw, stats, elo? }   # elo: {old,new,delta} or {rated:false}
playerDisconnected: { playerId }
playerReconnected: { playerId }
rematchOffered: { fromPlayerId }
rematchAccepted: { gameState }
stateSync: { gameState, timerState, roomId?, playerColor?, playerName?, opponentName?, opponentRating? }
botThinking: { thinking: boolean }        # single-player only
chatMessage: { senderId, senderName, senderColor, text, isEmote, isSpectator, timestamp }
chatError: { message }                    # rate limit hit
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
1. Tournament mode (brackets)
2. Move hints for beginners
3. Profile avatars
4. Spectator count display

---

## Chat, ELO & Themes — Implementation Notes

- **Chat**: server sanitizes text (collapse whitespace, 140-char cap), rate-limits
  per socket (400ms min interval, 8 msgs/10s burst → `chatError`). Spectators can
  chat; messages are tagged `isSpectator`. Client renders via `textContent` (no
  HTML injection), keeps last 100 rows, floats incoming emotes over the board.
- **ELO**: computed server-side at game end (`computeGameElo` in websocket.js),
  K=32, default 1000 for players without a rating. Bot/single-player games are
  unrated. Each client stores its own rating by player name in localStorage
  (`connect4_ratings`) and sends it when creating/joining so opponents' panels
  show real values.
- **Themes**: `themes.js` maps CSS custom properties onto `<html>` inline styles;
  `classic` clears all overrides back to the stylesheet defaults. Board frame /
  hole / coin-edge colors are themeable variables (`--frame-grad-*`, `--hole-c*`,
  `--coin-*-edge`, `--win-glow`) added in main.css/board.css.

### Bugs fixed while building these
- Double floating emote (chat.js and main.js both floated incoming emotes).
- Spectators got unread badge/ping for their own chat messages (`setMyId` now uses
  spectatorId when spectating).
- Emote flag lost on the wire: client sent boolean `isEmote:true` but server only
  accepted short strings — normalized on both sides.
- Reconnect didn't restore identity: `stateSync` now carries roomId/playerName/
  opponentName/opponentRating and the client applies them; also no longer wipes
  `playerColor` on visibilitychange refreshes (which omit those fields).

---

*Last updated: 2026-08-24 — Polish pass: last-move highlight, sound toggle (persisted), remembered names, landing ELO chip; README refreshed. Feature set complete and smoke-tested.*
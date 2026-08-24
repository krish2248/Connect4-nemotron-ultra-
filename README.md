# Connect 4 - Real-time 2-Player Online Game

A real-time multiplayer Connect 4 game with WebSocket server, elegant UI, animations, stats, and achievements.

## Features

- **Real-time multiplayer** via WebSocket (Node.js + ws)
- **Single-player vs AI** — minimax bot with Easy / Medium / Hard difficulty
- **Spectator mode** — watch any active game live by room code
- **In-game chat & emotes** — rate-limited, with floating emote animations
- **ELO ranking** — server-computed (K=32) with Bronze→Diamond tiers
- **6 color themes** — persisted per browser
- **Room-based play** with human-readable room codes (6 chars)
- **Password-protected rooms** with SHA-256 hashing
- **60fps GPU-accelerated coin drop animations** with bounce effect
- **Last-move highlight** so both players can follow play
- **30-second turn timer** with circular progress ring (server-authoritative)
- **Win detection** (horizontal, vertical, both diagonals) + draw detection
- **Win animations**: coin glow, confetti burst, banner entrance
- **Stats tracking** with localStorage persistence
- **8 Achievements** with unlock notifications
- **Reconnection handling** - refresh/brief disconnect restores game
- **Rematch system** - play again in same room
- **Responsive design** - desktop & mobile
- **Keyboard support** (1-7 keys) + mouse/touch
- **Elegant sound effects** (Web Audio API) with in-game mute toggle
- **Dark premium theme** - no flashy/gimmicky elements

## Quick Start

```bash
# Install dependencies
cd server
npm install

# Start development server (with auto-reload)
npm run dev

# Or production mode
npm start
```

Open http://localhost:3000 in two browser tabs/windows to test.

## Deployment to Render.com

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial Connect 4 game"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/connect4.git
git push -u origin main
```

### 2. Deploy on Render

1. Go to [render.com](https://render.com) and sign up/login
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `connect4` (or your choice)
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Click **"Create Web Service"**

Render will:
- Install dependencies
- Start the server on port 3000 (auto-detected from `PORT` env)
- Provide HTTPS URL (e.g., `https://connect4-xxxx.onrender.com`)

### 3. Test Multi-device

Open the Render URL on:
- Desktop browser
- Phone browser (same WiFi or mobile data)

Create a room on one device, join on the other using the room code.

## Project Structure

```
├── server/
│   ├── package.json
│   ├── server.js          # HTTP + WS server, static file serving
│   ├── rooms.js           # Room management, password hashing, cleanup
│   ├── gameLogic.js       # Authoritative game logic (board, win detection)
│   ├── timer.js           # 30s turn timer, timeout handling
│   └── websocket.js       # Message routing (C2S/S2C protocol)
├── client/
│   ├── index.html
│   ├── css/
│   │   ├── main.css       # Design system, variables, base styles
│   │   ├── board.css      # Board frame, slots, coins, animations
│   │   ├── ui.css         # Screens, modals, timer ring, stats
│   │   └── animations.css # Keyframe animations
│   └── js/
│       ├── main.js        # App entry, routing, state, WS handlers
│       ├── websocket.js   # WS client wrapper (reconnect, queue, heartbeat)
│       ├── board.js       # Board rendering, 60fps coin drops, preview
│       ├── timer.js       # SVG circular progress ring
│       ├── ui.js          # Toasts, modals, win banner, confetti
│       ├── stats.js       # localStorage stats + 8 achievements
│       ├── gameLogic.js   # Client-side preview only (drop row, valid)
│       ├── reconnect.js   # Session restore from localStorage
│       └── audio.js       # Web Audio API sound effects
└── README.md
```

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

## Keyboard Shortcuts

- **1-7**: Drop coin in column (when your turn)
- **Escape**: Close modals

## Accessibility

- Respects `prefers-reduced-motion`
- ARIA labels on interactive elements
- Focus management in modals
- Semantic HTML structure

## License

MIT
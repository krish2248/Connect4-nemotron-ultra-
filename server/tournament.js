// 4-player single-elimination tournaments. Players queue in a shared lobby;
// at four entrants the bracket seeds (randomly) and matches run automatically
// in private rooms built by websocket.createInternalRoom. Losers are out but
// keep receiving bracket updates so they can watch remaining matches.
const { v4: uuidv4 } = require('uuid');
const rooms = require('./rooms');

const tournaments = new Map();
const TOURNAMENT_SIZE = 4;
const MATCH_START_DELAY_MS = 2500;

function wsModule() {
  return require('./websocket'); // lazy: avoid load-order cycle
}

function validAvatar(avatar) {
  if (typeof avatar !== 'string') return null;
  const trimmed = avatar.trim();
  return trimmed.length >= 1 && trimmed.length <= 8 ? trimmed : null;
}

function newTournament() {
  return {
    id: uuidv4(),
    status: 'waiting', // waiting | running | finished
    players: [],
    rounds: [], // rounds[r] = [{ id, a, b, winner, roomId, seatParticipants }]
    round: -1,
    championId: null
  };
}

function findOpenTournament() {
  for (const t of tournaments.values()) {
    if (t.status === 'waiting' && t.players.length < TOURNAMENT_SIZE) return t;
  }
  return null;
}

function snapshot(t) {
  return {
    tournamentId: t.id,
    status: t.status,
    players: t.players.map(p => ({ name: p.name, avatar: p.avatar, rating: p.rating, eliminated: p.eliminated })),
    round: t.round,
    rounds: t.rounds.map(round => round.map(m => ({
      a: m.a ? { name: m.a.name, avatar: m.a.avatar } : null,
      b: m.b ? { name: m.b.name, avatar: m.b.avatar } : null,
      winnerName: m.winner ? m.winner.name : null,
      roomId: m.roomId || null,
      live: !!(m.roomId && !m.winner)
    }))),
    championName: t.championId
      ? (t.players.find(p => p.id === t.championId)?.name || null)
      : null
  };
}

function broadcastUpdate(t) {
  const ws = wsModule();
  t.players.forEach(p => {
    if (p.ws && p.ws.readyState === 1) {
      ws.send(p.ws, 'tournamentUpdate', snapshot(t));
    }
  });
}

function sendError(ws, message) {
  wsModule().send(ws, 'tournamentError', { message });
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function joinTournament(ws, payload) {
  const name = typeof payload?.playerName === 'string' ? payload.playerName.trim() : '';
  if (!name || name.length > 16) {
    sendError(ws, 'Pick a name between 1 and 16 characters to join.');
    return;
  }

  let t = findOpenTournament();
  if (!t) {
    t = newTournament();
    tournaments.set(t.id, t);
  }

  if (t.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    sendError(ws, 'That name is already taken in this tournament.');
    return;
  }

  const participant = {
    id: uuidv4(),
    name,
    avatar: validAvatar(payload?.avatar),
    rating: Number.isFinite(payload?.rating) ? payload.rating : null,
    ws,
    eliminated: false
  };
  t.players.push(participant);
  ws.tournamentId = t.id;
  ws.tournamentParticipantId = participant.id;

  wsModule().send(ws, 'tournamentJoined', snapshot(t));
  broadcastUpdate(t);

  if (t.players.length >= TOURNAMENT_SIZE) {
    startTournament(t);
  }
}

function removeParticipant(ws, allowWhenRunning = false) {
  const t = tournaments.get(ws.tournamentId);
  if (!t) return;
  if (t.status === 'running' && !allowWhenRunning) return; // no mid-tournament quits

  const idx = t.players.findIndex(p => p.id === ws.tournamentParticipantId);
  if (idx !== -1) {
    t.players.splice(idx, 1);
    broadcastUpdate(t);
  }
  if (t.status === 'waiting' && t.players.length === 0) {
    tournaments.delete(t.id);
  }
}

function handleDisconnect(ws) {
  if (!ws.tournamentId) return;
  removeParticipant(ws);
}

function leaveTournament(ws) {
  removeParticipant(ws);
  ws.tournamentId = null;
  ws.tournamentParticipantId = null;
}

function startTournament(t) {
  t.status = 'running';
  const seeded = shuffle(t.players);
  const firstRound = [];
  for (let i = 0; i < seeded.length; i += 2) {
    firstRound.push(newMatch(seeded[i], seeded[i + 1]));
  }
  t.rounds.push(firstRound);
  t.round = 0;
  broadcastUpdate(t);

  setTimeout(() => {
    if (tournaments.get(t.id) !== t || t.status !== 'running') return;
    firstRound.forEach(m => launchMatch(t, m));
  }, MATCH_START_DELAY_MS);
}

function newMatch(a, b) {
  return { id: uuidv4(), a, b, winner: null, roomId: null, seatParticipants: [a, b] };
}

function launchMatch(t, match) {
  if (match.winner || !match.a || !match.b) return;

  // If either finalist lost their connection, award the walkover.
  if (!isOnline(match.b)) {
    resolveMatch(t, match, match.a);
    return;
  }
  if (!isOnline(match.a)) {
    resolveMatch(t, match, match.b);
    return;
  }

  const ws = wsModule();
  const label = `Trophy Match ${t.players.find(p => p.id === match.a.id)?.name} vs ${t.players.find(p => p.id === match.b.id)?.name}`;
  const result = ws.createInternalRoom({
    label,
    seatA: { ws: match.a.ws, name: match.a.name, rating: match.a.rating, avatar: match.a.avatar },
    seatB: { ws: match.b.ws, name: match.b.name, rating: match.b.rating, avatar: match.b.avatar }
  });

  if (result.error) {
    // Room setup failed — decide the match on connectivity so the bracket moves.
    resolveMatch(t, match, isOnline(match.a) ? match.a : match.b);
    return;
  }

  result.room.tourney = { tid: t.id, matchId: match.id };
  match.roomId = result.room.id;
  broadcastUpdate(t);
}

function isOnline(participant) {
  return participant && participant.ws && participant.ws.readyState === 1;
}

// Called from websocket.scheduleGameEnd once a tournament match has a decisive
// winner. seatNum is 1 or 2, matching room.players order (yellow/red).
function reportResult(ref, seatNum) {
  const t = tournaments.get(ref.tid);
  if (!t) return;
  const match = findMatch(t, ref.matchId);
  if (!match || match.winner) return;

  const winnerParticipant = match.seatParticipants[seatNum - 1];
  if (!winnerParticipant) return;
  resolveMatch(t, match, winnerParticipant);
}

function resolveMatch(t, match, winnerParticipant) {
  match.winner = winnerParticipant;
  const loser = winnerParticipant === match.a ? match.b : match.a;
  if (loser) loser.eliminated = true;
  broadcastUpdate(t);
  advanceIfReady(t);
}

function advanceIfReady(t) {
  const round = t.rounds[t.round];
  if (!round || !round.every(m => m.winner)) return;

  const winners = round.map(m => m.winner);
  if (winners.length === 1) {
    finishTournament(t, winners[0]);
    return;
  }

  const nextRound = [];
  for (let i = 0; i < winners.length; i += 2) {
    nextRound.push(newMatch(winners[i], winners[i + 1]));
  }
  t.rounds.push(nextRound);
  t.round++;
  broadcastUpdate(t);

  setTimeout(() => {
    if (tournaments.get(t.id) !== t || t.status !== 'running') return;
    nextRound.forEach(m => launchMatch(t, m));
  }, MATCH_START_DELAY_MS + 1000); // give winners a beat on their stats modal
}

function finishTournament(t, champion) {
  t.status = 'finished';
  t.championId = champion.id;
  broadcastUpdate(t);

  // Keep the record around briefly so late messages don't miss it.
  setTimeout(() => tournaments.delete(t.id), 60000);
}

function findMatch(t, matchId) {
  for (const round of t.rounds) {
    const match = round.find(m => m.id === matchId);
    if (match) return match;
  }
  return null;
}

module.exports = {
  joinTournament,
  leaveTournament,
  handleDisconnect,
  reportResult
};

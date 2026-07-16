const STATS_KEY = 'connect4_stats';
const ACHIEVEMENTS_KEY = 'connect4_achievements';

const ACHIEVEMENTS = [
  { id: 'speed_demon', name: 'Speed Demon', desc: 'Win averaging <5s per move', icon: '⚡' },
  { id: 'comeback_kid', name: 'Comeback Kid', desc: 'Win after 3-in-row disadvantage', icon: '🔄' },
  { id: 'perfect_game', name: 'Perfect Game', desc: 'Win without any blocked moves', icon: '💎' },
  { id: 'clutch', name: 'Clutch', desc: 'Win with <3s left on timer', icon: '⏱️' },
  { id: 'marathon', name: 'Marathon', desc: 'Game reaches 42nd move', icon: '🏃' },
  { id: 'first_blood', name: 'First Blood', desc: 'Win your first game ever', icon: '🩸' },
  { id: 'untouchable', name: 'Untouchable', desc: 'Win 3 games in a row', icon: '🛡️' },
  { id: 'time_waster', name: 'Time Waster', desc: 'Win with 2+ timeouts', icon: '🐢' }
];

export class Stats {
  constructor() {
    this.persistent = this.load();
    this.session = { games: 0, wins: 0, losses: 0, draws: 0, streak: 0 };
    this.currentGame = this.initGame();
  }

  load() {
    try {
      return JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
    } catch {
      return {};
    }
  }

  save() {
    localStorage.setItem(STATS_KEY, JSON.stringify(this.persistent));
  }

  initGame() {
    return {
      startTime: 0,
      moves: { 1: [], 2: [] },
      timeouts: { 1: 0, 2: 0 },
      nearWins: { 1: 0, 2: 0 },
      blockedMoves: { 1: 0, 2: 0 },
      maxThinkTime: { 1: 0, 2: 0 },
      minThinkTime: { 1: Infinity, 2: Infinity },
      cameFromBehind: false,
      winMoveTime: null
    };
  }

  startGame() {
    this.currentGame = this.initGame();
    this.currentGame.startTime = Date.now();
  }

  recordMove(player, thinkTime) {
    this.currentGame.moves[player].push(thinkTime);
    this.currentGame.maxThinkTime[player] = Math.max(this.currentGame.maxThinkTime[player], thinkTime);
    this.currentGame.minThinkTime[player] = Math.min(this.currentGame.minThinkTime[player], thinkTime);
  }

  recordTimeout(player) {
    this.currentGame.timeouts[player]++;
  }

  recordNearWin(player) {
    this.currentGame.nearWins[player]++;
  }

  recordBlockedMove(player) {
    this.currentGame.blockedMoves[player]++;
  }

  recordCameFromBehind(player) {
    this.currentGame.cameFromBehind = true;
  }

  recordWinMoveTime(player, timeRemaining) {
    this.currentGame.winMoveTime = timeRemaining;
  }

  endGame(result, myColor) {
    const myPlayer = myColor === 'yellow' ? 1 : 2;

    this.session.games++;
    this.persistent.totalGames = (this.persistent.totalGames || 0) + 1;

    if (result === 'win') {
      this.session.wins++;
      this.session.streak++;
      this.persistent.totalWins = (this.persistent.totalWins || 0) + 1;
      this.persistent.currentStreak = this.session.streak;
      this.persistent.bestStreak = Math.max(this.persistent.bestStreak || 0, this.session.streak);
      if (!this.persistent.firstWinDate) this.persistent.firstWinDate = Date.now();
    } else if (result === 'draw') {
      this.session.draws++;
      this.session.streak = 0;
      this.persistent.totalDraws = (this.persistent.totalDraws || 0) + 1;
      this.persistent.currentStreak = 0;
    } else {
      this.session.losses++;
      this.session.streak = 0;
      this.persistent.totalLosses = (this.persistent.totalLosses || 0) + 1;
      this.persistent.currentStreak = 0;
    }

    this.save();

    return this.getSessionSummary();
  }

  getSessionSummary() {
    const { moves, timeouts, nearWins, blockedMoves, maxThinkTime, minThinkTime, winMoveTime, startTime, cameFromBehind } = this.currentGame;
    const myPlayer = this.session.lastColor === 'yellow' ? 1 : 2;
    const opp = myPlayer === 1 ? 2 : 1;

    const myMoves = moves[myPlayer];
    const oppMoves = moves[opp];

    return {
      duration: Date.now() - startTime,
      myMoves: myMoves.length,
      oppMoves: oppMoves.length,
      myAvgMoveTime: myMoves.length > 0 ? myMoves.reduce((a, b) => a + b, 0) / myMoves.length : 0,
      oppAvgMoveTime: oppMoves.length > 0 ? oppMoves.reduce((a, b) => a + b, 0) / oppMoves.length : 0,
      myMaxThinkTime: maxThinkTime[myPlayer],
      myMinThinkTime: minThinkTime[myPlayer] === Infinity ? 0 : minThinkTime[myPlayer],
      oppMaxThinkTime: maxThinkTime[opp],
      oppMinThinkTime: minThinkTime[opp] === Infinity ? 0 : minThinkTime[opp],
      myTimeouts: timeouts[myPlayer],
      oppTimeouts: timeouts[opp],
      myNearWins: nearWins[myPlayer],
      oppNearWins: nearWins[opp],
      myBlockedMoves: blockedMoves[myPlayer],
      oppBlockedMoves: blockedMoves[opp],
      winMoveTime,
      cameFromBehind
    };
  }

  getPersistentStats() {
    return {
      totalGames: this.persistent.totalGames || 0,
      totalWins: this.persistent.totalWins || 0,
      totalLosses: this.persistent.totalLosses || 0,
      totalDraws: this.persistent.totalDraws || 0,
      bestStreak: this.persistent.bestStreak || 0,
      currentStreak: this.persistent.currentStreak || 0,
      firstWinDate: this.persistent.firstWinDate
    };
  }

  getSessionStats() {
    return {
      games: this.session.games,
      wins: this.session.wins,
      losses: this.session.losses,
      draws: this.session.draws,
      streak: this.session.streak
    };
  }
}

export class Achievements {
  constructor(stats) {
    this.stats = stats;
    this.unlocked = this.load();
  }

  load() {
    try {
      return new Set(JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY) || '[]'));
    } catch {
      return new Set();
    }
  }

  save() {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify([...this.unlocked]));
  }

  isUnlocked(id) {
    return this.unlocked.has(id);
  }

  checkUnlocks(gameSummary, sessionStats, persistentStats) {
    const newlyUnlocked = [];

    ACHIEVEMENTS.forEach(a => {
      if (this.unlocked.has(a.id)) return;

      let unlock = false;

      switch (a.id) {
        case 'speed_demon':
          unlock = gameSummary.myAvgMoveTime > 0 && gameSummary.myAvgMoveTime < 5000;
          break;
        case 'comeback_kid':
          unlock = gameSummary.cameFromBehind;
          break;
        case 'perfect_game':
          unlock = gameSummary.myBlockedMoves === 0 && gameSummary.myMoves > 0;
          break;
        case 'clutch':
          unlock = gameSummary.winMoveTime !== null && gameSummary.winMoveTime < 3000;
          break;
        case 'marathon':
          unlock = gameSummary.myMoves + gameSummary.oppMoves >= 42;
          break;
        case 'first_blood':
          unlock = persistentStats.totalWins === 1;
          break;
        case 'untouchable':
          unlock = persistentStats.currentStreak >= 3;
          break;
        case 'time_waster':
          unlock = gameSummary.myTimeouts >= 2;
          break;
      }

      if (unlock) {
        this.unlocked.add(a.id);
        newlyUnlocked.push(a);
      }
    });

    if (newlyUnlocked.length > 0) {
      this.save();
    }

    return newlyUnlocked;
  }

  getAll() {
    return ACHIEVEMENTS.map(a => ({
      ...a,
      unlocked: this.unlocked.has(a.id)
    }));
  }
}
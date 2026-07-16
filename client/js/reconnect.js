const SESSION_KEY = 'c4_session';

export const Reconnect = {
  saveSession(roomId, playerId) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        roomId,
        playerId,
        timestamp: Date.now()
      }));
    } catch (e) {}
  },

  getSession() {
    try {
      const data = localStorage.getItem(SESSION_KEY);
      if (!data) return null;
      const session = JSON.parse(data);
      if (Date.now() - session.timestamp > 24 * 60 * 60 * 1000) {
        this.clearSession();
        return null;
      }
      return session;
    } catch { return null; }
  },

  clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }
};
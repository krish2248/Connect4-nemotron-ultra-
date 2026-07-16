export class UI {
  constructor() {
    this.toastContainer = document.getElementById('toasts');
    this.reconnectOverlay = document.getElementById('reconnect-overlay');
    this.activeModals = [];
  }

  showReconnecting(show) {
    if (this.reconnectOverlay) {
      this.reconnectOverlay.classList.toggle('active', show);
      this.reconnectOverlay.setAttribute('aria-hidden', !show);
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${this.getToastIcon(type)}</span>
      <span class="toast-message">${message}</span>
    `;

    this.toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    const timeout = setTimeout(() => this.removeToast(toast), 3000);
    toast.addEventListener('mouseenter', () => clearTimeout(timeout));
    toast.addEventListener('mouseleave', () => setTimeout(() => this.removeToast(toast), 1000));

    return toast;
  }

  removeToast(toast) {
    toast.classList.remove('show');
    toast.classList.add('exiting');
    setTimeout(() => toast.remove(), 200);
  }

  getToastIcon(type) {
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ', achievement: '🏆' };
    return icons[type] || icons.info;
  }

  showModal(title, content, actions = []) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-labelledby="modal-title" aria-modal="true">
        <div class="modal-header">
          <h2 class="modal-title" id="modal-title">${title}</h2>
          <button class="modal-close" aria-label="Close modal">×</button>
        </div>
        <div class="modal-content">${content}</div>
        <div class="modal-actions"></div>
      </div>
    `;

    const modal = overlay.querySelector('.modal');
    const actionsContainer = modal.querySelector('.modal-actions');

    actions.forEach((action, i) => {
      const btn = document.createElement('button');
      btn.className = `btn ${action.class || 'btn-secondary'}`;
      btn.textContent = action.label;
      if (i === 0) btn.autofocus = true;
      btn.addEventListener('click', () => {
        const result = action.handler?.();
        if (result !== false) this.closeModal(overlay);
      });
      actionsContainer.appendChild(btn);
    });

    modal.querySelector('.modal-close').addEventListener('click', () => this.closeModal(overlay));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeModal(overlay);
    });

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    const promise = new Promise(resolve => {
      this.activeModals.push({ overlay, resolve });
    });

    return promise;
  }

  closeModal(overlay) {
    overlay.classList.remove('show');
    setTimeout(() => {
      overlay.remove();
      this.activeModals = this.activeModals.filter(m => m.overlay !== overlay);
    }, 200);
  }

  closeAllModals() {
    this.activeModals.forEach(m => this.closeModal(m.overlay));
  }

  renderWaitingScreen(roomId, playerName, playerColor) {
    const codeEl = document.getElementById('waiting-room-code');
    const nameEl = document.getElementById('waiting-player-name');
    const colorEl = document.getElementById('waiting-player-color');
    const opponentEl = document.getElementById('waiting-opponent');
    
    if (codeEl) codeEl.textContent = roomId;
    if (nameEl) nameEl.textContent = playerName;
    if (colorEl) colorEl.className = `player-avatar ${playerColor}`;
    if (opponentEl) opponentEl.textContent = 'Waiting for opponent...';
  }

  updateWaitingScreen(players, currentPlayerId) {
    const opponent = players.find(p => p.id !== currentPlayerId);
    const el = document.getElementById('waiting-opponent');
    if (opponent && el) {
      el.innerHTML = `
        <div class="player-waiting">
          <span class="player-avatar ${opponent.color}"></span>
          <span>${opponent.name}</span>
          <span class="connected">Connected</span>
        </div>
      `;
    }
  }

  renderGameScreen(app) {
    this.updatePlayerPanels(app);
  }

  updatePlayerPanels(app) {
    const isYellow = app.playerColor === 'yellow';
    const p1 = document.getElementById('player1-panel');
    const p2 = document.getElementById('player2-panel');
    const n1 = document.getElementById('player1-name');
    const n2 = document.getElementById('player2-name');

    if (p1 && p2 && n1 && n2) {
      n1.textContent = isYellow ? `${app.playerName} (You)` : 'Opponent';
      n2.textContent = !isYellow ? `${app.playerName} (You)` : 'Opponent';

      p1.classList.toggle('active', app.myTurn && isYellow);
      p2.classList.toggle('active', app.myTurn && !isYellow);
    }
  }

  showCountdown(count, callback) {
    const overlay = document.createElement('div');
    overlay.className = 'countdown-overlay';
    overlay.innerHTML = `<div class="countdown-number">${count}</div>`;
    document.body.appendChild(overlay);

    let current = count;
    const interval = setInterval(() => {
      current--;
      if (current > 0) {
        const numEl = overlay.querySelector('.countdown-number');
        if (numEl) {
          numEl.textContent = current;
          numEl.style.animation = 'none';
          requestAnimationFrame(() => {
            numEl.style.animation = 'countdownPulse 1s ease-out';
          });
        }
      } else {
        clearInterval(interval);
        overlay.remove();
        callback();
      }
    }, 1000);
  }

  showWinBanner(message, winningCoords, isDraw) {
    const banner = document.createElement('div');
    banner.className = `win-banner ${isDraw ? 'draw' : ''}`;
    banner.innerHTML = isDraw
      ? `<h2 class="win-banner-text">It's a Draw!</h2>`
      : `<h2 class="win-banner-text">${message}</h2>`;
    document.body.appendChild(banner);

    if (winningCoords && !isDraw) {
      this.highlightWinningCoins(winningCoords);
    }

    this.burstConfetti(isDraw ? '#a1a1aa' : '#fbbf24');

    setTimeout(() => {
      banner.style.animation = 'bannerEnter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) reverse forwards';
      setTimeout(() => banner.remove(), 500);
    }, 3000);
  }

  highlightWinningCoins(coords) {
    coords.forEach(([col, row]) => {
      const slot = document.querySelector(`.slot[data-col="${col}"][data-row="${row}"]`);
      const coin = slot?.querySelector('.coin');
      if (coin) coin.classList.add('winning');
    });
  }

  burstConfetti(color) {
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '150';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);

    const colors = color === '#a1a1aa'
      ? ['#a1a1aa', '#71717a', '#fff']
      : ['#fbbf24', '#f59e0b', '#fde047', '#fff'];

    const particles = [];
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 3;

    for (let i = 0; i < 100; i++) {
      const angle = (Math.PI * 2 * i) / 100 + Math.random() * 0.5;
      const velocity = 150 + Math.random() * 250;
      particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 150,
        radius: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
        gravity: 350 + Math.random() * 200
      });
    }

    let startTime = performance.now();
    const duration = 2500;

    const animate = (time) => {
      const elapsed = time - startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        canvas.remove();
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        const t = elapsed / 1000;
        p.x += p.vx * t * 0.016;
        p.y += p.vy * t * 0.016;
        p.vy += p.gravity * 0.016;
        p.rotation += p.rotationSpeed * 0.016;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 1 - progress;
        ctx.fillRect(-p.radius / 2, -p.radius / 2, p.radius, p.radius);
        ctx.restore();
      });

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  showGameOverStats(stats, onClose) {
    const content = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${this.formatTime(stats.duration)}</div><div class="stat-label">Match Duration</div></div>
        <div class="stat-card"><div class="stat-value">${stats.myMoves}</div><div class="stat-label">Your Moves</div></div>
        <div class="stat-card"><div class="stat-value">${stats.oppMoves}</div><div class="stat-label">Opponent Moves</div></div>
        <div class="stat-card"><div class="stat-value">${stats.myTimeouts}</div><div class="stat-label">Timeouts</div></div>
        <div class="stat-card"><div class="stat-value">${stats.oppTimeouts}</div><div class="stat-label">Opp Timeouts</div></div>
        <div class="stat-card"><div class="stat-value">${stats.myAvgMoveTime ? Math.round(stats.myAvgMoveTime / 1000) + 's' : '-'}</div><div class="stat-label">Avg Think Time</div></div>
      </div>
    `;

    this.showModal('Game Over', content, [
      { label: 'Rematch', class: 'btn-primary', handler: () => onClose?.() },
      { label: 'View Stats', class: 'btn-secondary', handler: () => { this.closeAllModals(); onClose?.(); } },
      { label: 'Leave', class: 'btn-ghost', handler: () => { this.closeAllModals(); window.location.reload(); } }
    ]);
  }

  formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  }

  showAchievementToast(achievement) {
    const toast = document.createElement('div');
    toast.className = 'toast achievement';
    toast.innerHTML = `
      <span class="toast-icon">${achievement.icon}</span>
      <div>
        <div style="font-weight:600">Achievement Unlocked!</div>
        <div style="font-size:13px;color:var(--text-muted)">${achievement.name}</div>
      </div>
    `;
    this.toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => this.removeToast(toast), 5000);
  }
}
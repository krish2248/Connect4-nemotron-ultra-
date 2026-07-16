export class TimerRing {
  constructor(container) {
    this.container = container;
    this.duration = 30000;
    this.remaining = 30000;
    this.startTime = 0;
    this.rafId = null;
    this.warningThreshold = 10000;
    this.dangerThreshold = 5000;
    this.circumference = 2 * Math.PI * 40;
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <svg class="timer-ring" viewBox="0 0 100 100" aria-label="Turn timer" role="img">
        <circle class="timer-ring-bg" cx="50" cy="50" r="40" fill="none" stroke="var(--border)" stroke-width="4" />
        <circle class="timer-ring-progress" cx="50" cy="50" r="40" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" stroke-dasharray="${this.circumference}" stroke-dashoffset="0" style="transform: rotate(-90deg); transform-origin: 50px 50px; transition: stroke-dashoffset 0.1s linear, stroke 0.3s var(--transition);" />
      </svg>
      <div class="timer-ring-text" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 18px; font-weight: 600;">30</div>
    `;

    this.progressCircle = this.container.querySelector('.timer-ring-progress');
    this.textEl = this.container.querySelector('.timer-ring-text');
    this.container.style.position = 'relative';
    this.container.style.width = '80px';
    this.container.style.height = '80px';
  }

  start(duration = 30000) {
    this.duration = duration;
    this.remaining = duration;
    this.startTime = Date.now();
    this.cancelAnimation();
    this.animate();
  }

  setTime(ms) {
    this.remaining = Math.max(0, ms);
    this.startTime = Date.now() - (this.duration - this.remaining);
    this.updateDisplay();
  }

  pause() {
    this.cancelAnimation();
  }

  resume() {
    this.startTime = Date.now() - (this.duration - this.remaining);
    this.animate();
  }

  stop() {
    this.cancelAnimation();
    this.remaining = this.duration;
    this.updateDisplay();
  }

  cancelAnimation() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  animate() {
    const elapsed = Date.now() - this.startTime;
    this.remaining = Math.max(0, this.duration - elapsed);
    this.updateDisplay();

    if (this.remaining > 0) {
      this.rafId = requestAnimationFrame(() => this.animate());
    } else if (this.onTimeout) {
      this.onTimeout();
    }
  }

  updateDisplay() {
    const progress = this.remaining / this.duration;
    const offset = this.circumference * (1 - progress);

    this.progressCircle.style.strokeDashoffset = offset;

    const seconds = Math.ceil(this.remaining / 1000);
    this.textEl.textContent = seconds;

    this.progressCircle.classList.remove('warning', 'danger');
    if (this.remaining <= this.dangerThreshold) {
      this.progressCircle.style.stroke = 'var(--red)';
      this.progressCircle.classList.add('danger');
    } else if (this.remaining <= this.warningThreshold) {
      this.progressCircle.style.stroke = 'var(--yellow)';
      this.progressCircle.classList.add('warning');
    } else {
      this.progressCircle.style.stroke = 'var(--accent)';
    }
  }
}
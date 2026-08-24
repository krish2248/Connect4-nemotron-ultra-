export class Board {
  constructor(container, onDrop) {
    this.container = container;
    this.onDrop = onDrop;
    this.columns = [];
    this.isAnimating = false;
    this.slotSize = 64;
    this.gap = 8;
    this.previewColumn = null;
    this.render();
  }

  render() {
    this.container.innerHTML = '';
    this.columns = [];

    for (let c = 0; c < 7; c++) {
      const columnEl = document.createElement('div');
      columnEl.className = 'slot-column';
      columnEl.dataset.column = c;
      columnEl.style.width = `${this.slotSize}px`;

      for (let r = 5; r >= 0; r--) {
        const slotEl = document.createElement('div');
        slotEl.className = 'slot';
        slotEl.dataset.row = r;
        slotEl.dataset.column = c;
        columnEl.appendChild(slotEl);
      }

      const previewEl = document.createElement('div');
      previewEl.className = 'coin-preview';
      columnEl.insertBefore(previewEl, columnEl.firstChild);

      columnEl.addEventListener('click', () => {
        if (!this.isAnimating) this.onDrop(c);
      });

      columnEl.addEventListener('mouseenter', () => {
        if (!this.isAnimating) this.previewColumn = c;
      });

      columnEl.addEventListener('mouseleave', () => {
        this.previewColumn = null;
        this.hidePreview();
      });

      this.columns.push({ element: columnEl, preview: previewEl, slots: columnEl.querySelectorAll('.slot') });
      this.container.appendChild(columnEl);
    }

    this.container.addEventListener('touchstart', (e) => this.handleTouch(e), { passive: true });
  }

  handleTouch(e) {
    if (this.isAnimating) return;
    const touch = e.touches[0];
    const rect = this.container.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const col = Math.floor(x / (this.slotSize + this.gap));
    if (col >= 0 && col < 7) {
      this.previewColumn = col;
      this.showPreview(col, this.currentColor);
    }
  }

  dropCoin(column, playerColor, targetY, isMyMove) {
    return new Promise((resolve) => {
      if (this.isAnimating) { resolve(); return; }
      this.isAnimating = true;

      const columnEl = this.columns[column].element;
      const coin = document.createElement('div');
      coin.className = `coin ${playerColor} dropping`;
      coin.style.setProperty('--target-y', `${targetY}px`);
      coin.dataset.column = column;
      coin.dataset.row = Math.round(targetY / (this.slotSize + this.gap));
      this.currentColor = playerColor;

      columnEl.appendChild(coin);

      const handleAnimEnd = (e) => {
        if (e.animationName === 'coinBounce') {
          coin.removeEventListener('animationend', handleAnimEnd);
          coin.classList.remove('dropping');
          coin.classList.add('settled');
          coin.style.transform = `translate3d(0, ${targetY}px, 0)`;
          this.isAnimating = false;
          this.hidePreview();
          resolve();
        }
      };

      coin.addEventListener('animationend', handleAnimEnd);

      setTimeout(() => {
        if (this.isAnimating) {
          this.isAnimating = false;
          coin.remove();
          this.hidePreview();
          resolve();
        }
      }, 1500);
    });
  }

  showPreview(column, playerColor) {
    if (column < 0 || column > 6) return;
    const col = this.columns[column];
    col.preview.className = `coin-preview ${playerColor}`;
    col.preview.style.opacity = '0.35';
    col.preview.style.transform = 'scale(1)';
    this.previewColumn = column;
  }

  hidePreview() {
    this.columns.forEach(col => {
      col.preview.style.opacity = '0';
      col.preview.style.transform = 'scale(0.8)';
    });
  }

  shakeColumn(column) {
    const col = this.columns[column];
    col.element.classList.add('shake');
    setTimeout(() => col.element.classList.remove('shake'), 300);
  }

  highlightWinning(coords) {
    coords.forEach(([c, r]) => {
      const slot = this.columns[c].slots[5 - r];
      if (slot) {
        const coin = slot.querySelector('.coin');
        if (coin) coin.classList.add('winning');
      }
    });
  }

  syncState(board) {
    this.columns.forEach((col, c) => {
      col.slots.forEach((slot, i) => {
        const r = 5 - i;
        const existing = slot.querySelector('.coin');
        if (board[c][r] !== 0) {
          if (!existing) {
            const coin = document.createElement('div');
            coin.className = `coin ${board[c][r] === 1 ? 'yellow' : 'red'} settled`;
            coin.dataset.column = c;
            coin.dataset.row = r;
            coin.style.transform = `translate3d(0, ${r * (this.slotSize + this.gap)}px, 0)`;
            slot.appendChild(coin);
          }
        } else if (existing) {
          existing.remove();
        }
      });
    });
  }

  clearLastMove() {
    this.container.querySelectorAll('.coin.last-move')
      .forEach(el => el.classList.remove('last-move'));
  }

  // Beam-highlight columns suggested by the hint system: 'win' | 'block' | 'build'.
  showColumnHints(columns, kind) {
    this.clearColumnHints();
    columns.forEach(c => {
      const el = this.columns[c]?.element;
      if (el) el.classList.add('hinted', `hint-${kind}`);
    });
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => this.clearColumnHints(), 2600);
  }

  clearColumnHints() {
    clearTimeout(this._hintTimer);
    this.container.querySelectorAll('.slot-column.hinted')
      .forEach(el => el.classList.remove('hinted', 'hint-win', 'hint-block', 'hint-build'));
  }

  // Ring-highlight the most recent drop so both players can see it.
  markLastMove(column, row) {
    this.clearLastMove();
    const col = this.columns[column];
    if (!col) return;
    col.element.querySelectorAll(`.coin[data-column="${column}"][data-row="${row}"]`)
      .forEach(coin => coin.classList.add('last-move'));
  }

  reset() {
    this.columns.forEach(col => {
      col.slots.forEach(slot => {
        const coin = slot.querySelector('.coin');
        if (coin) coin.remove();
      });
    });
    this.clearLastMove();
    this.clearColumnHints();
    this.hidePreview();
    this.isAnimating = false;
  }
}
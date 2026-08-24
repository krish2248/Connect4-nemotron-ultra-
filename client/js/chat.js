const EMOTES = ['👍', '🔥', '😂', '😮', '😭', '🤔', '👏', '💯'];

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export class Chat {
  constructor({ onSend }) {
    this.onSend = onSend;
    this.myId = null;
    this.open = false;
    this.unread = 0;
    this.root = null;
    this.listEl = null;
    this.inputEl = null;
    this.badgeEl = null;
  }

  mount() {
    if (this.root) return;

    const root = document.createElement('div');
    root.className = 'chat-root';
    root.innerHTML = `
      <button class="chat-toggle" id="chat-toggle" aria-label="Toggle chat">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span class="chat-badge hidden" aria-hidden="true"></span>
      </button>
      <div class="chat-panel hidden" role="log" aria-label="Game chat">
        <div class="chat-messages"></div>
        <div class="chat-emotes">
          ${EMOTES.map(e => `<button class="chat-emote" data-emote="${e}" aria-label="Send ${e}">${e}</button>`).join('')}
        </div>
        <div class="chat-input-row">
          <input type="text" class="chat-input" maxlength="140" placeholder="Say something…" aria-label="Chat message">
          <button class="chat-send btn btn-secondary" aria-label="Send">➤</button>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    this.root = root;
    this.listEl = root.querySelector('.chat-messages');
    this.inputEl = root.querySelector('.chat-input');
    this.badgeEl = root.querySelector('.chat-badge');
    this.panelEl = root.querySelector('.chat-panel');

    root.querySelector('#chat-toggle').addEventListener('click', () => this.toggle());
    root.querySelector('.chat-send').addEventListener('click', () => this.sendInput());
    this.inputEl.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') this.sendInput();
    });
    root.querySelectorAll('.chat-emote').forEach(btn => {
      btn.addEventListener('click', () => this.onSend?.(btn.dataset.emote, true));
    });
  }

  toggle(force) {
    this.open = force !== undefined ? force : !this.open;
    this.panelEl.classList.toggle('hidden', !this.open);
    this.root.classList.toggle('open', this.open);
    if (this.open) {
      this.clearUnread();
      this.scrollToBottom();
      this.inputEl.focus();
    }
  }

  setMyId(id) {
    this.myId = id;
  }

  addMessage(msg) {
    if (!this.listEl) return;

    const row = document.createElement('div');
    row.className = 'chat-msg' + (msg.senderId === this.myId ? ' mine' : '');

    const nameSpan = document.createElement('span');
    nameSpan.className = `chat-name${msg.senderColor ? ` ${msg.senderColor}` : ''}${msg.isSpectator ? ' spectator' : ''}`;
    const prefix = msg.senderAvatar ? `${msg.senderAvatar} ` : '';
    nameSpan.textContent = `${prefix}${msg.senderName}${msg.isSpectator ? ' 👁' : ''}:`;

    const textSpan = document.createElement('span');
    textSpan.className = 'chat-text';
    textSpan.textContent = msg.text;

    row.appendChild(nameSpan);
    row.appendChild(textSpan);
    this.listEl.appendChild(row);

    while (this.listEl.children.length > 100) {
      this.listEl.firstChild.remove();
    }

    if (!this.open && msg.senderId !== this.myId) this.showUnread();
    else this.scrollToBottom();
  }

  floatEmote(emote) {
    const floater = document.createElement('div');
    floater.className = 'chat-float-emote';
    floater.textContent = emote;
    floater.style.left = `${45 + Math.random() * 10}%`;
    document.body.appendChild(floater);
    setTimeout(() => floater.remove(), 2200);
  }

  showUnread() {
    this.unread++;
    if (this.badgeEl) {
      this.badgeEl.textContent = String(this.unread > 9 ? '9+' : this.unread);
      this.badgeEl.classList.remove('hidden');
    }
  }

  clearUnread() {
    this.unread = 0;
    if (this.badgeEl) this.badgeEl.classList.add('hidden');
  }

  scrollToBottom() {
    if (this.listEl) this.listEl.scrollTop = this.listEl.scrollHeight;
  }

  sendInput() {
    const text = this.inputEl.value.trim();
    if (!text) return;
    this.onSend?.(text, false);
    this.inputEl.value = '';
    this.inputEl.focus();
  }

  destroy() {
    if (this.root) {
      this.root.remove();
      this.root = null;
      this.listEl = null;
      this.inputEl = null;
      this.panelEl = null;
      this.badgeEl = null;
    }
    this.open = false;
    this.unread = 0;
  }
}

export { escapeHtml, EMOTES };

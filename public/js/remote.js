// ==========================================================================
// TV-HUB // REMOTE CONTROLLER & KEYBOARD DISPATCHER (iOS 18 EDITION)
// ==========================================================================

const Remote = {
  keyboardEnabled: true,
  activeTarget: '192.168.0.108:5555',

  init() {
    this.bindButtons();
    this.bindKeyboard();
  },

  async sendKey(keyName, keycode = null) {
    // Tactile visual feedback on matching button(s)
    const matchingButtons = document.querySelectorAll(`[data-key="${keyName}"]`);
    matchingButtons.forEach(btn => {
      btn.classList.add('pressed');
      setTimeout(() => btn.classList.remove('pressed'), 140);
    });

    try {
      // Record activity in dashboard history
      if (window.App && typeof window.App.recordActivity === 'function') {
        window.App.recordActivity(`Remote: ${keyName.replace('DPAD_', '')}`);
      }

      // Use WebSocket if open, otherwise fallback to REST API
      if (window.Cast && window.Cast.ws && window.Cast.ws.readyState === WebSocket.OPEN) {
        window.Cast.ws.send(JSON.stringify({ action: 'key', key: keyName, keycode }));
      } else {
        await fetch('/api/remote/key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: keyName, keycode })
        });
      }
    } catch (err) {
      console.warn('[Remote] sendKey error:', err);
    }
  },

  async sendText(text) {
    if (!text) return;
    try {
      if (window.App && typeof window.App.recordActivity === 'function') {
        window.App.recordActivity(`Text Sent: "${text.slice(0, 20)}${text.length > 20 ? '...' : ''}"`);
      }

      if (window.Cast && window.Cast.ws && window.Cast.ws.readyState === WebSocket.OPEN) {
        window.Cast.ws.send(JSON.stringify({ action: 'text', text }));
      } else {
        await fetch('/api/remote/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
      }
    } catch (err) {
      console.warn('[Remote] sendText error:', err);
    }
  },

  bindButtons() {
    // D-Pad and Control Buttons everywhere (full remote + overview preview)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-key]');
      if (!btn) return;
      e.preventDefault();
      const key = btn.getAttribute('data-key');
      const code = btn.getAttribute('data-keycode');
      this.sendKey(key, code ? parseInt(code, 10) : null);
    });
  },

  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Never intercept when user is typing inside an input, textarea or contenteditable element
      const activeEl = document.activeElement;
      if (activeEl && (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) || activeEl.isContentEditable)) {
        // Allow Command Palette Escape
        if (e.key === 'Escape' && activeEl.id === 'palette-search-input') {
          App.closePalette();
        }
        return;
      }

      // Command Palette Shortcut: ⌘K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        App.togglePalette();
        return;
      }

      // Shortcut Help: ?
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        App.openKeyboardShortcutsModal();
        return;
      }

      if (!this.keyboardEnabled) return;

      let handled = true;
      switch (e.key) {
        case 'ArrowUp':
          this.sendKey('DPAD_UP', 19);
          break;
        case 'ArrowDown':
          this.sendKey('DPAD_DOWN', 20);
          break;
        case 'ArrowLeft':
          this.sendKey('DPAD_LEFT', 21);
          break;
        case 'ArrowRight':
          this.sendKey('DPAD_RIGHT', 22);
          break;
        case 'Enter':
          this.sendKey('OK', 23);
          break;
        case 'Backspace':
        case 'Escape':
          this.sendKey('BACK', 4);
          break;
        case 'Home':
          this.sendKey('HOME', 3);
          break;
        case 'm':
        case 'M':
          this.sendKey('MUTE', 164);
          break;
        case '+':
        case '=':
          this.sendKey('VOLUME_UP', 24);
          break;
        case '-':
        case '_':
          this.sendKey('VOLUME_DOWN', 25);
          break;
        case ' ':
          this.sendKey('PLAY_PAUSE', 85);
          break;
        default:
          handled = false;
          break;
      }

      if (handled) {
        e.preventDefault();
      }
    });
  }
};

window.Remote = Remote;

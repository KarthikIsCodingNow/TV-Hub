// ==========================================================================
// TV-HUB // REMOTE CONTROLLER & KEYBOARD DISPATCHER
// ==========================================================================

const Remote = {
  keyboardEnabled: true,
  activeTarget: '192.168.0.108:5555',

  init() {
    this.bindButtons();
    this.bindKeyboard();
    this.bindClipboard();
  },

  async sendKey(keyName, keycode = null) {
    // Physical tactile visual feedback on matching button
    const btn = document.querySelector(`[data-key="${keyName}"]`);
    if (btn) {
      btn.classList.add('pressed');
      setTimeout(() => btn.classList.remove('pressed'), 120);
    }

    try {
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
    // D-Pad and Control Buttons
    document.querySelectorAll('[data-key]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const key = btn.getAttribute('data-key');
        const code = btn.getAttribute('data-keycode');
        this.sendKey(key, code ? parseInt(code, 10) : null);
      });
    });
  },

  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Ignore if user is typing inside an input or textarea
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        if (e.key === 'Enter' && document.activeElement.id === 'text-input-field') {
          e.preventDefault();
          const val = document.activeElement.value;
          if (val) {
            this.sendText(val);
            document.activeElement.value = '';
          }
        }
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
  },

  bindClipboard() {
    // Text sending form
    const sendBtn = document.getElementById('btn-send-text');
    const input = document.getElementById('text-input-field');
    if (sendBtn && input) {
      sendBtn.addEventListener('click', () => {
        const val = input.value.trim();
        if (val) {
          this.sendText(val);
          input.value = '';
        }
      });
    }

    // Paste laptop clipboard directly to TV
    const pasteBtn = document.getElementById('btn-paste-clipboard');
    if (pasteBtn) {
      pasteBtn.addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            await this.sendText(text);
            App.showToast(`Pasted to TV: "${text.slice(0, 30)}${text.length > 30 ? '...' : ''}"`);
          } else {
            App.showToast('Clipboard is empty');
          }
        } catch (err) {
          App.showToast('Clipboard read error: Check browser permission', 'error');
        }
      });
    }
  }
};

window.Remote = Remote;

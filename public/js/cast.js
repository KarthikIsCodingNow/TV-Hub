// ==========================================================================
// TV-HUB // SCREEN CAST & INTERACTIVE TRACKPAD/MOUSE ENGINE
// ==========================================================================

const Cast = {
  ws: null,
  jmuxer: null,
  isStreaming: false,
  streamMode: 'h264', // 'h264' or 'snapshot'
  snapshotInterval: null,
  tvWidth: 1280,
  tvHeight: 720,

  // Pointer tracking
  isPointerDown: false,
  pointerStartX: 0,
  pointerStartY: 0,
  pointerStartTime: 0,

  init() {
    this.videoEl = document.getElementById('cast-video');
    this.canvasEl = document.getElementById('cast-canvas');
    this.viewportEl = document.getElementById('cast-viewport');
    this.indicatorEl = document.getElementById('cast-indicator');
    this.statusEl = document.getElementById('cast-status-text');

    this.bindMouseAndTouch();
    this.connectWebSocket();
  },

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/cast`;
    
    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      console.log('[Cast] WebSocket connected');
      this.updateStatus('CONNECTED (READY TO CAST)', 'online');
    };

    this.ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === 'stream_started') {
            this.isStreaming = true;
            this.updateStatus('LIVE SCREENCAST ACTIVE', 'online');
          } else if (msg.event === 'stream_stopped') {
            this.isStreaming = false;
            this.updateStatus('SCREENCAST PAUSED', 'offline');
          }
        } catch (e) {}
      } else if (event.data instanceof ArrayBuffer) {
        // Binary H.264 stream packet
        if (this.jmuxer) {
          try {
            this.jmuxer.feed({ video: new Uint8Array(event.data) });
          } catch (err) {
            console.warn('[Cast] JMuxer feed error:', err);
          }
        }
      }
    };

    this.ws.onclose = () => {
      console.log('[Cast] WebSocket disconnected. Reconnecting in 2s...');
      this.updateStatus('DISCONNECTED - RETRYING...', 'offline');
      setTimeout(() => this.connectWebSocket(), 2000);
    };

    this.ws.onerror = (err) => {
      console.error('[Cast] WebSocket error:', err);
    };
  },

  startStream() {
    if (this.isStreaming) return;

    if (!window.JMuxer) {
      console.warn('[Cast] JMuxer not loaded, falling back to snapshot mode');
      this.startSnapshotMode();
      return;
    }

    try {
      this.videoEl.style.display = 'block';
      this.canvasEl.style.display = 'none';

      if (!this.jmuxer) {
        this.jmuxer = new JMuxer({
          node: 'cast-video',
          mode: 'video',
          flushingTime: 0,
          fps: 30,
          debug: false,
          onError: (data) => {
            console.warn('[Cast] JMuxer internal error:', data);
          }
        });
      }

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ action: 'start_stream' }));
      }
      this.isStreaming = true;
      this.streamMode = 'h264';
      this.updateStatus('STREAMING AT 30 FPS', 'online');
    } catch (e) {
      console.error('[Cast] Failed to start H.264 stream:', e);
      this.startSnapshotMode();
    }
  },

  stopStream() {
    if (!this.isStreaming) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'stop_stream' }));
    }
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
    this.isStreaming = false;
    this.updateStatus('STREAM PAUSED', 'offline');
  },

  toggleStream() {
    if (this.isStreaming) {
      this.stopStream();
      document.getElementById('btn-toggle-cast').innerText = 'START CASTING';
      document.getElementById('btn-toggle-cast').classList.replace('bh-btn-red', 'bh-btn-blue');
    } else {
      this.startStream();
      document.getElementById('btn-toggle-cast').innerText = 'STOP CASTING';
      document.getElementById('btn-toggle-cast').classList.replace('bh-btn-blue', 'bh-btn-red');
    }
  },

  // Fallback snapshot polling mode
  startSnapshotMode() {
    this.streamMode = 'snapshot';
    this.isStreaming = true;
    this.videoEl.style.display = 'none';
    this.canvasEl.style.display = 'block';
    this.updateStatus('SNAPSHOT STREAM ACTIVE', 'online');

    const updateSnapshot = async () => {
      if (!this.isStreaming || this.streamMode !== 'snapshot') return;
      try {
        const img = new Image();
        img.onload = () => {
          const ctx = this.canvasEl.getContext('2d');
          this.canvasEl.width = img.width;
          this.canvasEl.height = img.height;
          ctx.drawImage(img, 0, 0);
        };
        img.src = `/api/screen/shot?t=${Date.now()}`;
      } catch (e) {}
    };

    updateSnapshot();
    if (this.snapshotInterval) clearInterval(this.snapshotInterval);
    this.snapshotInterval = setInterval(updateSnapshot, 1500);
  },

  // Capture single snapshot on demand
  async captureSingleSnapshot() {
    this.videoEl.style.display = 'none';
    this.canvasEl.style.display = 'block';
    const img = new Image();
    img.onload = () => {
      const ctx = this.canvasEl.getContext('2d');
      this.canvasEl.width = img.width;
      this.canvasEl.height = img.height;
      ctx.drawImage(img, 0, 0);
      App.showToast('Snapshot captured from TV');
    };
    img.src = `/api/screen/shot?t=${Date.now()}`;
  },

  // Interactive mouse/touch forwarding to TV
  bindMouseAndTouch() {
    const target = this.viewportEl;
    if (!target) return;

    const getScaledCoords = (clientX, clientY) => {
      const rect = target.getBoundingClientRect();
      const xRatio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const yRatio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      return {
        x: Math.round(xRatio * this.tvWidth),
        y: Math.round(yRatio * this.tvHeight),
        localX: clientX - rect.left,
        localY: clientY - rect.top
      };
    };

    // Pointer move / cursor crosshair indicator
    target.addEventListener('mousemove', (e) => {
      const coords = getScaledCoords(e.clientX, e.clientY);
      if (this.indicatorEl) {
        this.indicatorEl.style.display = 'block';
        this.indicatorEl.style.left = `${coords.localX}px`;
        this.indicatorEl.style.top = `${coords.localY}px`;
      }
    });

    target.addEventListener('mouseleave', () => {
      if (this.indicatorEl) this.indicatorEl.style.display = 'none';
      this.isPointerDown = false;
    });

    // Pointer down
    target.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.isPointerDown = true;
      const coords = getScaledCoords(e.clientX, e.clientY);
      this.pointerStartX = coords.x;
      this.pointerStartY = coords.y;
      this.pointerStartTime = Date.now();
    });

    // Pointer up -> Tap or Swipe
    target.addEventListener('mouseup', (e) => {
      e.preventDefault();
      if (!this.isPointerDown) return;
      this.isPointerDown = false;

      const coords = getScaledCoords(e.clientX, e.clientY);
      const endX = coords.x;
      const endY = coords.y;
      const duration = Math.min(1000, Math.max(100, Date.now() - this.pointerStartTime));

      const dx = Math.abs(endX - this.pointerStartX);
      const dy = Math.abs(endY - this.pointerStartY);

      if (dx < 15 && dy < 15) {
        // Tap
        this.sendTap(endX, endY);
      } else {
        // Swipe
        this.sendSwipe(this.pointerStartX, this.pointerStartY, endX, endY, duration);
      }
    });

    // Mouse wheel scrolling
    target.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY > 20) {
        Remote.sendKey('DPAD_DOWN', 20);
      } else if (e.deltaY < -20) {
        Remote.sendKey('DPAD_UP', 19);
      }
    }, { passive: false });
  },

  sendTap(x, y) {
    console.log(`[Cast] Tap at (${x}, ${y})`);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'tap', x, y }));
    } else {
      fetch('/api/remote/tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y })
      }).catch(() => {});
    }
  },

  sendSwipe(x1, y1, x2, y2, duration) {
    console.log(`[Cast] Swipe from (${x1}, ${y1}) to (${x2}, ${y2}) in ${duration}ms`);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'swipe', x1, y1, x2, y2, duration }));
    } else {
      fetch('/api/remote/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x1, y1, x2, y2, duration })
      }).catch(() => {});
    }
  },

  toggleFullscreen() {
    const elem = this.viewportEl;
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(err => alert(`Fullscreen error: ${err.message}`));
    } else {
      document.exitFullscreen();
    }
  },

  updateStatus(text, state = 'offline') {
    if (this.statusEl) {
      this.statusEl.innerText = text;
      const dot = document.getElementById('cast-status-dot');
      if (dot) {
        dot.className = `status-dot ${state === 'online' ? 'status-online' : 'status-offline'}`;
      }
    }
  }
};

window.Cast = Cast;

// ==========================================================================
// TV-HUB // MAIN APPLICATION CONTROLLER (RETRO DESKTOP EDITION)
// ==========================================================================

const App = {
  currentTab: 'overview',
  connectedTarget: '192.168.0.108:5555',
  customShortcuts: [],
  activityLog: [],
  installedApps: [],

  init() {
    this.initNavigation();
    this.initStatusPolling();
    this.initDiscovery();
    this.initFileSender();
    this.initAppManager();
    this.initShortcuts();
    this.initCommandPalette();
    this.initActivityLog();
    this.bindTextAndClipboard();

    // Initialize sub-controllers
    if (window.Remote) Remote.init();
    if (window.Cast) Cast.init();

    this.checkStatus();
  },

  // ---------------------------------------------------------------------------
  // Navigation & Window Switching
  // ---------------------------------------------------------------------------
  initNavigation() {
    document.querySelectorAll('[data-tab]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = el.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });
  },

  switchTab(tabId) {
    this.currentTab = tabId;

    // Update Taskbar Window Tabs
    document.querySelectorAll('.taskbar-item, [data-tab]').forEach(el => {
      if (el.getAttribute('data-tab') === tabId) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Show Selected Window / Tab
    document.querySelectorAll('.tab-content').forEach(section => {
      section.style.display = section.id === `tab-${tabId}` ? 'block' : 'none';
    });

    // Tab-specific lifecycle actions
    if (tabId === 'cast') {
      Cast.startStream();
    } else if (tabId === 'apps') {
      this.loadInstalledApps();
    }
  },

  // ---------------------------------------------------------------------------
  // Device & Status Polling
  // ---------------------------------------------------------------------------
  initStatusPolling() {
    setInterval(() => this.checkStatus(), 5000);
  },

  async checkStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();

      const dot = document.getElementById('header-status-dot');
      const name = document.getElementById('header-device-model');
      const ip = document.getElementById('header-device-ip');
      const heroModel = document.getElementById('hero-tv-model');
      const heroIp = document.getElementById('hero-tv-ip');
      const heroStatus = document.getElementById('hero-tv-status');
      const heroOs = document.getElementById('hero-tv-os');
      const heroRes = document.getElementById('hero-tv-res');

      if (data.connected) {
        this.connectedTarget = data.target;
        const modelName = data.model || 'Android TV';

        if (dot) dot.className = 'status-indicator-dot online';
        if (name) name.innerText = modelName;
        if (ip) ip.innerText = data.target;

        if (heroModel) heroModel.innerText = modelName;
        if (heroIp) heroIp.innerText = data.target;
        if (heroStatus) {
          heroStatus.className = 'status-indicator-dot online';
          heroStatus.innerText = 'ONLINE (Port 5555)';
          heroStatus.style.color = '#00ff66';
        }
        if (heroOs) heroOs.innerText = `Android ${data.androidVersion || '9'} (SDK 28)`;
        if (heroRes) heroRes.innerText = data.displaySize || '1280x720';

        // Update TV resolution for Cast scaling
        if (data.displaySize) {
          const parts = data.displaySize.split('x');
          if (parts.length === 2) {
            Cast.tvWidth = parseInt(parts[0], 10) || 1280;
            Cast.tvHeight = parseInt(parts[1], 10) || 720;
            const resLabel = document.getElementById('cast-res-label');
            if (resLabel) resLabel.innerText = `${Cast.tvWidth}x${Cast.tvHeight}`;
          }
        }
      } else {
        if (dot) dot.className = 'status-indicator-dot offline';
        if (name) name.innerText = 'DISCONNECTED';
        if (ip) ip.innerText = data.target || '192.168.0.108:5555';
        if (heroStatus) {
          heroStatus.className = 'status-indicator-dot offline';
          heroStatus.innerText = 'OFFLINE';
          heroStatus.style.color = '#ff0000';
        }
      }
    } catch (err) {
      console.warn('[App] status poll error:', err);
    }
  },

  // ---------------------------------------------------------------------------
  // Network TV Discovery
  // ---------------------------------------------------------------------------
  initDiscovery() {
    const discoverBtn = document.getElementById('btn-auto-discover');
    if (discoverBtn) {
      discoverBtn.addEventListener('click', () => this.runDiscovery());
    }

    const connectBtn = document.getElementById('btn-manual-connect');
    if (connectBtn) {
      connectBtn.addEventListener('click', () => {
        const ipInput = document.getElementById('input-manual-ip');
        const portInput = document.getElementById('input-manual-port');
        const ip = ipInput ? ipInput.value.trim() : '';
        const port = portInput ? portInput.value.trim() : '5555';
        if (ip) this.connectToTv(ip, port);
      });
    }
  },

  async runDiscovery() {
    const listEl = document.getElementById('discovered-tvs-list');
    const statusText = document.getElementById('discovery-status-text');
    const btn = document.getElementById('btn-auto-discover');

    if (btn) btn.innerText = 'Probing Subnet...';
    if (statusText) statusText.innerText = 'Scanning subnet on port 5555 & mDNS services...';
    if (listEl) listEl.innerHTML = '<div style="padding: 12px; font-family: var(--dp-typography-mono);">PROBING 192.168.0.1-254... PLEASE WAIT</div>';

    try {
      const res = await fetch('/api/discover');
      const data = await res.json();
      if (statusText) statusText.innerText = `Scan complete: Found ${data.count} host(s) on ${data.subnet}.x`;

      if (!listEl) return;
      if (!data.discovered || data.discovered.length === 0) {
        listEl.innerHTML = `
          <div style="padding: 16px; font-family: var(--dp-typography-mono);">
            [!] No active ADB hosts detected on subnet.<br>
            Ensure Wireless Debugging is ENABLED on TV.
          </div>
        `;
        return;
      }

      listEl.innerHTML = data.discovered.map(dev => `
        <div style="background: #ffffff; border: 1px solid #808080; padding: 8px 12px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; font-size: 13.5px;">
              <span class="status-indicator-dot ${dev.connected ? 'online' : 'offline'}"></span>
              ${dev.model || 'Android TV'}
            </div>
            <div style="font-family: var(--dp-typography-mono); font-size: 11px; color: #555; margin-top: 2px;">
              HOST: ${dev.ip}:${dev.port} &bull; SOURCE: ${dev.source}
            </div>
          </div>
          <button class="retro-btn ${dev.connected ? '' : 'retro-btn-accent'} retro-btn-sm" onclick="App.connectToTv('${dev.ip}', '${dev.port}')">
            ${dev.connected ? 'LINKED' : 'CONNECT'}
          </button>
        </div>
      `).join('');
    } catch (err) {
      if (statusText) statusText.innerText = 'Discovery Failed: ' + err.message;
    } finally {
      if (btn) btn.innerText = 'Scan Subnet for TVs';
    }
  },

  async connectToTv(ip, port = '5555') {
    this.showToast('Connecting', `Reaching out to ${ip}:${port}...`);
    try {
      const res = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, port })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('Connected', `Successfully linked with ${ip}:${port}`, 'success');
        this.recordActivity(`Connected to ${ip}:${port}`);
        this.checkStatus();
      } else {
        this.showToast('Connection Error', data.error, 'danger');
      }
    } catch (err) {
      this.showToast('Connection Failed', err.message, 'danger');
    }
  },

  // ---------------------------------------------------------------------------
  // Text & Clipboard
  // ---------------------------------------------------------------------------
  bindTextAndClipboard() {
    const input = document.getElementById('text-input-field');
    const sendBtn = document.getElementById('btn-send-text');
    const charCounter = document.getElementById('text-char-count');

    if (input) {
      input.addEventListener('input', () => {
        if (charCounter) charCounter.innerText = `${input.value.length} characters`;
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = input.value.trim();
          if (val) {
            Remote.sendText(val);
            input.value = '';
            if (charCounter) charCounter.innerText = '0 characters';
            this.showToast('Text Sent', `Sent "${val.slice(0, 20)}" to TV`);
          }
        }
      });
    }

    if (sendBtn && input) {
      sendBtn.addEventListener('click', () => {
        const val = input.value.trim();
        if (val) {
          Remote.sendText(val);
          input.value = '';
          if (charCounter) charCounter.innerText = '0 characters';
          this.showToast('Text Sent', `Sent "${val.slice(0, 20)}" to TV`);
        }
      });
    }

    const pasteBtn = document.getElementById('btn-paste-clipboard');
    if (pasteBtn) {
      pasteBtn.addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            await Remote.sendText(text);
            this.showToast('Clipboard Sent', `Transmitted: "${text.slice(0, 25)}"`, 'success');
          } else {
            this.showToast('Empty Buffer', 'Clipboard contains no text', 'warning');
          }
        } catch (err) {
          this.showToast('Clipboard Error', 'Check browser clipboard permission', 'danger');
        }
      });
    }
  },

  // ---------------------------------------------------------------------------
  // File Transfer (Retro File Push)
  // ---------------------------------------------------------------------------
  initFileSender() {
    const dropzone = document.getElementById('file-dropzone');
    const fileInput = document.getElementById('file-input');

    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.background = '#ffffd0';
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.style.background = '#ffffff';
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.background = '#ffffff';
      if (e.dataTransfer.files.length > 0) {
        this.uploadFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        this.uploadFile(fileInput.files[0]);
      }
    });
  },

  async uploadFile(file) {
    const card = document.getElementById('upload-progress-card');
    const filenameEl = document.getElementById('upload-filename');
    const statusText = document.getElementById('upload-status-text');

    if (card) card.style.display = 'block';
    if (filenameEl) filenameEl.innerText = file.name;
    if (statusText) statusText.innerText = `Pushing to TV... (${(file.size / 1024 / 1024).toFixed(1)} MB)`;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        if (statusText) statusText.innerText = `Pushed to ${data.remotePath}`;
        this.showToast('Push Complete', `${file.name} sent to TV`, 'success');
        this.recordActivity(`File Sent: ${file.name}`);
      } else {
        if (statusText) statusText.innerText = `Failed: ${data.error}`;
        this.showToast('Transfer Failed', data.error, 'danger');
      }
    } catch (err) {
      if (statusText) statusText.innerText = `Error: ${err.message}`;
      this.showToast('Transfer Error', err.message, 'danger');
    }
  },

  // ---------------------------------------------------------------------------
  // App Management & TV Bro
  // ---------------------------------------------------------------------------
  initAppManager() {
    const installTvBroBtn = document.getElementById('btn-install-tvbro');
    if (installTvBroBtn) {
      installTvBroBtn.addEventListener('click', () => this.installTvBro());
    }

    const apkDropzone = document.getElementById('apk-dropzone');
    const apkInput = document.getElementById('apk-input');
    if (apkDropzone && apkInput) {
      apkDropzone.addEventListener('click', () => apkInput.click());
      apkInput.addEventListener('change', () => {
        if (apkInput.files.length > 0) {
          this.installApk(apkInput.files[0]);
        }
      });
    }

    const refreshBtn = document.getElementById('btn-refresh-apps');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadInstalledApps());
    }

    const searchInput = document.getElementById('input-search-apps');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterApps(e.target.value.toLowerCase());
      });
    }
  },

  async installTvBro() {
    const btn = document.getElementById('btn-install-tvbro');
    const statusEl = document.getElementById('tvbro-install-status');

    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Streaming Installation...';
    }
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerText = '[1/3] Detecting CPU ABI -> [2/3] Downloading Release -> [3/3] ADB Install...';
    }

    try {
      const res = await fetch('/api/apps/install-tvbro', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        this.showToast('Installed', 'TV Bro is now installed on TV!', 'success');
        this.recordActivity('Installed TV Bro (Adblock Browser)');
        if (statusEl) statusEl.innerText = 'STATUS: TV Bro successfully installed via ADB stream!';
        this.loadInstalledApps();
      } else {
        this.showToast('Install Failed', data.error, 'danger');
        if (statusEl) statusEl.innerText = `ERROR: ${data.error}`;
      }
    } catch (err) {
      this.showToast('Install Error', err.message, 'danger');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = '⚡ 1-Click Install TV Bro';
      }
    }
  },

  async installApk(file) {
    this.showToast('Sideloading', `Installing ${file.name}...`);
    const formData = new FormData();
    formData.append('apk', file);

    try {
      const res = await fetch('/api/apps/install', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        this.showToast('Package Installed', `Installed ${file.name}!`, 'success');
        this.recordActivity(`Sideloaded: ${file.name}`);
        this.loadInstalledApps();
      } else {
        this.showToast('Install Error', data.error, 'danger');
      }
    } catch (err) {
      this.showToast('Error', err.message, 'danger');
    }
  },

  async loadInstalledApps() {
    const listEl = document.getElementById('installed-apps-grid');
    if (!listEl) return;
    listEl.innerHTML = '<div style="padding: 12px; font-family: var(--dp-typography-mono);">Loading package manifest from TV...</div>';

    try {
      const res = await fetch('/api/apps/list');
      const data = await res.json();
      this.installedApps = data.thirdParty || [];

      if (this.installedApps.length === 0) {
        listEl.innerHTML = '<div style="padding: 12px; font-family: var(--dp-typography-mono);">[!] No third-party applications found on TV.</div>';
        return;
      }

      this.renderApps(this.installedApps);
    } catch (err) {
      listEl.innerHTML = `<div style="padding: 12px; color: #ff0000; font-family: var(--dp-typography-mono);">Error: ${err.message}</div>`;
    }
  },

  renderApps(apps) {
    const listEl = document.getElementById('installed-apps-grid');
    if (!listEl) return;

    listEl.innerHTML = apps.map(pkg => `
      <div style="background: #ffffff; border-bottom: 1px solid #c0c0c0; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center;">
        <div style="overflow: hidden; text-overflow: ellipsis; max-width: 65%;">
          <strong style="font-size: 13.5px;">${this.formatAppLabel(pkg)}</strong>
          <div style="font-family: var(--dp-typography-mono); font-size: 11px; color: #666;">${pkg}</div>
        </div>
        <div style="display: flex; gap: 4px;">
          <button class="retro-btn retro-btn-sm retro-btn-accent" onclick="App.launchApp('${pkg}')">Launch</button>
          <button class="retro-btn retro-btn-sm retro-btn-danger" onclick="App.confirmUninstall('${pkg}')">Uninstall</button>
        </div>
      </div>
    `).join('');
  },

  formatAppLabel(pkg) {
    const parts = pkg.split('.');
    return parts[parts.length - 1].toUpperCase();
  },

  filterApps(query) {
    if (!query) {
      this.renderApps(this.installedApps);
      return;
    }
    const filtered = this.installedApps.filter(p => p.toLowerCase().includes(query));
    this.renderApps(filtered);
  },

  confirmUninstall(packageName) {
    this.confirm('Uninstall Application', `Delete package ${packageName} from TV?`, async () => {
      try {
        const res = await fetch('/api/apps/uninstall', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packageName })
        });
        const data = await res.json();
        if (data.success) {
          this.showToast('Uninstalled', packageName, 'success');
          this.recordActivity(`Uninstalled: ${packageName}`);
          this.loadInstalledApps();
        } else {
          this.showToast('Uninstall Failed', data.error, 'danger');
        }
      } catch (err) {
        this.showToast('Error', err.message, 'danger');
      }
    });
  },

  async launchApp(packageName) {
    try {
      await fetch('/api/shortcuts/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `package:${packageName}` })
      });
      this.showToast('Launched', `Opened ${packageName}`, 'success');
      this.recordActivity(`Launched: ${packageName}`);
    } catch (err) {
      this.showToast('Launch Error', err.message, 'danger');
    }
  },

  // ---------------------------------------------------------------------------
  // Website Shortcuts
  // ---------------------------------------------------------------------------
  initShortcuts() {
    const form = document.getElementById('form-add-shortcut');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('input-shortcut-name');
        const urlInput = document.getElementById('input-shortcut-url');
        if (nameInput && urlInput && urlInput.value) {
          this.addCustomShortcut(nameInput.value, urlInput.value);
          nameInput.value = '';
          urlInput.value = '';
          this.closeModal('modal-add-shortcut');
        }
      });
    }

    this.loadCustomShortcuts();
  },

  async launchUrl(url) {
    this.showToast('Launching URL', `Opening ${url} on TV...`);
    try {
      const res = await fetch('/api/shortcuts/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('Opened on TV', url, 'success');
        this.recordActivity(`Opened URL: ${url}`);
      } else {
        this.showToast('Launch Failed', data.error, 'danger');
      }
    } catch (err) {
      this.showToast('Error', err.message, 'danger');
    }
  },

  addCustomShortcut(name, url) {
    const shortcut = { id: Date.now(), name, url };
    this.customShortcuts.push(shortcut);
    localStorage.setItem('bh_custom_shortcuts', JSON.stringify(this.customShortcuts));
    this.renderCustomShortcuts();
    this.showToast('Saved', `Added bookmark ${name}`, 'success');
  },

  loadCustomShortcuts() {
    try {
      const saved = localStorage.getItem('bh_custom_shortcuts');
      if (saved) {
        this.customShortcuts = JSON.parse(saved);
        this.renderCustomShortcuts();
      }
    } catch (e) {}
  },

  renderCustomShortcuts() {
    const container = document.getElementById('custom-shortcuts-grid');
    if (!container) return;

    container.innerHTML = this.customShortcuts.map(s => `
      <div class="retro-well" style="text-align: center; position: relative;">
        <button class="retro-btn retro-btn-sm" onclick="event.stopPropagation(); App.deleteCustomShortcut(${s.id})" style="position: absolute; top: 4px; right: 4px; padding: 1px 5px; font-size: 10px;">✕</button>
        <h3 style="font-size: 15px; margin-bottom: 2px;">🌐 ${s.name}</h3>
        <p style="font-family: var(--dp-typography-mono); font-size: 11px; color: #555; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 8px;">${s.url}</p>
        <button class="retro-btn retro-btn-sm retro-btn-accent" onclick="App.launchUrl('${s.url}')" style="width: 100%;">Open on TV</button>
      </div>
    `).join('');
  },

  deleteCustomShortcut(id) {
    this.customShortcuts = this.customShortcuts.filter(s => s.id !== id);
    localStorage.setItem('bh_custom_shortcuts', JSON.stringify(this.customShortcuts));
    this.renderCustomShortcuts();
    this.showToast('Deleted', 'Bookmark removed');
  },

  // ---------------------------------------------------------------------------
  // Global Command Palette (⌘K)
  // ---------------------------------------------------------------------------
  initCommandPalette() {
    const overlay = document.getElementById('palette-overlay');
    const input = document.getElementById('palette-search-input');
    const list = document.getElementById('palette-results-list');

    if (!overlay || !input || !list) return;

    input.addEventListener('input', (e) => {
      this.filterPalette(e.target.value.toLowerCase());
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closePalette();
    });
  },

  togglePalette() {
    const overlay = document.getElementById('palette-overlay');
    if (overlay && overlay.classList.contains('open')) {
      this.closePalette();
    } else {
      this.openPalette();
    }
  },

  openPalette() {
    const overlay = document.getElementById('palette-overlay');
    const input = document.getElementById('palette-search-input');
    if (overlay) {
      overlay.classList.add('open');
      if (input) {
        input.value = '';
        input.focus();
        this.filterPalette('');
      }
    }
  },

  closePalette() {
    const overlay = document.getElementById('palette-overlay');
    if (overlay) overlay.classList.remove('open');
  },

  filterPalette(query) {
    const list = document.getElementById('palette-results-list');
    if (!list) return;

    const commands = [
      { label: 'Switch to Overview', sub: 'Window', action: () => this.switchTab('overview') },
      { label: 'Open Remote Console', sub: 'Window', action: () => this.switchTab('remote') },
      { label: 'Start CRT Screen Mirror', sub: 'Action', action: () => { this.switchTab('cast'); Cast.startStream(); } },
      { label: 'Send Clipboard Buffer to TV', sub: 'Action', action: () => document.getElementById('btn-paste-clipboard')?.click() },
      { label: 'File Dispatcher & Push', sub: 'Window', action: () => this.switchTab('files') },
      { label: 'Install TV Bro Adblock Browser', sub: 'Action', action: () => this.installTvBro() },
      { label: 'Open YouTube on TV', sub: 'Intent', action: () => this.launchUrl('https://youtube.com') },
      { label: 'Scan Local Subnet for TVs', sub: 'Network', action: () => { this.switchTab('discovery'); this.runDiscovery(); } },
      { label: 'Wake TV Display', sub: 'Power', action: () => Remote.sendKey('WAKEUP', 224) },
      { label: 'Sleep TV Display', sub: 'Power', action: () => Remote.sendKey('SLEEP', 223) },
      { label: 'Keyboard Driver Documentation', sub: 'Help', action: () => this.openKeyboardShortcutsModal() }
    ];

    const filtered = query ? commands.filter(c => c.label.toLowerCase().includes(query) || c.sub.toLowerCase().includes(query)) : commands;

    list.innerHTML = filtered.map((cmd, i) => `
      <div class="palette-item ${i === 0 ? 'selected' : ''}" onclick="App.executePaletteAction(${i})">
        <span>&gt; ${cmd.label}</span>
        <span class="meta-pill" style="font-size: 10px;">${cmd.sub}</span>
      </div>
    `).join('');

    this._paletteCurrentActions = filtered;
  },

  executePaletteAction(index) {
    if (this._paletteCurrentActions && this._paletteCurrentActions[index]) {
      this._paletteCurrentActions[index].action();
      this.closePalette();
    }
  },

  // ---------------------------------------------------------------------------
  // Activity Log
  // ---------------------------------------------------------------------------
  initActivityLog() {
    try {
      const saved = localStorage.getItem('tvhub_activity_log');
      if (saved) {
        this.activityLog = JSON.parse(saved);
        this.renderActivityLog();
      }
    } catch (e) {}
  },

  recordActivity(actionTitle) {
    const entry = {
      id: Date.now(),
      title: actionTitle,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    this.activityLog.unshift(entry);
    if (this.activityLog.length > 20) this.activityLog.pop();
    try {
      localStorage.setItem('tvhub_activity_log', JSON.stringify(this.activityLog));
    } catch (e) {}
    this.renderActivityLog();
  },

  renderActivityLog() {
    const list = document.getElementById('recent-activity-list');
    if (!list) return;

    if (this.activityLog.length === 0) {
      list.innerHTML = '<div style="color: #666; font-family: var(--dp-typography-mono);">[Guestbook empty. Execute TV commands to populate.]</div>';
      return;
    }

    list.innerHTML = this.activityLog.slice(0, 8).map(act => `
      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #ccc; font-family: var(--dp-typography-mono); font-size: 12px;">
        <span>&bull; ${act.title}</span>
        <span style="color: #666;">${act.time}</span>
      </div>
    `).join('');
  },

  clearActivityLog() {
    this.activityLog = [];
    localStorage.removeItem('tvhub_activity_log');
    this.renderActivityLog();
    this.showToast('History Cleared', 'Log reset');
  },

  // ---------------------------------------------------------------------------
  // Toast Notification
  // ---------------------------------------------------------------------------
  showToast(title, message = '', type = 'info') {
    let toast = document.getElementById('global-ios-toast');
    if (!toast) return;

    toast.innerHTML = `<span><strong>${title}</strong>: ${message}</span>`;
    toast.classList.add('show');
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  },

  // ---------------------------------------------------------------------------
  // Modals & Confirmations
  // ---------------------------------------------------------------------------
  confirm(title, message, onConfirm) {
    const modal = document.getElementById('modal-confirm-dialog');
    const titleEl = document.getElementById('modal-confirm-title');
    const msgEl = document.getElementById('modal-confirm-message');
    const actionBtn = document.getElementById('btn-modal-confirm-action');

    if (!modal) return;
    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = message;

    modal.classList.add('open');

    const handleConfirm = () => {
      onConfirm();
      this.closeModal('modal-confirm-dialog');
      actionBtn.removeEventListener('click', handleConfirm);
    };

    actionBtn.onclick = handleConfirm;
  },

  openModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.add('open');
  },

  closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.remove('open');
  },

  openKeyboardShortcutsModal() {
    this.openModal('modal-keyboard-shortcuts');
  }
};

window.App = App;
window.addEventListener('DOMContentLoaded', () => App.init());

// ==========================================================================
// TV-HUB // MAIN APPLICATION CONTROLLER (iOS 18 EDITION)
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
    this.initThemeSettings();
    this.initCommandPalette();
    this.initActivityLog();
    this.bindTextAndClipboard();

    // Initialize sub-controllers
    if (window.Remote) Remote.init();
    if (window.Cast) Cast.init();

    this.checkStatus();
  },

  // ---------------------------------------------------------------------------
  // Navigation & Shell
  // ---------------------------------------------------------------------------
  initNavigation() {
    // Desktop Sidebar & Topbar Nav Items
    document.querySelectorAll('[data-tab]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = el.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Mobile Sidebar Toggle
    const toggleBtn = document.getElementById('btn-toggle-sidebar');
    const sidebar = document.querySelector('.app-sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
      // Close on outside click
      document.querySelector('.main-viewport').addEventListener('click', () => {
        sidebar.classList.remove('mobile-open');
      });
    }
  },

  switchTab(tabId) {
    this.currentTab = tabId;

    // Update Desktop Nav Active States
    document.querySelectorAll('.nav-item').forEach(el => {
      if (el.getAttribute('data-tab') === tabId) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Update Mobile Tab Bar States
    document.querySelectorAll('.mobile-tab-item').forEach(el => {
      if (el.getAttribute('data-tab') === tabId) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Update Main Title in Topbar
    const titles = {
      overview: 'Overview',
      remote: 'Remote Control',
      cast: 'Screen Mirror & Trackpad',
      text: 'Text & Clipboard',
      files: 'File Sender',
      apps: 'Apps & TV Bro',
      shortcuts: 'Website Shortcuts',
      discovery: 'Network Scanner',
      settings: 'Appearance & Settings'
    };
    const titleEl = document.getElementById('topbar-page-title');
    if (titleEl) titleEl.innerText = titles[tabId] || 'TV-Hub';

    // Show Selected Section
    document.querySelectorAll('.tab-content').forEach(section => {
      section.style.display = section.id === `tab-${tabId}` ? 'block' : 'none';
    });

    // Tab-specific lifecycle actions
    if (tabId === 'cast') {
      Cast.startStream();
    } else if (tabId === 'apps') {
      this.loadInstalledApps();
    }

    // Close mobile drawer if open
    const sidebar = document.querySelector('.app-sidebar');
    if (sidebar) sidebar.classList.remove('mobile-open');
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
      const sidebarModel = document.getElementById('sidebar-device-model');
      const sidebarIp = document.getElementById('sidebar-device-ip');
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

        if (sidebarModel) sidebarModel.innerText = modelName;
        if (sidebarIp) sidebarIp.innerText = data.target;

        if (heroModel) heroModel.innerText = modelName;
        if (heroIp) heroIp.innerText = data.target;
        if (heroStatus) {
          heroStatus.className = 'status-indicator-dot online';
          heroStatus.nextElementSibling.innerText = 'Online';
        }
        if (heroOs) heroOs.innerText = `Android ${data.androidVersion || '9'}`;
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
        if (name) name.innerText = 'Disconnected';
        if (ip) ip.innerText = data.target || '192.168.0.108:5555';
        if (sidebarModel) sidebarModel.innerText = 'Disconnected';
        if (heroStatus) {
          heroStatus.className = 'status-indicator-dot offline';
          heroStatus.nextElementSibling.innerText = 'Disconnected';
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

    if (btn) btn.innerHTML = '<svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Scanning Network...';
    if (statusText) statusText.innerText = 'Probing subnet on port 5555 & mDNS services...';
    if (listEl) listEl.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-secondary);">Scanning local Wi-Fi for Android TVs...</div>';

    try {
      const res = await fetch('/api/discover');
      const data = await res.json();
      if (statusText) statusText.innerText = `Discovered ${data.count} device(s) on ${data.subnet}.x`;

      if (!listEl) return;
      if (!data.discovered || data.discovered.length === 0) {
        listEl.innerHTML = `
          <div style="padding: 32px; text-align: center;">
            <p style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">No Android TVs Found</p>
            <p style="font-size: 13px; color: var(--text-secondary);">Ensure Wireless ADB is turned ON in Developer Options.</p>
          </div>
        `;
        return;
      }

      listEl.innerHTML = data.discovered.map(dev => `
        <div class="ios-card" style="padding: 16px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; border-radius: var(--radius-sm); background: var(--surface-secondary); display: flex; align-items: center; justify-content: center; color: var(--accent);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="status-indicator-dot ${dev.connected ? 'online' : 'offline'}"></span>
                <span style="font-size: 14px; font-weight: 600;">${dev.model || 'Android TV'}</span>
              </div>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                ${dev.ip}:${dev.port} &bull; <span class="meta-pill" style="font-size: 10px;">${dev.source}</span>
              </div>
            </div>
          </div>
          <button class="ios-btn ${dev.connected ? 'ios-btn-secondary' : 'ios-btn-primary'} ios-btn-sm" onclick="App.connectToTv('${dev.ip}', '${dev.port}')">
            ${dev.connected ? 'Connected' : 'Connect'}
          </button>
        </div>
      `).join('');
    } catch (err) {
      if (statusText) statusText.innerText = 'Discovery Failed: ' + err.message;
    } finally {
      if (btn) btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> Scan Network for TVs';
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
            this.showToast('Text Sent', `Forwarded "${val.slice(0, 24)}" to TV`);
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
          this.showToast('Text Sent', `Forwarded "${val.slice(0, 24)}" to TV`);
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
            this.showToast('Pasted to TV', `Sent: "${text.slice(0, 30)}${text.length > 30 ? '...' : ''}"`, 'success');
          } else {
            this.showToast('Clipboard Empty', 'No text in clipboard', 'warning');
          }
        } catch (err) {
          this.showToast('Clipboard Error', 'Check browser clipboard permissions', 'danger');
        }
      });
    }
  },

  // ---------------------------------------------------------------------------
  // File Transfer (AirDrop Style)
  // ---------------------------------------------------------------------------
  initFileSender() {
    const dropzone = document.getElementById('file-dropzone');
    const fileInput = document.getElementById('file-input');

    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
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
    const barEl = document.getElementById('upload-progress-bar');
    const statusText = document.getElementById('upload-status-text');

    if (card) card.style.display = 'block';
    if (filenameEl) filenameEl.innerText = file.name;
    if (statusText) statusText.innerText = `Pushing to /sdcard/Download/... (${(file.size / 1024 / 1024).toFixed(1)} MB)`;
    if (barEl) barEl.className = 'progress-bar-fill indeterminate';

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        if (barEl) {
          barEl.className = 'progress-bar-fill';
          barEl.style.width = '100%';
        }
        if (statusText) statusText.innerText = `Transferred to ${data.remotePath}`;
        this.showToast('Transfer Complete', `${file.name} sent to TV`, 'success');
        this.recordActivity(`File Sent: ${file.name}`);
      } else {
        if (statusText) statusText.innerText = `Upload failed: ${data.error}`;
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
      btn.innerHTML = '<svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Downloading & Installing...';
    }
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerText = 'Detecting CPU architecture and streaming APK...';
    }

    try {
      const res = await fetch('/api/apps/install-tvbro', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        this.showToast('App Installed', 'TV Bro is now installed on your TV!', 'success');
        this.recordActivity('Installed TV Bro (Adblock Browser)');
        if (statusEl) statusEl.innerText = 'TV Bro successfully installed!';
        this.loadInstalledApps();
      } else {
        this.showToast('Install Failed', data.error, 'danger');
        if (statusEl) statusEl.innerText = `Installation failed: ${data.error}`;
      }
    } catch (err) {
      this.showToast('Install Error', err.message, 'danger');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Install TV Bro';
      }
    }
  },

  async installApk(file) {
    this.showToast('Sideloading APK', `Installing ${file.name}...`);
    const formData = new FormData();
    formData.append('apk', file);

    try {
      const res = await fetch('/api/apps/install', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        this.showToast('App Sideloaded', `Installed ${file.name}!`, 'success');
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
    listEl.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-secondary);">Loading installed packages...</div>';

    try {
      const res = await fetch('/api/apps/list');
      const data = await res.json();
      this.installedApps = data.thirdParty || [];

      if (this.installedApps.length === 0) {
        listEl.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-secondary);">No 3rd-party apps detected.</div>';
        return;
      }

      this.renderApps(this.installedApps);
    } catch (err) {
      listEl.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--danger);">Failed to load packages: ${err.message}</div>`;
    }
  },

  renderApps(apps) {
    const listEl = document.getElementById('installed-apps-grid');
    if (!listEl) return;

    listEl.innerHTML = apps.map(pkg => `
      <div class="app-item-card">
        <div style="display: flex; align-items: center; gap: 12px; overflow: hidden;">
          <div class="app-icon-default">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          </div>
          <div style="overflow: hidden;">
            <div style="font-weight: 600; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.formatAppLabel(pkg)}</div>
            <div style="font-size: 11px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${pkg}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <button class="ios-btn ios-btn-tinted ios-btn-sm" onclick="App.launchApp('${pkg}')">Launch</button>
          <button class="ios-btn ios-btn-danger ios-btn-sm" onclick="App.confirmUninstall('${pkg}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
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
    this.confirm('Uninstall Application', `Are you sure you want to delete ${packageName} from your TV?`, async () => {
      try {
        const res = await fetch('/api/apps/uninstall', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packageName })
        });
        const data = await res.json();
        if (data.success) {
          this.showToast('App Uninstalled', packageName, 'success');
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
      this.showToast('App Launched', `Opened ${packageName} on TV`, 'success');
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
    this.showToast('Opening Link', `Launching ${url} in TV browser...`);
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
    this.showToast('Shortcut Added', `Created bookmark for ${name}`, 'success');
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
      <div class="shortcut-tile">
        <button class="ios-btn ios-btn-sm" onclick="event.stopPropagation(); App.deleteCustomShortcut(${s.id})" style="position: absolute; top: 10px; right: 10px; padding: 4px; border-radius: 9999px; background: transparent; border: none; color: var(--text-tertiary);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <div class="shortcut-icon-circle" style="background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
        </div>
        <div style="font-weight: 600; font-size: 14px; margin-top: 4px;">${s.name}</div>
        <div style="font-size: 11px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">${s.url}</div>
        <button class="ios-btn ios-btn-tinted ios-btn-sm" onclick="App.launchUrl('${s.url}')" style="margin-top: 8px; width: 100%;">Open on TV</button>
      </div>
    `).join('');
  },

  deleteCustomShortcut(id) {
    this.customShortcuts = this.customShortcuts.filter(s => s.id !== id);
    localStorage.setItem('bh_custom_shortcuts', JSON.stringify(this.customShortcuts));
    this.renderCustomShortcuts();
    this.showToast('Shortcut Removed', 'Bookmark deleted');
  },

  // ---------------------------------------------------------------------------
  // Appearance & Theme Settings
  // ---------------------------------------------------------------------------
  initThemeSettings() {
    const savedTheme = localStorage.getItem('tvhub_theme') || 'system';
    this.setTheme(savedTheme, false);

    document.querySelectorAll('[data-set-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-set-theme');
        this.setTheme(theme, true);
      });
    });

    const savedAccent = localStorage.getItem('tvhub_accent') || 'blue';
    this.setAccent(savedAccent, false);

    document.querySelectorAll('[data-set-accent]').forEach(btn => {
      btn.addEventListener('click', () => {
        const accent = btn.getAttribute('data-set-accent');
        this.setAccent(accent, true);
      });
    });
  },

  setTheme(theme, notify = true) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('tvhub_theme', theme);

    // Update segmented control buttons
    document.querySelectorAll('[data-set-theme]').forEach(btn => {
      if (btn.getAttribute('data-set-theme') === theme) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (notify) this.showToast('Appearance Updated', `Switched appearance to ${theme.toUpperCase()}`);
  },

  setAccent(accent, notify = true) {
    document.body.setAttribute('data-accent', accent);
    localStorage.setItem('tvhub_accent', accent);

    document.querySelectorAll('[data-set-accent]').forEach(btn => {
      if (btn.getAttribute('data-set-accent') === accent) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (notify) this.showToast('Accent Updated', `Theme accent set to ${accent.toUpperCase()}`);
  },

  // ---------------------------------------------------------------------------
  // Global Command Palette (⌘K)
  // ---------------------------------------------------------------------------
  initCommandPalette() {
    const overlay = document.getElementById('palette-overlay');
    const input = document.getElementById('palette-search-input');
    const list = document.getElementById('palette-results-list');

    if (!overlay || !input || !list) return;

    // Search input filtering
    input.addEventListener('input', (e) => {
      this.filterPalette(e.target.value.toLowerCase());
    });

    // Close on overlay backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closePalette();
    });

    // Quick trigger button in topbar
    const trigger = document.getElementById('btn-command-palette-trigger');
    if (trigger) {
      trigger.addEventListener('click', () => this.togglePalette());
    }
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
      { label: 'Go to Overview', sub: 'Navigation', icon: 'home', action: () => this.switchTab('overview') },
      { label: 'Open Remote Control', sub: 'Navigation', icon: 'tv', action: () => this.switchTab('remote') },
      { label: 'Start Screen Mirror', sub: 'Action', icon: 'airplay', action: () => { this.switchTab('cast'); Cast.startStream(); } },
      { label: 'Send Clipboard to TV', sub: 'Action', icon: 'clipboard', action: () => document.getElementById('btn-paste-clipboard')?.click() },
      { label: 'Upload / Send File', sub: 'Navigation', icon: 'folder', action: () => this.switchTab('files') },
      { label: 'Install TV Bro Browser', sub: 'Action', icon: 'download', action: () => this.installTvBro() },
      { label: 'Open YouTube on TV', sub: 'Website', icon: 'globe', action: () => this.launchUrl('https://youtube.com') },
      { label: 'Scan for Local TVs', sub: 'Network', icon: 'radar', action: () => { this.switchTab('discovery'); this.runDiscovery(); } },
      { label: 'Wake TV Up', sub: 'Remote', icon: 'power', action: () => Remote.sendKey('WAKEUP', 224) },
      { label: 'Put TV to Sleep', sub: 'Remote', icon: 'moon', action: () => Remote.sendKey('SLEEP', 223) },
      { label: 'Keyboard Shortcuts Reference', sub: 'Help', icon: 'help', action: () => this.openKeyboardShortcutsModal() },
      { label: 'Toggle Light / Dark Appearance', sub: 'Settings', icon: 'moon', action: () => {
        const cur = document.body.getAttribute('data-theme');
        this.setTheme(cur === 'dark' ? 'light' : 'dark');
      }}
    ];

    const filtered = query ? commands.filter(c => c.label.toLowerCase().includes(query) || c.sub.toLowerCase().includes(query)) : commands;

    list.innerHTML = filtered.map((cmd, i) => `
      <div class="palette-item ${i === 0 ? 'selected' : ''}" onclick="App.executePaletteAction(${i})">
        <div style="font-weight: 500; font-size: 13.5px;">${cmd.label}</div>
        <span class="meta-pill" style="margin-left: auto; font-size: 10px;">${cmd.sub}</span>
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
      list.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-tertiary); font-size: 13px;">No recent actions recorded.</div>';
      return;
    }

    list.innerHTML = this.activityLog.slice(0, 6).map(act => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--separator-subtle);">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 6px; height: 6px; border-radius: 9999px; background: var(--accent);"></div>
          <span style="font-size: 13px; font-weight: 500;">${act.title}</span>
        </div>
        <span style="font-size: 11px; color: var(--text-tertiary);" class="tabular-nums">${act.time}</span>
      </div>
    `).join('');
  },

  clearActivityLog() {
    this.activityLog = [];
    localStorage.removeItem('tvhub_activity_log');
    this.renderActivityLog();
    this.showToast('History Cleared', 'Activity feed reset');
  },

  // ---------------------------------------------------------------------------
  // iOS-Style Dynamic Island Toasts
  // ---------------------------------------------------------------------------
  showToast(title, message = '', type = 'info') {
    let toast = document.getElementById('global-ios-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'global-ios-toast';
      toast.className = 'ios-toast';
      document.body.appendChild(toast);
    }

    const dotColor = type === 'success' ? 'var(--success)' : (type === 'danger' ? 'var(--danger)' : (type === 'warning' ? 'var(--warning)' : 'var(--accent)'));

    toast.innerHTML = `
      <div class="toast-dot" style="background: ${dotColor};"></div>
      <div style="display: flex; flex-direction: column;">
        <span style="font-weight: 600; font-size: 13px;">${title}</span>
        ${message ? `<span style="font-size: 11px; color: var(--text-secondary);">${message}</span>` : ''}
      </div>
    `;

    toast.classList.add('show');
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  },

  // ---------------------------------------------------------------------------
  // Modals & Native Confirmations
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

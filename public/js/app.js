// ==========================================================================
// TV-HUB // MAIN APPLICATION CONTROLLER
// ==========================================================================

const App = {
  currentTab: 'remote',
  connectedTarget: '192.168.0.108:5555',
  customShortcuts: [],

  init() {
    this.initTabs();
    this.initStatusPolling();
    this.initDiscovery();
    this.initFileSender();
    this.initAppManager();
    this.initShortcuts();
    this.initThemeSwitcher();

    // Initialize sub-modules
    Remote.init();
    Cast.init();

    this.checkStatus();
  },

  // ---------------------------------------------------------------------------
  // Tab Navigation
  // ---------------------------------------------------------------------------
  initTabs() {
    document.querySelectorAll('.bh-nav-item').forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });
  },

  switchTab(tabId) {
    this.currentTab = tabId;
    document.querySelectorAll('.bh-nav-item').forEach(t => {
      if (t.getAttribute('data-tab') === tabId) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });

    document.querySelectorAll('.tab-content').forEach(section => {
      section.style.display = section.id === `tab-${tabId}` ? 'block' : 'none';
    });

    if (tabId === 'cast') {
      Cast.startStream();
    } else if (tabId === 'apps') {
      this.loadInstalledApps();
    }
  },

  // ---------------------------------------------------------------------------
  // Status & Device Polling
  // ---------------------------------------------------------------------------
  initStatusPolling() {
    setInterval(() => this.checkStatus(), 5000);
  },

  async checkStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      
      const badge = document.getElementById('device-status-badge');
      const dot = document.getElementById('header-status-dot');
      const name = document.getElementById('device-model-name');
      const ip = document.getElementById('device-ip-display');

      if (data.connected) {
        this.connectedTarget = data.target;
        if (name) name.innerText = data.model || 'Android TV';
        if (ip) ip.innerText = data.target;
        if (dot) dot.className = 'status-dot status-online';
        if (badge) badge.className = 'bh-pill block-white';
        
        // Update TV resolution for Cast mouse scaling
        if (data.displaySize) {
          const parts = data.displaySize.split('x');
          if (parts.length === 2) {
            Cast.tvWidth = parseInt(parts[0], 10) || 1280;
            Cast.tvHeight = parseInt(parts[1], 10) || 720;
          }
        }
      } else {
        if (name) name.innerText = 'DISCONNECTED';
        if (ip) ip.innerText = data.target || '192.168.0.108:5555';
        if (dot) dot.className = 'status-dot status-offline';
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
    if (statusText) statusText.innerText = 'SCANNING LOCAL NETWORK (PORT 5555 & ADB)...';
    if (listEl) listEl.innerHTML = '<div style="padding: 1.5rem; font-weight: 800;">SCANNING SUB-NET... PLEASE WAIT (EST. 1 SEC)</div>';

    try {
      const res = await fetch('/api/discover');
      const data = await res.json();
      if (statusText) statusText.innerText = `DISCOVERY COMPLETE. FOUND ${data.count} DEVICE(S).`;

      if (!listEl) return;
      if (!data.discovered || data.discovered.length === 0) {
        listEl.innerHTML = '<div style="padding: 1.5rem; font-weight: 800;">NO ANDROID TVS FOUND. TRY CONNECTING MANUALLY VIA IP.</div>';
        return;
      }

      listEl.innerHTML = data.discovered.map(dev => `
        <div class="bh-card" style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
              <span class="status-dot ${dev.connected ? 'status-online' : 'status-offline'}"></span>
              <h3 style="font-size: 1.4rem;">${dev.model || 'Android TV'}</h3>
            </div>
            <div style="font-weight: 800; color: #555;">${dev.ip}:${dev.port} &bull; <span class="bh-pill">${dev.source}</span></div>
          </div>
          <button class="bh-btn ${dev.connected ? 'bh-btn-black' : 'bh-btn-red'}" onclick="App.connectToTv('${dev.ip}', '${dev.port}')">
            ${dev.connected ? 'CONNECTED' : 'CONNECT'}
          </button>
        </div>
      `).join('');
    } catch (err) {
      if (statusText) statusText.innerText = 'DISCOVERY FAILED: ' + err.message;
    }
  },

  async connectToTv(ip, port = '5555') {
    this.showToast(`Connecting to ${ip}:${port}...`);
    try {
      const res = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, port })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(`Connected to TV at ${ip}:${port}!`, 'success');
        this.checkStatus();
      } else {
        this.showToast(`Connection error: ${data.error}`, 'error');
      }
    } catch (err) {
      this.showToast(`Failed to connect: ${err.message}`, 'error');
    }
  },

  // ---------------------------------------------------------------------------
  // File Transfer
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
    const progressEl = document.getElementById('upload-progress-card');
    const progressText = document.getElementById('upload-progress-text');
    if (progressEl) progressEl.style.display = 'block';
    if (progressText) progressText.innerText = `PUSHING ${file.name.toUpperCase()} TO /sdcard/Download/...`;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(`File transferred to ${data.remotePath}!`, 'success');
        if (progressText) progressText.innerText = `SUCCESSFULLY PUSHED ${file.name.toUpperCase()}`;
      } else {
        this.showToast(`Upload failed: ${data.error}`, 'error');
        if (progressText) progressText.innerText = `FAILED: ${data.error}`;
      }
    } catch (err) {
      this.showToast(`Error: ${err.message}`, 'error');
      if (progressText) progressText.innerText = `ERROR: ${err.message}`;
    }
  },

  // ---------------------------------------------------------------------------
  // App Management & Top-Rated Adblock Browser
  // ---------------------------------------------------------------------------
  initAppManager() {
    // 1-Click Install TV Bro (Top-Rated Adblock Browser)
    const installTvBroBtn = document.getElementById('btn-install-tvbro');
    if (installTvBroBtn) {
      installTvBroBtn.addEventListener('click', () => this.installTvBro());
    }

    // APK Sideload dropzone
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

    // Refresh apps list
    const refreshAppsBtn = document.getElementById('btn-refresh-apps');
    if (refreshAppsBtn) {
      refreshAppsBtn.addEventListener('click', () => this.loadInstalledApps());
    }
  },

  async installTvBro() {
    const statusEl = document.getElementById('tvbro-install-status');
    const btn = document.getElementById('btn-install-tvbro');
    if (btn) btn.disabled = true;
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerText = 'DOWNLOADING TV BRO (OFFICIAL RELEASE) & SIDELOADING TO TV...';
    }

    try {
      const res = await fetch('/api/apps/install-tvbro', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        this.showToast('TV Bro successfully installed on TV!', 'success');
        if (statusEl) statusEl.innerText = 'INSTALLED SUCCESSFULLY! LAUNCHABLE FROM TV HOME.';
      } else {
        this.showToast(`Installation failed: ${data.error}`, 'error');
        if (statusEl) statusEl.innerText = `INSTALLATION FAILED: ${data.error}`;
      }
    } catch (err) {
      this.showToast(`Error: ${err.message}`, 'error');
      if (statusEl) statusEl.innerText = `ERROR: ${err.message}`;
    } finally {
      if (btn) btn.disabled = false;
      this.loadInstalledApps();
    }
  },

  async installApk(file) {
    this.showToast(`Sideloading ${file.name}...`);
    const formData = new FormData();
    formData.append('apk', file);

    try {
      const res = await fetch('/api/apps/install', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(`APK ${file.name} installed!`, 'success');
        this.loadInstalledApps();
      } else {
        this.showToast(`APK install failed: ${data.error}`, 'error');
      }
    } catch (err) {
      this.showToast(`Error: ${err.message}`, 'error');
    }
  },

  async loadInstalledApps() {
    const listEl = document.getElementById('installed-apps-grid');
    if (!listEl) return;
    listEl.innerHTML = '<div style="padding: 1.5rem; font-weight: 800;">FETCHING INSTALLED PACKAGES...</div>';

    try {
      const res = await fetch('/api/apps/list');
      const data = await res.json();

      if (!data.thirdParty || data.thirdParty.length === 0) {
        listEl.innerHTML = '<div style="padding: 1.5rem; font-weight: 800;">NO 3RD-PARTY APPS DETECTED.</div>';
        return;
      }

      listEl.innerHTML = data.thirdParty.map(pkg => `
        <div class="bh-card" style="margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; padding: 1rem;">
          <div style="overflow: hidden; text-overflow: ellipsis; max-width: 65%;">
            <h4 style="font-size: 1.1rem; word-break: break-all;">${pkg}</h4>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="bh-btn bh-btn-yellow" onclick="App.launchApp('${pkg}')" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">LAUNCH</button>
            <button class="bh-btn bh-btn-red" onclick="App.uninstallApp('${pkg}')" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">UNINSTALL</button>
          </div>
        </div>
      `).join('');
    } catch (err) {
      listEl.innerHTML = `<div style="padding: 1.5rem; font-weight: 800; color: var(--bh-red);">FAILED TO LOAD APPS: ${err.message}</div>`;
    }
  },

  async uninstallApp(packageName) {
    if (!confirm(`Are you sure you want to uninstall ${packageName}?`)) return;
    try {
      const res = await fetch('/api/apps/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageName })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(`Uninstalled ${packageName}`, 'success');
        this.loadInstalledApps();
      } else {
        this.showToast(`Uninstall failed: ${data.error}`, 'error');
      }
    } catch (err) {
      this.showToast(`Error: ${err.message}`, 'error');
    }
  },

  async launchApp(packageName) {
    try {
      await fetch('/api/shortcuts/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `package:${packageName}` })
      });
      this.showToast(`Launched ${packageName}`);
    } catch (err) {
      this.showToast(`Launch failed: ${err.message}`, 'error');
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
          this.addCustomShortcut(nameInput.value || 'Website', urlInput.value);
          nameInput.value = '';
          urlInput.value = '';
        }
      });
    }

    this.loadCustomShortcuts();
  },

  async launchUrl(url) {
    this.showToast(`Launching ${url} on TV...`);
    try {
      const res = await fetch('/api/shortcuts/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('Opened on TV in browser!', 'success');
      } else {
        this.showToast(`Failed: ${data.error}`, 'error');
      }
    } catch (err) {
      this.showToast(`Error: ${err.message}`, 'error');
    }
  },

  addCustomShortcut(name, url) {
    const shortcut = { id: Date.now(), name, url };
    this.customShortcuts.push(shortcut);
    localStorage.setItem('bh_custom_shortcuts', JSON.stringify(this.customShortcuts));
    this.renderCustomShortcuts();
    this.showToast(`Added shortcut for ${name}`);
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
      <div class="bh-card" style="padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <h3 style="font-size: 1.4rem; margin-bottom: 0.5rem;">${s.name}</h3>
          <p style="font-size: 0.85rem; font-weight: 700; color: #555; word-break: break-all; margin-bottom: 1rem;">${s.url}</p>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="bh-btn bh-btn-yellow" onclick="App.launchUrl('${s.url}')" style="flex: 1;">OPEN ON TV</button>
          <button class="bh-btn bh-btn-black" onclick="App.deleteCustomShortcut(${s.id})" style="padding: 0.5rem;">✕</button>
        </div>
      </div>
    `).join('');
  },

  deleteCustomShortcut(id) {
    this.customShortcuts = this.customShortcuts.filter(s => s.id !== id);
    localStorage.setItem('bh_custom_shortcuts', JSON.stringify(this.customShortcuts));
    this.renderCustomShortcuts();
  },

  // ---------------------------------------------------------------------------
  // Bauhaus Theme Switcher
  // ---------------------------------------------------------------------------
  initThemeSwitcher() {
    const saved = localStorage.getItem('bh_theme') || 'classic';
    this.setTheme(saved);

    document.querySelectorAll('[data-set-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-set-theme');
        this.setTheme(theme);
      });
    });
  },

  setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('bh_theme', theme);
    this.showToast(`Switched to Bauhaus Theme: ${theme.toUpperCase()}`);
  },

  // ---------------------------------------------------------------------------
  // Toast Notifications
  // ---------------------------------------------------------------------------
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'bh-card';
    toast.style.position = 'fixed';
    toast.style.bottom = '2rem';
    toast.style.right = '2rem';
    toast.style.zIndex = '99999';
    toast.style.margin = '0';
    toast.style.padding = '1rem 1.75rem';
    toast.style.fontWeight = '900';
    toast.style.fontSize = '1.05rem';
    toast.style.textTransform = 'uppercase';
    toast.style.maxWidth = '420px';
    toast.style.backgroundColor = type === 'error' ? 'var(--bh-red)' : (type === 'success' ? 'var(--bh-yellow)' : '#FFFFFF');
    toast.style.color = type === 'error' ? '#FFFFFF' : 'var(--bh-black)';
    toast.innerText = message;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.2s';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, 2800);
  }
};

window.App = App;
window.addEventListener('DOMContentLoaded', () => App.init());

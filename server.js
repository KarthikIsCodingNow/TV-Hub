const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const multer = require('multer');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/cast' });

const PORT = process.env.PORT || 3000;
let TARGET_DEVICE = process.env.TV_IP || '192.168.0.108:5555';

// Find ADB executable path
function findAdbPath() {
  const candidates = [
    process.env.ADB_PATH,
    '/opt/homebrew/bin/adb',
    '/usr/local/bin/adb',
    '/usr/bin/adb',
    'adb'
  ].filter(Boolean);

  for (const c of candidates) {
    if (c === 'adb') return 'adb';
    if (fs.existsSync(c)) return c;
  }
  return 'adb';
}

const ADB_BIN = findAdbPath();
console.log(`[TV-Hub] Using ADB binary: ${ADB_BIN}`);
console.log(`[TV-Hub] Default Target TV: ${TARGET_DEVICE}`);

// Setup upload storage
const uploadDir = path.join(os.tmpdir(), 'tvhub_uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Execute ADB command helper
function runAdb(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ADB_BIN, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `ADB command failed with exit code ${code}`));
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

// Ensure device connection
async function ensureConnected(device = TARGET_DEVICE) {
  try {
    const devList = await runAdb(['devices']);
    if (!devList.includes(device)) {
      await runAdb(['connect', device]);
    }
    return true;
  } catch (err) {
    console.error(`[TV-Hub] Connection check error:`, err.message);
    return false;
  }
}

// Initial connect on startup
ensureConnected(TARGET_DEVICE).then(() => {
  console.log(`[TV-Hub] Connected to TV at ${TARGET_DEVICE}`);
}).catch(e => console.warn(`[TV-Hub] Initial connect: ${e.message}`));

// -----------------------------------------------------------------------------
// API: Device & Status
// -----------------------------------------------------------------------------
app.get('/api/status', async (req, res) => {
  try {
    const devicesOutput = await runAdb(['devices']);
    const isConnected = devicesOutput.includes(TARGET_DEVICE) && !devicesOutput.includes(`${TARGET_DEVICE}\toffline`);
    
    let model = 'Unknown TV';
    let androidVer = 'Unknown';
    let displaySize = '1280x720';
    let cpuAbi = 'armeabi-v7a';

    if (isConnected) {
      try {
        model = await runAdb(['-s', TARGET_DEVICE, 'shell', 'getprop', 'ro.product.model']);
        androidVer = await runAdb(['-s', TARGET_DEVICE, 'shell', 'getprop', 'ro.build.version.release']);
        displaySize = await runAdb(['-s', TARGET_DEVICE, 'shell', 'wm', 'size']);
        cpuAbi = await runAdb(['-s', TARGET_DEVICE, 'shell', 'getprop', 'ro.product.cpu.abi']);
        displaySize = displaySize.replace('Physical size:', '').trim();
      } catch (e) {
        console.warn('[TV-Hub] Partial properties error:', e.message);
      }
    }

    res.json({
      connected: isConnected,
      target: TARGET_DEVICE,
      model,
      androidVersion: androidVer,
      displaySize,
      cpuAbi,
      adbPath: ADB_BIN
    });
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message, target: TARGET_DEVICE });
  }
});

// Connect to a specific TV IP
app.post('/api/connect', async (req, res) => {
  const { ip, port } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP address required' });
  const target = `${ip}:${port || 5555}`;
  try {
    const out = await runAdb(['connect', target]);
    TARGET_DEVICE = target;
    res.json({ success: true, message: out, target: TARGET_DEVICE });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Disconnect
app.post('/api/disconnect', async (req, res) => {
  try {
    const out = await runAdb(['disconnect', TARGET_DEVICE]);
    res.json({ success: true, message: out });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// API: Network TV Discovery
// -----------------------------------------------------------------------------
app.get('/api/discover', async (req, res) => {
  console.log('[TV-Hub] Starting local network TV discovery...');
  const discovered = [];

  // 1. Probe already attached devices from ADB
  try {
    const devOut = await runAdb(['devices']);
    const lines = devOut.split('\n').slice(1);
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && parts[1] === 'device') {
        const devTarget = parts[0];
        try {
          const devModel = await runAdb(['-s', devTarget, 'shell', 'getprop', 'ro.product.model']);
          discovered.push({
            ip: devTarget.split(':')[0],
            port: devTarget.split(':')[1] || '5555',
            target: devTarget,
            model: devModel || 'Android TV',
            source: 'adb-devices',
            connected: devTarget === TARGET_DEVICE
          });
        } catch {
          discovered.push({
            ip: devTarget.split(':')[0],
            port: devTarget.split(':')[1] || '5555',
            target: devTarget,
            model: 'Android TV',
            source: 'adb-devices',
            connected: devTarget === TARGET_DEVICE
          });
        }
      }
    }
  } catch (e) {
    console.warn('[TV-Hub] adb devices check:', e.message);
  }

  // 2. Discover local subnet prefix
  function getSubnetPrefix() {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          const parts = iface.address.split('.');
          parts.pop();
          return parts.join('.');
        }
      }
    }
    return '192.168.0';
  }

  const subnet = getSubnetPrefix();
  console.log(`[TV-Hub] Scanning subnet ${subnet}.1-254 on port 5555...`);

  function probeIp(ip) {
    return new Promise((resolve) => {
      const s = new net.Socket();
      s.setTimeout(350);
      s.on('connect', () => {
        s.destroy();
        resolve(ip);
      });
      s.on('error', () => resolve(null));
      s.on('timeout', () => {
        s.destroy();
        resolve(null);
      });
      s.connect(5555, ip);
    });
  }

  const probes = [];
  for (let i = 1; i <= 254; i++) {
    probes.push(probeIp(`${subnet}.${i}`));
  }

  const activeIps = (await Promise.all(probes)).filter(Boolean);

  for (const ip of activeIps) {
    const target = `${ip}:5555`;
    if (!discovered.some(d => d.ip === ip)) {
      discovered.push({
        ip,
        port: '5555',
        target,
        model: ip === '192.168.0.108' ? 'MiTV-AXSO0' : 'Android TV / ADB Host',
        source: 'subnet-scan',
        connected: target === TARGET_DEVICE
      });
    }
  }

  // Always include user specified IP if not already discovered
  if (!discovered.some(d => d.ip === '192.168.0.108')) {
    discovered.push({
      ip: '192.168.0.108',
      port: '5555',
      target: '192.168.0.108:5555',
      model: 'MiTV-AXSO0 (Configured)',
      source: 'preset',
      connected: TARGET_DEVICE === '192.168.0.108:5555'
    });
  }

  res.json({ discovered, count: discovered.length, subnet });
});

// -----------------------------------------------------------------------------
// API: Remote Key & Input Controls
// -----------------------------------------------------------------------------
const KEYCODE_MAP = {
  'UP': 19,
  'DPAD_UP': 19,
  'DOWN': 20,
  'DPAD_DOWN': 20,
  'LEFT': 21,
  'DPAD_LEFT': 21,
  'RIGHT': 22,
  'DPAD_RIGHT': 22,
  'SELECT': 23,
  'OK': 23,
  'ENTER': 66,
  'DPAD_CENTER': 23,
  'BACK': 4,
  'HOME': 3,
  'MENU': 82,
  'POWER': 26,
  'WAKEUP': 224,
  'SLEEP': 223,
  'VOLUME_UP': 24,
  'VOLUME_DOWN': 25,
  'MUTE': 164,
  'VOLUME_MUTE': 164,
  'PLAY_PAUSE': 85,
  'PLAY': 126,
  'PAUSE': 127,
  'REWIND': 89,
  'FAST_FORWARD': 90
};

app.post('/api/remote/key', async (req, res) => {
  const { key, keycode } = req.body;
  const code = keycode || KEYCODE_MAP[String(key).toUpperCase()] || key;
  try {
    await runAdb(['-s', TARGET_DEVICE, 'shell', 'input', 'keyevent', String(code)]);
    res.json({ success: true, key, keycode: code });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Send text to input field
app.post('/api/remote/text', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text required' });
  try {
    // Escape shell characters or replace spaces with %s
    const safeText = text.replace(/ /g, '%s').replace(/([&|;<>\$`!"'\(\)\[\]])/g, '\\$1');
    await runAdb(['-s', TARGET_DEVICE, 'shell', 'input', 'text', safeText]);
    res.json({ success: true, text });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Tap coordinates
app.post('/api/remote/tap', async (req, res) => {
  const { x, y } = req.body;
  if (x === undefined || y === undefined) return res.status(400).json({ error: 'x, y required' });
  try {
    await runAdb(['-s', TARGET_DEVICE, 'shell', 'input', 'tap', String(Math.round(x)), String(Math.round(y))]);
    res.json({ success: true, x, y });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Swipe coordinates
app.post('/api/remote/swipe', async (req, res) => {
  const { x1, y1, x2, y2, duration = 300 } = req.body;
  try {
    await runAdb([
      '-s', TARGET_DEVICE, 'shell', 'input', 'swipe',
      String(Math.round(x1)), String(Math.round(y1)),
      String(Math.round(x2)), String(Math.round(y2)),
      String(duration)
    ]);
    res.json({ success: true, x1, y1, x2, y2, duration });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// API: File Transfer & Push to TV
// -----------------------------------------------------------------------------
app.post('/api/files/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const tempPath = req.file.path;
  const originalName = req.file.originalname;
  const remoteDest = `/sdcard/Download/${originalName}`;

  try {
    console.log(`[TV-Hub] Pushing ${originalName} (${req.file.size} bytes) to ${remoteDest}...`);
    await runAdb(['-s', TARGET_DEVICE, 'push', tempPath, remoteDest]);
    fs.unlinkSync(tempPath);
    res.json({
      success: true,
      message: `File pushed to ${remoteDest}`,
      filename: originalName,
      size: req.file.size,
      remotePath: remoteDest
    });
  } catch (err) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// API: App Management & Adblock TV Browser
// -----------------------------------------------------------------------------
// List installed apps
app.get('/api/apps/list', async (req, res) => {
  try {
    const thirdPartyOut = await runAdb(['-s', TARGET_DEVICE, 'shell', 'pm', 'list', 'packages', '-3']);
    const thirdParty = thirdPartyOut
      .split('\n')
      .map(l => l.replace('package:', '').trim())
      .filter(Boolean);

    res.json({
      success: true,
      thirdParty,
      count: thirdParty.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Install APK from upload
app.post('/api/apps/install', upload.single('apk'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No APK file uploaded' });

  const tempPath = req.file.path;
  try {
    console.log(`[TV-Hub] Installing APK ${req.file.originalname}...`);
    const out = await runAdb(['-s', TARGET_DEVICE, 'install', '-r', tempPath]);
    fs.unlinkSync(tempPath);
    res.json({ success: true, message: out, filename: req.file.originalname });
  } catch (err) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Uninstall app
app.post('/api/apps/uninstall', async (req, res) => {
  const { packageName } = req.body;
  if (!packageName) return res.status(400).json({ error: 'Package name required' });
  try {
    const out = await runAdb(['-s', TARGET_DEVICE, 'uninstall', packageName]);
    res.json({ success: true, message: out });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Disable app safely
app.post('/api/apps/disable', async (req, res) => {
  const { packageName } = req.body;
  if (!packageName) return res.status(400).json({ error: 'Package name required' });
  try {
    const out = await runAdb(['-s', TARGET_DEVICE, 'shell', 'pm', 'disable-user', '--user', '0', packageName]);
    res.json({ success: true, message: out });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1-Click Install Top-Rated Adblock TV Browser (TV Bro)
app.post('/api/apps/install-tvbro', async (req, res) => {
  try {
    console.log('[TV-Hub] Detecting CPU architecture for TV Bro installer...');
    let abi = 'armeabi-v7a';
    try {
      abi = await runAdb(['-s', TARGET_DEVICE, 'shell', 'getprop', 'ro.product.cpu.abi']);
    } catch {}

    let apkUrl = 'https://github.com/truefedex/tv-bro/releases/download/v2.1.6/tvbro-2.1.6-generic-geckoIncluded-armeabi-v7a.apk';
    if (abi.includes('arm64')) {
      apkUrl = 'https://github.com/truefedex/tv-bro/releases/download/v2.1.6/tvbro-2.1.6-generic-geckoIncluded-arm64-v8a.apk';
    }

    const tempApk = path.join(uploadDir, `tvbro_${Date.now()}.apk`);
    console.log(`[TV-Hub] Downloading TV Bro (${abi}) from ${apkUrl}...`);

    // Download using curl / fetch
    await new Promise((resolve, reject) => {
      exec(`curl -L -s -o "${tempApk}" "${apkUrl}"`, (err, stdout, stderr) => {
        if (err) return reject(new Error(`Download failed: ${stderr || err.message}`));
        resolve();
      });
    });

    console.log('[TV-Hub] Sideloading TV Bro to TV...');
    const out = await runAdb(['-s', TARGET_DEVICE, 'install', '-r', tempApk]);
    if (fs.existsSync(tempApk)) fs.unlinkSync(tempApk);

    res.json({
      success: true,
      message: 'TV Bro (Top-Rated Adblock TV Browser) successfully installed!',
      packageName: 'com.phlox.tvwebbrowser',
      output: out
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// API: Website Shortcuts
// -----------------------------------------------------------------------------
app.post('/api/shortcuts/launch', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  try {
    await runAdb(['-s', TARGET_DEVICE, 'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url]);
    res.json({ success: true, url });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// API: Screen Snapshot Fallback
// -----------------------------------------------------------------------------
app.get('/api/screen/shot', (req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const screencap = spawn(ADB_BIN, ['-s', TARGET_DEVICE, 'exec-out', 'screencap', '-p']);
  screencap.stdout.pipe(res);
  screencap.stderr.on('data', (d) => console.warn('[TV-Hub] screencap stderr:', d.toString()));
});

// -----------------------------------------------------------------------------
// WebSocket: Ultra-low latency Cast & Interactive Control Stream
// -----------------------------------------------------------------------------
wss.on('connection', (ws) => {
  console.log('[TV-Hub] WebSocket client connected for Cast & Remote');
  let screenrecordProc = null;
  let isCasting = false;
  let restartTimeout = null;

  function startH264Stream() {
    if (screenrecordProc) {
      try { screenrecordProc.kill('SIGINT'); } catch {}
      screenrecordProc = null;
    }
    if (!isCasting || ws.readyState !== WebSocket.OPEN) return;

    console.log('[TV-Hub] Starting screenrecord H.264 stream...');
    screenrecordProc = spawn(ADB_BIN, [
      '-s', TARGET_DEVICE,
      'exec-out',
      'screenrecord',
      '--output-format=h264',
      '--bit-rate', '2000000',
      '--time-limit', '180',
      '-'
    ]);

    screenrecordProc.stdout.on('data', (chunk) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk, { binary: true });
      }
    });

    screenrecordProc.stderr.on('data', (err) => {
      console.warn('[TV-Hub] screenrecord stderr:', err.toString().trim());
    });

    screenrecordProc.on('close', (code) => {
      console.log(`[TV-Hub] screenrecord process exited (${code}).`);
      if (isCasting && ws.readyState === WebSocket.OPEN) {
        restartTimeout = setTimeout(startH264Stream, 150);
      }
    });
  }

  function stopH264Stream() {
    isCasting = false;
    if (restartTimeout) clearTimeout(restartTimeout);
    if (screenrecordProc) {
      try { screenrecordProc.kill('SIGINT'); } catch {}
      screenrecordProc = null;
    }
  }

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      // Start screen streaming
      if (data.action === 'start_stream') {
        isCasting = true;
        startH264Stream();
        ws.send(JSON.stringify({ event: 'stream_started' }));
      }
      // Stop screen streaming
      else if (data.action === 'stop_stream') {
        stopH264Stream();
        ws.send(JSON.stringify({ event: 'stream_stopped' }));
      }
      // Interactive mouse tap
      else if (data.action === 'tap') {
        const { x, y } = data;
        if (x !== undefined && y !== undefined) {
          runAdb(['-s', TARGET_DEVICE, 'shell', 'input', 'tap', String(Math.round(x)), String(Math.round(y))]).catch(() => {});
        }
      }
      // Interactive mouse drag / swipe
      else if (data.action === 'swipe') {
        const { x1, y1, x2, y2, duration = 250 } = data;
        runAdb([
          '-s', TARGET_DEVICE, 'shell', 'input', 'swipe',
          String(Math.round(x1)), String(Math.round(y1)),
          String(Math.round(x2)), String(Math.round(y2)),
          String(duration)
        ]).catch(() => {});
      }
      // Interactive keyboard key
      else if (data.action === 'key') {
        const code = KEYCODE_MAP[String(data.key).toUpperCase()] || data.keycode || data.key;
        runAdb(['-s', TARGET_DEVICE, 'shell', 'input', 'keyevent', String(code)]).catch(() => {});
      }
      // Direct text typing
      else if (data.action === 'text') {
        const safeText = String(data.text).replace(/ /g, '%s').replace(/([&|;<>\$`!"'\(\)\[\]])/g, '\\$1');
        runAdb(['-s', TARGET_DEVICE, 'shell', 'input', 'text', safeText]).catch(() => {});
      }
    } catch (e) {
      console.warn('[TV-Hub] ws message parse error:', e.message);
    }
  });

  ws.on('close', () => {
    console.log('[TV-Hub] WebSocket client disconnected');
    stopH264Stream();
  });
});

// Start listening
server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`   TV-HUB [BAUHAUS EDITION] RUNNING                `);
  console.log(`   Local URL:   http://localhost:${PORT}           `);
  console.log(`   Network TV:  ${TARGET_DEVICE}                   `);
  console.log(`====================================================`);
});

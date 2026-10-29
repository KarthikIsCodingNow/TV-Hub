# TV-HUB // BAUHAUS CONTROLLER & SCREEN CAST

> **"Form Follows Function"** — A Constructivist, geometric laptop companion and web application to control, cast, and manage Android TV devices over ADB and local Wi-Fi.

![Bauhaus Palette](https://img.shields.io/badge/Design-Bauhaus-D02020?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-v18+-1040C0?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-F0C020?style=for-the-badge&labelColor=121212)

---

## 🟥 Architecture & Bauhaus Design System

TV-Hub is built with strict adherence to the **Bauhaus Constructivist Design System**:

- **Palette**:
  - Bauhaus Red (`#D02020`), Blue (`#1040C0`), Yellow (`#F0C020`)
  - Stark Black (`#121212`), Off-White (`#F0F0F0`)
  - Solid color blocking across functional sections
- **Typography**:
  - 'Outfit' (Geometric Sans) with massive uppercase headlines and tight tracking (`tracking-tighter`)
- **Geometry**:
  - Pure Circles, Squares, and Triangles
  - **Strictly Binary Radius**: `0px` (Square) or `9999px` (Circle/Pill). No rounded corners.
  - Thick black borders (`4px` desktop / `2px` mobile)
- **Depth**:
  - Hard, black offset shadows (`4px 4px 0px 0px #121212`, `6px 6px 0px 0px #121212`)
  - Physical tactile press effect on all buttons (`translate` + shadow removal)

---

## ⚡ Features

### 1. 🎛️ Tactile D-Pad Remote & Keyboard Control
- Full constructivist 3x3 D-Pad matrix: Up, Down, Left, Right, OK / Select.
- Dedicated TV action keys: **POWER**, **MUTE**, **HOME**, **BACK**, **VOLUME + / -**, **MENU**, **PLAY / PAUSE**.
- **Laptop Keyboard Forwarding**: Control the TV anywhere in the app with your laptop keyboard:
  - `Arrow Keys`: D-Pad Navigation
  - `Enter`: Select / OK
  - `Esc` / `Backspace`: Back
  - `Home`: TV Home
  - `+` / `-`: Volume Up / Down
  - `M`: Mute / Unmute
  - `Space`: Play / Pause

### 2. 📺 Screen Cast & Interactive Trackpad/Mouse Control
- Real-time TV screen mirroring directly onto your laptop display.
- **Trackpad / Cursor Control**:
  - **Mouse Click**: Sends instantaneous `input tap X Y` scaled to your TV's native resolution (`1280x720`).
  - **Click & Drag**: Sends `input swipe X1 Y1 X2 Y2 duration` to scroll, swipe feeds, and drag sliders.
  - **Trackpad Wheel**: Scrolls lists and sends D-Pad pulses.
- Fullscreen mode, snapshot refresh, and ultra-low latency WebSocket stream.

### 3. 📋 Text & Clipboard Sender
- **Auto-Type**: Type text on your laptop keyboard and send it directly into TV search bars and form fields.
- **1-Click Clipboard Sync**: Paste whatever is currently in your laptop's clipboard directly to the TV (ideal for long URLs, passwords, or Wi-Fi keys).

### 4. 📁 File Sender to TV
- Drag-and-drop any video, audio, image, APK, or document.
- Automatically pushes the file to `/sdcard/Download/` on the TV via ADB.

### 5. 🛡️ 1-Click Top-Rated Adblock TV Browser (TV Bro)
- One-click installer for **TV Bro** — the highest-rated open-source web browser built for Android TV remotes.
- Automatically detects TV architecture (`armeabi-v7a` / `arm64-v8a`), fetches the official release, and sideloads it directly to the TV.
- Built-in adblocker, smooth cursor navigation, and hardware video playback.

### 6. 📦 App Management & APK Sideloading
- Sideload any `.apk` file from your laptop with drag-and-drop.
- List installed third-party apps with one-click **Launch**, **Disable**, or **Uninstall** controls.

### 7. 🌐 Website Shortcuts
- Launch web portals on the TV with a single click (YouTube Ad-Free, Twitch TV, Reddit Media, Wikipedia).
- Create and save custom website shortcuts with custom color blocks.

### 8. 🔍 Network TV Auto-Discovery
- One-click **Auto-Detect TVs on Network**: Scans local subnet (`192.168.0.1-254`) on port 5555 and ADB mDNS to locate all Android TVs in under 500ms.
- Connect to discovered TVs or manually enter custom IP / port (preconfigured for `192.168.0.108`).

### 9. 🎨 Bauhaus Theme Switcher
- **Classic Bauhaus**: Primary Red, Blue, Yellow, Stark Black, and Off-White.
- **De Stijl / Mondrian**: Deep Vermilion, Cobalt, Canary, and Cream.
- **Constructivist**: Soviet Constructivist Ochre, Industrial Red, and Charcoal.
- **Monolith Monochrome**: Ultra-high-contrast Black and White.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- Android Debug Bridge (`adb`) installed on laptop

### Running TV-Hub
```bash
# Clone the repository
git clone https://github.com/KarthikIsCodingNow/TV-Hub.git
cd TV-Hub

# Start with the one-click runner (auto-installs dependencies and opens browser)
./start.sh
```

Or manually:
```bash
npm install
node server.js
```

Open `http://localhost:3000` in your browser.

---

## 🔒 Safety & Privacy
- **No Internet Access Needed**: Runs 100% locally on your laptop and local Wi-Fi.
- **No Tracking**: Zero analytics, telemetry, or third-party cookies.
- **Clean Disconnect**: Disconnect ADB at any time with a single button.

---

## 📄 License
Released under the [MIT License](LICENSE).

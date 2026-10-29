# TV-Hub — Retro Desktop TV Controller

> A retro-computing desktop companion to control, mirror, and manage Android TV devices over ADB and local Wi-Fi, built with the authentic visual language of the **Retro Desktop Design System**.

![Retro Desktop](https://img.shields.io/badge/Style-Retro%20Desktop-000080?style=for-the-badge)
![Teal Desktop](https://img.shields.io/badge/Desktop-Teal%20%23008080-008080?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-ffff00?style=for-the-badge&labelColor=000000)

---

## 🖥️ Retro Desktop Design System

TV-Hub adopts an overcrowded desktop of offset windows, hard bevels, grey frames (`#d4d4d4`), white reading wells, and bright yellow (`#ffff00`), navy (`#000080`), pink (`#ff00b8`), and teal (`#008080`) fields:

- **Typography**:
  - `Host Grotesk` (`"Retro Display"`, sans-serif) for heavy display headings.
  - `IBM Plex Sans` (`"Retro Interface"`, sans-serif) for reading and interface labels.
  - `IBM Plex Mono` (`"Retro Mono"`, monospace) for compact hardware metadata and status terminals.
- **Surfaces & Bevels**:
  - Grey window frames (`#d4d4d4`) with 2px hard bevels (light top-left `#ffffff`, dark bottom-right `#808080` & `#000000`).
  - Inset reading wells with reversed 3D bevels for high contrast readability.
  - Solid color fields (Yellow launch window, Navy titlebars, Pink activity strip, Teal fields).
- **Raised Keys**:
  - Buttons resemble physical raised keys with squared bevels (`border: 2px solid`, `border-radius: 0`).
  - Actuating a key moves it by 1px and reverses its bevel depth.
- **Authoritative Tokens**:
  - `--dp-color-window: #d4d4d4;`
  - `--dp-color-ink: #000000;`
  - `--dp-color-bevel-dark: #808080;`
  - `--dp-color-bevel-light: #ffffff;`
  - `--dp-color-accent: #6600ff;`
  - `--dp-color-highlight: #ffff00;`
  - `--dp-color-link-hover: #0000ff;`
  - `--dp-color-desktop: #008080;`
  - `--dp-color-emphasis: #ff00b8;`
  - `--dp-color-titlebar: #000080;`
  - `--dp-radius-control: 0;`

---

## ⚡ Features & Workspaces

### 1. ◫ Overview Dashboard
- **Broad Yellow Launch Window**: Primary TV commands, display header with ticker arrow, and quick action keys.
- **Hardware Facts Panel**: CRT terminal readout with TV model (`MiTV-AXSO0`), Android OS, native resolution (`1280x720`), CPU ABI, and connection ping.
- **Pink Activity Strip**: Guestbook-style timeline of recent TV operations and commands.
- **Capability Window & Mini D-Pad**: Quick launchers for YouTube, Clipboard, TV Bro, and File dispatcher.

### 2. 🎛️ Remote Control Console
- **Directional Pad**: Raised bevel cross (▲, ▼, ◄, ►) with center purple Select key (`--dp-color-accent: #6600ff`).
- **Keys**: Power (red accent), Mute, Back, Home, Menu, Play/Pause, Volume Rocker.
- **Keyboard Forwarding**: Full keyboard control (Arrow keys, Enter, Backspace/Esc, Home, +/-, M, Space). Automatically disengages when typing in input wells.

### 3. 📺 CRT Screen Mirror & Trackpad
- **Retro CRT Monitor Casing**: Low-latency binary H.264 video streaming over WebSocket (`/ws/cast`) decoded via **JMuxer**.
- **Interactive Trackpad**: Normalized screen coordinates for mouse click (tap) and drag (swipe) mapped to native `1280x720` resolution. Crosshair targeting reticle.

### 4. ⌨️ Text & Clipboard Transmitter
- Inset input box for auto-typing text into TV.
- 1-click clipboard synchronization buffer.

### 5. 📁 File Dispatcher & ADB Push
- Dropzone with retro folder graphics and segmented progress motif pushing to `/sdcard/Download/`.

### 6. 📦 App Management & TV Bro Setup
- 1-click automated installer for **TV Bro** (top-rated adblock TV browser).
- APK sideloading dropzone and installed applications list.

### 7. 🌐 Web Navigator Favorites
- Bookmarks for YouTube, Twitch, and Reddit, plus custom bookmark creator.

### 8. 📡 Subnet Probe (Network Scanner)
- Scans `/24` subnet on port 5555 and mDNS in ~300ms.

### 9. 🔍 Run Command Palette (`⌘K`)
- Retro Windows Run dialog to search and execute any command quickly.

---

## 🚀 Quick Start

### Running TV-Hub
```bash
git clone https://github.com/KarthikIsCodingNow/TV-Hub.git
cd TV-Hub

# Start with launcher
./start.sh
```

Or via Node:
```bash
npm install
node server.js
```

Open `http://localhost:3000` in your browser.

---

## 📄 License
Released under the [MIT License](LICENSE).

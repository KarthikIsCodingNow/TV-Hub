# TV-Hub — Android TV Companion (iOS 18 Edition)

> A polished, modern, and intuitive companion application to control, mirror, and manage Android TV devices over ADB and local Wi-Fi, crafted with the visual language and interaction patterns of **iOS 18**.

![iOS 18 Design](https://img.shields.io/badge/Design-iOS%2018%20Liquid%20Glass-007AFF?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-v18+-5856D6?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-34C759?style=for-the-badge)

---

##  Visual Design System & Aesthetics

TV-Hub combines the clarity of a modern macOS utility with the fluid, approachable interaction patterns of **iOS 18**:

- **Layered Translucency & Materials**: Soft frosted glass surfaces (`backdrop-filter: blur(20px) saturate(190%)`), subtle border highlights, and refined shadows.
- **SF Pro Typography**: Apple system font stack with comfortable hierarchy, clear weights, and tabular numerals for technical metrics.
- **Apple TV / Siri Remote**: Tactile circular directional pad with haptic-style depression, playback controls, and an integrated volume rocker.
- **Light, Dark & System Appearance**: Full support for Dark Mode with ambient contrast and automatic OS color-scheme following.
- **Accent Customization**: Choose between Apple Blue (`#007AFF`), Purple (`#AF52DE`), Green (`#34C759`), and Orange (`#FF9500`).
- **Smooth Micro-Interactions**: Native scale responses (`active: scale(0.97)`), spring transitions, and zero sluggishness.

---

## ⚡ Key Capabilities

### 1. 🎛️ Overview Dashboard
- **Active TV Card**: Live status, TV model (`MiTV-AXSO0`), IP address (`192.168.0.108`), resolution, Android version, and quick action pills.
- **Quick Action Tiles**: 1-click shortcuts to YouTube, Clipboard sync, TV Bro, and File uploads.
- **Embedded Remote Widget**: Mini D-Pad directly on the landing screen for instant control.
- **Recent Activity Feed**: Lightweight timeline of your recent TV commands and connections.

### 2. 📺 Apple TV-Inspired Remote Control
- **Directional Pad**: Precision circular D-Pad with Up, Down, Left, Right, and central Select button.
- **Dedicated Controls**: Power, Mute, TV/Home, Back, Menu, Play/Pause, and vertical Volume Rocker.
- **Laptop Keyboard Forwarding**: Control your TV naturally from your keyboard (Arrow keys, Enter, Esc, Home, Space, Mute, Volume +/-). Automatically disables while typing in text fields.

### 3. 🪞 Screen Mirror & Interactive Trackpad
- **Real-Time H.264 Video Stream**: Low-latency binary WebSocket streaming decoded via **JMuxer** using browser hardware acceleration.
- **Interactive Trackpad & Cursor**:
  - **Click**: Normalizes coordinates to the TV's native resolution (`1280x720`) and executes `input tap X Y`.
  - **Drag**: Executes `input swipe X1 Y1 X2 Y2 duration` to scroll through feeds and channels.
  - **Trackpad Wheel**: Emulates D-Pad scrolling.
- **Controls**: Start/Stop mirror, Refresh Frame snapshot, Fullscreen mode.

### 4. 📋 Text & Clipboard Sync
- **Auto-Type Field**: Type queries or passwords on your laptop and hit **Enter** to type them on the TV.
- **1-Click Clipboard Sync**: Paste your laptop's clipboard directly into any active input on your TV.

### 5. 📁 AirDrop-Style File Sender
- Elegant drag-and-drop zone with animated dashed glass border.
- Uploads and pushes videos, photos, APKs, and documents directly to `/sdcard/Download/` via ADB.
- Progress bar and transfer status.

### 6. 🛡️ Apps & Top-Rated Adblock Browser (TV Bro)
- **TV Bro Hero Card**: 1-click automated installer for the top-rated open-source adblocking TV browser.
- **APK Sideload Dropzone**: Drag and drop any `.apk` file to install it directly onto the TV.
- **Installed Applications Manager**: Search and filter installed user apps with 1-click **Launch** and **Uninstall** (with native iOS confirmation sheet).

### 7. 🌐 Website Shortcuts (Safari Bookmarks)
- Clean rounded tiles for YouTube (Ad-free portal), Twitch, and Reddit.
- Add and manage custom website bookmarks with instant launch on the TV.

### 8. 🔍 Network TV Auto-Discovery
- High-speed concurrent subnet scanner that discovers Android TVs on port 5555 and ADB mDNS in ~300ms.
- 1-click connect to discovered devices, or manual IP/port entry.

### 9. ⌘K Global Command Palette
- Spotlight-style command palette triggered via `⌘K` or `Ctrl+K`.
- Search destinations, TV actions, bookmarks, and appearance settings with keyboard navigation.

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

# Start the application (auto-opens http://localhost:3000 in your browser)
./start.sh
```

Or via npm:
```bash
npm install
node server.js
```

Open `http://localhost:3000` in your browser.

---

## 📄 License
Released under the [MIT License](LICENSE).

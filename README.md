# Gemini Desktop

A standalone desktop application for [Google Gemini](https://gemini.google.com/app) built with Electron.

## Features

- 🖥️ Native desktop experience for Google Gemini
- 🔐 Persistent login sessions
- ⌨️ Full keyboard shortcuts support
- 📱 Cross-platform (Windows, macOS, Linux)
- 🔗 External links open in your default browser

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- npm (comes with Node.js)

### Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/gemini-desktop.git
   cd gemini-desktop
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the app:
   ```bash
   npm start
   ```

## Building for Distribution

### Build for your current platform:
```bash
npm run build
```

### Platform-specific builds:
```bash
# Windows
npm run package

# Linux
npm run package:linux

# SteamOS / Steam Deck (recommended)
./build-steamos.sh

# All platforms
npm run package:all
```

Built applications will be in the `dist/` folder.

## SteamOS / Steam Deck

This app is optimized for SteamOS and Steam Deck. Use the dedicated build script:

### Quick Build on Steam Deck

1. Switch to Desktop Mode
2. Open Konsole (terminal)
3. Navigate to the project directory:
   ```bash
   cd /path/to/gemini-desktop
   ```
4. Run the build script:
   ```bash
   ./build-steamos.sh
   ```

### Adding to Steam

After building, you can add Gemini Desktop as a non-Steam game:

1. Open Steam in Desktop Mode
2. Click **Games** → **Add a Non-Steam Game to My Library**
3. Click **Browse** and navigate to:
   ```
   dist/Gemini Desktop-linux-x64/Gemini Desktop
   ```
4. Click **Add Selected Programs**

### Prerequisites for SteamOS

If Node.js is not installed, you can install it via nvm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install --lts
```

### Encrypted Storage on Linux

For encrypted settings storage, install a keyring service:

```bash
# On Arch/SteamOS (Desktop Mode)
sudo pacman -S gnome-keyring
# or
sudo pacman -S kwallet
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` / `Cmd+N` | New Chat |
| `Ctrl+R` / `Cmd+R` | Reload |
| `Ctrl++` / `Cmd++` | Zoom In |
| `Ctrl+-` / `Cmd+-` | Zoom Out |
| `Ctrl+0` / `Cmd+0` | Reset Zoom |
| `F11` | Toggle Fullscreen |
| `Ctrl+Shift+I` / `Cmd+Shift+I` | Developer Tools |
| `Ctrl+Q` / `Cmd+Q` | Quit |

## Custom Icons

To use custom icons for the built application, add your icons to the `assets/` folder:

- `icon.ico` - Windows icon (256x256 recommended)
- `icon.icns` - macOS icon
- `icon.png` - Linux icon (512x512 recommended)

## License

MIT License

## Disclaimer

This is an unofficial desktop wrapper for Google Gemini. Google Gemini is a trademark of Google LLC.

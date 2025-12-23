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
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

Built applications will be in the `dist/` folder.

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

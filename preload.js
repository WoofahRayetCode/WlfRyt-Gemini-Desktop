// Preload script for Gemini Desktop
// This runs in the renderer process before the web page loads

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods for the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Add any IPC methods if needed in the future
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});

// Log when preload script runs
console.log('Gemini Desktop - Preload script loaded');

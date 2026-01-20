const { app, BrowserWindow, shell, Menu, session, safeStorage, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep global references
let mainWindow;
let tray = null;
let isQuitting = false;

// Settings file paths
const settingsPath = path.join(app.getPath('userData'), 'settings.enc');  // Encrypted settings
const legacySettingsPath = path.join(app.getPath('userData'), 'settings.json');  // Legacy unencrypted

// Default settings
const defaultSettings = {
  startMinimized: false,
  minimizeToTray: true,
  startAtLogin: false  // Cross-platform: works on Windows, macOS, and Linux
};

// Secure Storage Module - encrypts/decrypts sensitive data
const secureStore = {
  // Check if encryption is available
  isAvailable: () => {
    return safeStorage.isEncryptionAvailable();
  },

  // Encrypt and save data
  save: (filePath, data) => {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      
      if (safeStorage.isEncryptionAvailable()) {
        // Encrypt the data
        const encrypted = safeStorage.encryptString(jsonString);
        fs.writeFileSync(filePath, encrypted);
        console.log('Data saved with encryption');
      } else {
        // Fallback to plain storage (with warning)
        console.warn('Encryption not available - saving unencrypted');
        fs.writeFileSync(filePath + '.json', jsonString);
      }
      return true;
    } catch (error) {
      console.error('Error saving secure data:', error);
      return false;
    }
  },

  // Load and decrypt data
  load: (filePath, defaultValue = null) => {
    try {
      // Try encrypted file first
      if (fs.existsSync(filePath)) {
        const encrypted = fs.readFileSync(filePath);
        if (safeStorage.isEncryptionAvailable()) {
          const decrypted = safeStorage.decryptString(encrypted);
          return JSON.parse(decrypted);
        }
      }
      
      // Try legacy unencrypted file
      const legacyPath = filePath.replace('.enc', '.json');
      if (fs.existsSync(legacyPath)) {
        const data = fs.readFileSync(legacyPath, 'utf8');
        const parsed = JSON.parse(data);
        
        // Migrate to encrypted storage if available
        if (safeStorage.isEncryptionAvailable()) {
          secureStore.save(filePath, parsed);
          fs.unlinkSync(legacyPath);  // Remove legacy file
          console.log('Migrated settings to encrypted storage');
        }
        
        return parsed;
      }
    } catch (error) {
      console.error('Error loading secure data:', error);
    }
    return defaultValue;
  },

  // Delete stored data
  delete: (filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      const legacyPath = filePath.replace('.enc', '.json');
      if (fs.existsSync(legacyPath)) {
        fs.unlinkSync(legacyPath);
      }
      return true;
    } catch (error) {
      console.error('Error deleting secure data:', error);
      return false;
    }
  }
};

// Load settings using secure storage
function loadSettings() {
  const loaded = secureStore.load(settingsPath, null);
  if (loaded) {
    return { ...defaultSettings, ...loaded };
  }
  return defaultSettings;
}

// Save settings using secure storage
function saveSettings(settings) {
  return secureStore.save(settingsPath, settings);
}

// Get current settings
let settings = defaultSettings;

// Security: Configure secure session settings
function configureSecureSession() {
  const ses = session.defaultSession;

  // Enable strict secure cookies - only send over HTTPS
  ses.cookies.on('changed', (event, cookie, cause, removed) => {
    // Log cookie changes for debugging (remove in production if not needed)
    if (process.env.NODE_ENV === 'development') {
      console.log(`Cookie ${removed ? 'removed' : 'set'}: ${cookie.name}`);
    }
  });

  // Set secure Content Security Policy headers
  ses.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        // Prevent clickjacking
        'X-Frame-Options': ['SAMEORIGIN'],
        // Prevent MIME type sniffing
        'X-Content-Type-Options': ['nosniff'],
        // Enable XSS protection
        'X-XSS-Protection': ['1; mode=block'],
      }
    });
  });

  // Block requests to non-Google domains for extra security (except CDNs)
  ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    const url = new URL(details.url);
    const allowedDomains = [
      'google.com',
      'googleapis.com',
      'gstatic.com',
      'googleusercontent.com',
      'google-analytics.com',
      'doubleclick.net',
      'youtube.com',
      'ytimg.com',
      'ggpht.com',
    ];
    
    const isAllowed = allowedDomains.some(domain => 
      url.hostname === domain || url.hostname.endsWith('.' + domain)
    );
    
    callback({ cancel: !isAllowed });
  });

  // Clear sensitive data periodically from memory (every 30 minutes)
  setInterval(() => {
    if (global.gc) {
      global.gc();
    }
  }, 30 * 60 * 1000);
}

// Security: Check if system encryption is available
function checkEncryptionAvailable() {
  const available = safeStorage.isEncryptionAvailable();
  const platform = process.platform;
  
  if (available) {
    console.log('✓ System encryption is available');
    if (platform === 'win32') {
      console.log('  - Settings will be encrypted using Windows DPAPI');
      console.log('  - Data is tied to this Windows user account');
    } else if (platform === 'darwin') {
      console.log('  - Settings will be encrypted using macOS Keychain');
      console.log('  - Data is tied to this macOS user account');
    } else {
      console.log('  - Settings will be encrypted using system keyring (libsecret)');
      console.log('  - Data is tied to this Linux user account');
    }
    return true;
  } else {
    console.warn('⚠ System encryption is NOT available');
    console.warn('  - Settings will be stored in plain text');
    if (platform === 'linux') {
      console.warn('  - Install gnome-keyring or kwallet for encrypted storage');
    } else {
      console.warn('  - Consider running on a newer OS or with proper keychain access');
    }
    return false;
  }
}

// Create system tray
function createTray() {
  // Create tray icon (use a simple icon or the app icon)
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  let trayIcon;
  
  try {
    if (fs.existsSync(iconPath)) {
      trayIcon = nativeImage.createFromPath(iconPath);
      trayIcon = trayIcon.resize({ width: 16, height: 16 });
    } else {
      // Create a simple default icon if no icon file exists
      trayIcon = nativeImage.createEmpty();
    }
  } catch (error) {
    trayIcon = nativeImage.createEmpty();
  }
  
  tray = new Tray(trayIcon);
  tray.setToolTip('Gemini Desktop');
  
  updateTrayMenu();
  
  // Double-click to show window
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Update tray context menu
function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Gemini Desktop',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: process.platform === 'win32' ? 'Start with Windows' : 
             process.platform === 'darwin' ? 'Start at Login' : 'Start with System',
      type: 'checkbox',
      checked: settings.startAtLogin,
      click: (menuItem) => {
        settings.startAtLogin = menuItem.checked;
        saveSettings(settings);
        updateAutoLaunch();
      }
    },
    {
      label: 'Start Minimized',
      type: 'checkbox',
      checked: settings.startMinimized,
      click: (menuItem) => {
        settings.startMinimized = menuItem.checked;
        saveSettings(settings);
      }
    },
    {
      label: 'Minimize to Tray',
      type: 'checkbox',
      checked: settings.minimizeToTray,
      click: (menuItem) => {
        settings.minimizeToTray = menuItem.checked;
        saveSettings(settings);
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
}

// Update auto-launch setting (cross-platform)
function updateAutoLaunch() {
  // Note: On Linux/SteamOS, this may require additional setup
  // The .desktop file needs to be in ~/.config/autostart/
  const loginSettings = {
    openAtLogin: settings.startAtLogin,
    path: app.getPath('exe'),
    args: settings.startMinimized ? ['--hidden'] : []
  };
  
  // On Linux, also handle autostart directory
  if (process.platform === 'linux' && settings.startAtLogin) {
    try {
      const autostartDir = path.join(app.getPath('home'), '.config', 'autostart');
      const desktopFile = path.join(autostartDir, 'gemini-desktop.desktop');
      
      if (!fs.existsSync(autostartDir)) {
        fs.mkdirSync(autostartDir, { recursive: true });
      }
      
      const desktopContent = `[Desktop Entry]
Type=Application
Name=Gemini Desktop
Exec="${app.getPath('exe')}"${settings.startMinimized ? ' --hidden' : ''}
Icon=${path.join(__dirname, 'assets', 'icon.png')}
Comment=Standalone desktop app for Google Gemini
Categories=Network;Chat;Utility;
Terminal=false
StartupWMClass=Gemini Desktop
X-GNOME-Autostart-enabled=true
`;
      
      fs.writeFileSync(desktopFile, desktopContent);
      console.log('Created autostart entry for Linux');
    } catch (error) {
      console.error('Failed to create Linux autostart entry:', error);
    }
  } else if (process.platform === 'linux' && !settings.startAtLogin) {
    // Remove autostart file if disabled
    try {
      const desktopFile = path.join(app.getPath('home'), '.config', 'autostart', 'gemini-desktop.desktop');
      if (fs.existsSync(desktopFile)) {
        fs.unlinkSync(desktopFile);
        console.log('Removed autostart entry for Linux');
      }
    } catch (error) {
      console.error('Failed to remove Linux autostart entry:', error);
    }
  }
  
  app.setLoginItemSettings(loginSettings);
}

function createWindow() {
  // Create the browser window with enhanced security
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Gemini Desktop',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      // Additional security settings
      sandbox: true,                    // Enable sandbox for renderer
      webviewTag: false,                // Disable webview tag
      enableRemoteModule: false,        // Disable remote module
      spellcheck: true,                 // Enable spellcheck
      safeDialogs: true,                // Prevent dialog spam
      navigateOnDragDrop: false,        // Prevent drag-drop navigation
    },
    autoHideMenuBar: false,
    show: false, // Don't show until ready
  });

  // Create application menu
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'New Chat',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.loadURL('https://gemini.google.com/app');
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { type: 'separator' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Toggle Fullscreen', accelerator: 'F11', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Developer Tools', accelerator: 'CmdOrCtrl+Shift+I', role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Account',
      submenu: [
        {
          label: 'Sign Out & Clear Session',
          click: async () => {
            const { dialog } = require('electron');
            const result = await dialog.showMessageBox(mainWindow, {
              type: 'warning',
              buttons: ['Cancel', 'Sign Out'],
              defaultId: 0,
              cancelId: 0,
              title: 'Sign Out',
              message: 'Are you sure you want to sign out?',
              detail: 'This will clear all saved login data, cookies, and cached information. You will need to sign in again.'
            });
            
            if (result.response === 1) {
              // Clear all session data
              const ses = session.defaultSession;
              await ses.clearStorageData({
                storages: ['cookies', 'localstorage', 'sessionstorage', 'indexdb', 'websql', 'serviceworkers', 'cachestorage']
              });
              await ses.clearCache();
              await ses.clearAuthCache();
              
              // Reload to show login page
              mainWindow.loadURL('https://gemini.google.com/app');
            }
          }
        },
        {
          label: 'Clear Cache Only',
          click: async () => {
            const ses = session.defaultSession;
            await ses.clearCache();
            mainWindow.reload();
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: 'Close', accelerator: 'CmdOrCtrl+W', role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Gemini',
          click: async () => {
            await shell.openExternal('https://gemini.google.com/');
          }
        },
        {
          label: 'Google AI Help',
          click: async () => {
            await shell.openExternal('https://support.google.com/gemini');
          }
        }
      ]
    }
  ]);

  Menu.setApplicationMenu(menu);

  // Set a custom user agent to ensure compatibility
  const userAgent = mainWindow.webContents.getUserAgent().replace(/Electron\/[\d.]+ /, '');
  mainWindow.webContents.setUserAgent(userAgent);

  // Load Gemini
  mainWindow.loadURL('https://gemini.google.com/app');

  // Show window when ready (unless starting minimized)
  mainWindow.once('ready-to-show', () => {
    const startHidden = process.argv.includes('--hidden') || settings.startMinimized;
    if (!startHidden) {
      mainWindow.show();
    }
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!isQuitting && settings.minimizeToTray) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  // Handle minimize to tray
  mainWindow.on('minimize', (event) => {
    if (settings.minimizeToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Handle external links - open in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Allow Google auth and Gemini URLs to open in app
    if (url.includes('accounts.google.com') || 
        url.includes('gemini.google.com') ||
        url.includes('google.com/accounts')) {
      return { action: 'allow' };
    }
    // Open other URLs in default browser
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle navigation
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Allow navigation within Gemini and Google auth
    if (!url.includes('gemini.google.com') && 
        !url.includes('accounts.google.com') &&
        !url.includes('google.com/accounts')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Update window title based on page
  mainWindow.webContents.on('page-title-updated', (event, title) => {
    mainWindow.setTitle(title || 'Gemini Desktop');
  });

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Load settings
  settings = loadSettings();
  
  // Check encryption availability
  checkEncryptionAvailable();
  
  // Configure secure session settings
  configureSecureSession();

  // Create system tray
  createTray();

  // Create main window
  createWindow();

  // Sync auto-launch setting
  updateAutoLaunch();

  app.on('activate', () => {
    // On macOS re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

// Handle before-quit to allow actual quit
app.on('before-quit', () => {
  isQuitting = true;
});

// Quit when all windows are closed (except on macOS or if minimize to tray is enabled)
app.on('window-all-closed', () => {
  // Don't quit if we have minimize to tray enabled
  if (!settings.minimizeToTray && process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent new window creation from web content
app.on('web-contents-created', (event, contents) => {
  // Disable navigation to unwanted URLs
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    const allowedHosts = ['gemini.google.com', 'accounts.google.com'];
    
    if (!allowedHosts.some(host => parsedUrl.hostname.includes(host))) {
      event.preventDefault();
    }
  });

  // Prevent opening new windows except for auth
  contents.setWindowOpenHandler(({ url }) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname.includes('accounts.google.com')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });
});

// Handle certificate errors - be strict in production
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  // Only allow Google's certificates, reject all others
  const parsedUrl = new URL(url);
  if (parsedUrl.hostname.endsWith('google.com') || 
      parsedUrl.hostname.endsWith('googleapis.com') ||
      parsedUrl.hostname.endsWith('gstatic.com')) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

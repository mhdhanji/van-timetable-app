const { app, BrowserWindow, Tray, Menu, Notification, dialog, powerSaveBlocker, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const AutoLaunch = require('auto-launch');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let updateChecked = false;
let powerSaveBlockerId = null;
let isQuitting = false;
let wakeupInterval = null;
let hasMinimizedToTray = false;
let isDarkMode = false;

// Configure auto launcher
const autoLauncher = new AutoLaunch({
    name: 'Van Timetable',
    path: app.getPath('exe'),
});

// Check and enable auto launch
autoLauncher.isEnabled().then((isEnabled) => {
    if (!isEnabled) {
        autoLauncher.enable();
    }
}).catch((err) => {
    console.error('Auto Launch error:', err);
});

// Try to load saved dark mode preference
try {
    const userDataPath = app.getPath('userData');
    const prefsPath = path.join(userDataPath, 'preferences.json');
    if (fs.existsSync(prefsPath)) {
        const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
        isDarkMode = prefs.darkMode || false;
    }
} catch (err) {
    log.error('Error loading preferences:', err);
}

// Save dark mode preference
function savePreferences() {
    try {
        const userDataPath = app.getPath('userData');
        const prefsPath = path.join(userDataPath, 'preferences.json');
        fs.writeFileSync(prefsPath, JSON.stringify({ darkMode: isDarkMode }));
    } catch (err) {
        log.error('Error saving preferences:', err);
    }
}

// Configure logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'debug';

// Configure updater
autoUpdater.autoDownload = false;
autoUpdater.allowDowngrade = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.forceDevUpdateConfig = false;

// Set update feed URL
autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'mhdhanji',
    repo: 'van-timetable-app',
    private: false,
    releaseType: 'release',
    vPrefixedTagName: false
});

function checkForUpdates() {
    if (!updateChecked) {
        updateChecked = true;
        autoUpdater.checkForUpdates().catch(err => {
            log.error('Error checking for updates:', err);
            updateChecked = false;
        });
    }
}

function preventAppSuspension() {
    if (powerSaveBlockerId === null) {
        powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
    }
    
    if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
        mainWindow.webContents.setBackgroundThrottling(false);
    }
}

// New wake-up function that doesn't cause visible resizing
function forceWakeApp() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        try {
            // Send wake-up message to renderer
            mainWindow.webContents.send('wake-up');
            
            // Ensure power save blocker is active
            if (powerSaveBlockerId === null) {
                powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
            }

            // Prevent background throttling
            mainWindow.webContents.setBackgroundThrottling(false);

            // Optional: Force a minimal content refresh without resizing
            mainWindow.webContents.invalidate();
        } catch (error) {
            log.error('Error in forceWakeApp:', error);
        }
    }
}

// Add logging events
autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info);
    if (mainWindow && !mainWindow.isDestroyed()) {
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Available',
            message: `Version ${info.version} is available. Would you like to download it now?`,
            buttons: ['Yes', 'No']
        }).then((result) => {
            if (result.response === 0) {
                autoUpdater.downloadUpdate();
            }
        });
    }
});

autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available:', info);
});

autoUpdater.on('download-progress', (progressObj) => {
    log.info(`Download speed: ${progressObj.bytesPerSecond}`);
    log.info(`Downloaded ${progressObj.percent}%`);
    log.info(`(${progressObj.transferred}/${progressObj.total})`);
});

autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded');
    if (mainWindow && !mainWindow.isDestroyed()) {
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Ready',
            message: 'Update downloaded. The application will close to install the update. Please wait for the installer to appear.',
            buttons: ['Close and Install']
        }).then(() => {
            try {
                log.info('Preparing to install update...');
                
                isQuitting = true;
                
                // Remove listeners and destroy tray first
                if (mainWindow) {
                    mainWindow.removeAllListeners('close');
                }
                
                if (tray) {
                    tray.destroy();
                    tray = null;
                }

                // Clear intervals
                if (wakeupInterval) {
                    clearInterval(wakeupInterval);
                    wakeupInterval = null;
                }

                // Close all windows
                BrowserWindow.getAllWindows().forEach(window => {
                    window.destroy();
                });

                // Force close the app completely
                setImmediate(() => {
                    app.quit();
                    // Wait a moment before installing
                    setTimeout(() => {
                        autoUpdater.quitAndInstall(true, true);
                    }, 1000);
                });

            } catch (err) {
                log.error('Error during update installation:', err);
                // Force quit if error occurs
                app.exit(0);
            }
        });
    }
});

autoUpdater.on('error', (err) => {
    log.error('AutoUpdater error:', err);
    log.error('Error details:', err.stack);
    if (mainWindow && !mainWindow.isDestroyed()) {
        dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: 'Update Error',
            message: 'Error updating application. Check logs for details.',
            detail: err.message
        });
    }
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
            preload: path.join(__dirname, 'preload.js'),
            backgroundThrottling: false
        },
        show: false
    });

    // Apply saved dark mode state
    if (isDarkMode) {
        mainWindow.webContents.on('did-finish-load', () => {
            mainWindow.webContents.send('toggle-dark-mode', true);
        });
    }

    // Clear any existing interval
    if (wakeupInterval) {
        clearInterval(wakeupInterval);
        wakeupInterval = null;
    }

    // Set up wake-up interval
    wakeupInterval = setInterval(() => {
        if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
            forceWakeApp();
        }
    }, 30000);

    mainWindow.on('minimize', () => {
        if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
            preventAppSuspension();
        }
    });
    
    mainWindow.on('hide', () => {
        if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
            preventAppSuspension();
        }
    });
    
    mainWindow.once('ready-to-show', () => {
        if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            preventAppSuspension();
        }
    });
    
    mainWindow.on('close', function (event) {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            
            if (Notification.isSupported() && !hasMinimizedToTray) {
                new Notification({
                    title: 'Van Timetable',
                    body: 'Application is still running in the system tray',
                    icon: path.join(__dirname, 'icon.png')
                }).show();
                hasMinimizedToTray = true;
            }
        }
        return false;
    });

    mainWindow.loadFile('index.html');
    
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        log.error('Page failed to load:', errorDescription);
    });

    mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
        log.error('Preload script error:', preloadPath, error);
    });
}

function createTray() {
    tray = new Tray(path.join(__dirname, 'icon.png'));
    const contextMenu = Menu.buildFromTemplate([
        {
            label: `Van Timetable v${app.getVersion()}`,
            enabled: false
        },
        { type: 'separator' },
        {
            label: 'Show App',
            click: function () {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.show();
                }
            }
        },
        {
            label: 'Start with Windows',
            type: 'checkbox',
            checked: true,
            click: function (menuItem) {
                if (menuItem.checked) {
                    autoLauncher.enable();
                } else {
                    autoLauncher.disable();
                }
            }
        },
        {
            label: 'Dark Mode',
            type: 'checkbox',
            checked: isDarkMode,
            click: function (menuItem) {
                isDarkMode = menuItem.checked;
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('toggle-dark-mode', isDarkMode);
                }
                savePreferences();
            }
        },
        {
            label: 'Check for Updates',
            click: function() {
                log.info('Manually checking for updates...');
                updateChecked = false;
                checkForUpdates();
            }
        },
        { type: 'separator' },
        {
            label: 'Exit',
            click: function () {
                try {
                    log.info('Exiting application...');
                    isQuitting = true;

                    // Clear intervals and stop blockers
                    if (wakeupInterval) {
                        clearInterval(wakeupInterval);
                        wakeupInterval = null;
                    }

                    if (powerSaveBlockerId !== null) {
                        powerSaveBlocker.stop(powerSaveBlockerId);
                        powerSaveBlockerId = null;
                    }

                    // Cleanup window
                    if (mainWindow) {
                        mainWindow.removeAllListeners('close');
                        mainWindow.hide();
                        mainWindow.destroy();
                        mainWindow = null;
                    }

                    // Cleanup tray
                    if (tray) {
                        tray.destroy();
                        tray = null;
                    }

                    app.quit();
                } catch (err) {
                    log.error('Error during exit:', err);
                    app.exit(0);
                }
            }
        }
    ]);

    tray.setToolTip(`Van Timetable v${app.getVersion()}`);
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
        }
    });
}

app.whenReady().then(() => {
    log.info('App starting...');
    log.info('Current version:', app.getVersion());
    
    // Set process priority higher for Windows
    if (process.platform === 'win32') {
        try {
            process.processPrivilege.setPrivilege('SeIncreaseBasePriorityPrivilege', true);
        } catch (err) {
            log.error('Failed to set process priority:', err);
        }
    }
    
    const instanceLock = app.requestSingleInstanceLock();
    
    if (!instanceLock) {
        app.quit();
    } else {
        app.on('second-instance', () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.show();
                mainWindow.focus();
            }
        });
        
        createWindow();
        createTray();
        checkForUpdates();
        
        // Only call preventAppSuspension after window is created
        if (mainWindow && !mainWindow.isDestroyed()) {
            preventAppSuspension();
        }
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        isQuitting = true;
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', () => {
    log.info('Application is quitting...');
    isQuitting = true;
    hasMinimizedToTray = false;
    
    // Clear the wake-up interval
    if (wakeupInterval) {
        clearInterval(wakeupInterval);
        wakeupInterval = null;
    }
    
    if (powerSaveBlockerId !== null) {
        powerSaveBlocker.stop(powerSaveBlockerId);
        powerSaveBlockerId = null;
    }

    // Cleanup tray
    if (tray) {
        tray.destroy();
        tray = null;
    }
});

app.on('will-quit', () => {
    log.info('Application will quit...');
    isQuitting = true;
});

app.on('quit', () => {
    log.info('Application has quit.');
    isQuitting = true;
});
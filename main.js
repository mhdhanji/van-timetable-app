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

// Configure logging
log.transports.file.level = 'debug';
autoUpdater.logger = log;
log.info('App starting...');

// Configure updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.allowDowngrade = false;
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

// Check and enable auto launch
autoLauncher.isEnabled().then((isEnabled) => {
    if (!isEnabled) autoLauncher.enable();
}).catch(err => log.error('Auto Launch error:', err));

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

function savePreferences() {
    try {
        const userDataPath = app.getPath('userData');
        const prefsPath = path.join(userDataPath, 'preferences.json');
        fs.writeFileSync(prefsPath, JSON.stringify({ darkMode: isDarkMode }));
    } catch (err) {
        log.error('Error saving preferences:', err);
    }
}

function checkForUpdates() {
    if (!updateChecked) {
        log.info('Checking for updates...');
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
    
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.setBackgroundThrottling(false);
    }
}

function forceWakeApp() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        try {
            mainWindow.webContents.send('wake-up');
            
            if (powerSaveBlockerId === null) {
                powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
            }

            mainWindow.webContents.setBackgroundThrottling(false);
            mainWindow.webContents.invalidate();
        } catch (error) {
            log.error('Error in forceWakeApp:', error);
        }
    }
}

// Update event handlers
autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info);
    if (mainWindow && !mainWindow.isDestroyed()) {
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Available',
            message: `Version ${info.version} is available. Would you like to download and install it now?`,
            buttons: ['Yes', 'No'],
            defaultId: 0,
            cancelId: 1
        }).then((result) => {
            if (result.response === 0) {
                autoUpdater.downloadUpdate().catch(err => {
                    log.error('Error downloading update:', err);
                    dialog.showErrorBox('Update Error', 
                        'Failed to download update. Please try again later.');
                });
            }
        });
    }
});

autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available:', info);
});

autoUpdater.on('download-progress', (progressObj) => {
    log.info(`Download progress: ${progressObj.percent}%`);
});

autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded');
    if (mainWindow && !mainWindow.isDestroyed()) {
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Ready',
            message: 'Update downloaded. The application will restart to install the update.',
            buttons: ['Restart Now']
        }).then(() => {
            try {
                log.info('Preparing to install update...');
                isQuitting = true;
                
                // Clean up resources
                if (mainWindow) {
                    mainWindow.removeAllListeners('close');
                }
                
                if (tray) {
                    tray.destroy();
                    tray = null;
                }

                if (wakeupInterval) {
                    clearInterval(wakeupInterval);
                    wakeupInterval = null;
                }

                if (powerSaveBlockerId !== null) {
                    powerSaveBlocker.stop(powerSaveBlockerId);
                    powerSaveBlockerId = null;
                }

                // Set updating flag
                const userDataPath = app.getPath('userData');
                const updateFlagPath = path.join(userDataPath, 'updating.flag');
                fs.writeFileSync(updateFlagPath, 'updating');

                // Quit and install
                setImmediate(() => {
                    app.removeAllListeners('window-all-closed');
                    autoUpdater.quitAndInstall(false, true);
                });
            } catch (err) {
                log.error('Error during update installation:', err);
                app.exit(0);
            }
        });
    }
});

autoUpdater.on('error', (err) => {
    log.error('AutoUpdater error:', err);
    if (mainWindow && !mainWindow.isDestroyed()) {
        dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: 'Update Error',
            message: 'Error updating application. Please try again later.',
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

    if (wakeupInterval) {
        clearInterval(wakeupInterval);
        wakeupInterval = null;
    }

    wakeupInterval = setInterval(() => {
        if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
            forceWakeApp();
        }
    }, 30000);

    mainWindow.loadFile('index.html');

    mainWindow.on('minimize', () => {
        if (!isQuitting) preventAppSuspension();
    });
    
    mainWindow.on('hide', () => {
        if (!isQuitting) preventAppSuspension();
    });
    
    mainWindow.once('ready-to-show', () => {
        if (!isQuitting) {
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

                    if (wakeupInterval) {
                        clearInterval(wakeupInterval);
                        wakeupInterval = null;
                    }

                    if (powerSaveBlockerId !== null) {
                        powerSaveBlocker.stop(powerSaveBlockerId);
                        powerSaveBlockerId = null;
                    }

                    if (mainWindow) {
                        mainWindow.removeAllListeners('close');
                        mainWindow.hide();
                        mainWindow.destroy();
                        mainWindow = null;
                    }

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

        // Check if we're restarting after an update
        const userDataPath = app.getPath('userData');
        const updateFlagPath = path.join(userDataPath, 'updating.flag');
        
        if (fs.existsSync(updateFlagPath)) {
            try {
                fs.unlinkSync(updateFlagPath);
                dialog.showMessageBox({
                    type: 'info',
                    title: 'Update Successful',
                    message: `Application has been updated to version ${app.getVersion()}`,
                    buttons: ['OK']
                });
            } catch (err) {
                log.error('Error handling update flag:', err);
            }
        }
        
        createWindow();
        createTray();
        checkForUpdates();
        
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
    
    if (wakeupInterval) {
        clearInterval(wakeupInterval);
        wakeupInterval = null;
    }
    
    if (powerSaveBlockerId !== null) {
        powerSaveBlocker.stop(powerSaveBlockerId);
        powerSaveBlockerId = null;
    }

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
const { app, BrowserWindow, Tray, Menu, Notification, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let updateChecked = false;

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

// Add logging events
autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info);
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
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded. The application will close to install the update. Please wait for the installer to appear.',
        buttons: ['Close and Install']
    }).then(() => {
        try {
            log.info('Preparing to install update...');
            
            // Remove listeners and destroy tray first
            if (mainWindow) {
                mainWindow.removeAllListeners('close');
            }
            
            if (tray) {
                tray.destroy();
                tray = null;
            }

            // Close all windows
            BrowserWindow.getAllWindows().forEach(window => {
                window.destroy();
            });

            // Set flags
            app.isQuitting = true;
            
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
});

autoUpdater.on('error', (err) => {
    log.error('AutoUpdater error:', err);
    log.error('Error details:', err.stack);
    dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Update Error',
        message: 'Error updating application. Check logs for details.',
        detail: err.message
    });
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
            preload: path.join(__dirname, 'preload.js')
        },
        show: false
    });
    
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
    
    mainWindow.on('close', function (event) {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            
            if (Notification.isSupported()) {
                new Notification({
                    title: 'Van Timetable',
                    body: 'Application is still running in the system tray',
                    icon: path.join(__dirname, 'icon.png')
                }).show();
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

    log.info('Checking for updates...');
    checkForUpdates();
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
                mainWindow.show();
            }
        },
        {
            label: 'Check for Updates',
            click: function() {
                log.info('Manually checking for updates...');
                updateChecked = false; // Reset for manual check
                checkForUpdates();
            }
        },
        { type: 'separator' },
        {
            label: 'Exit',
            click: function () {
                try {
                    log.info('Exiting application...');
                    if (mainWindow) {
                        mainWindow.removeAllListeners('close');
                    }
                    if (tray) {
                        log.info('Destroying tray...');
                        tray.destroy();
                        tray = null;
                    }
                    if (mainWindow) {
                        log.info('Closing main window...');
                        mainWindow.hide();
                        mainWindow.destroy();
                        mainWindow = null;
                    }
                    app.isQuitting = true;
                    app.exit(0);
                } catch (err) {
                    log.error('Error during exit:', err);
                }
            }
        }
    ]);

    tray.setToolTip(`Van Timetable v${app.getVersion()}`);
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        mainWindow.show();
    });
}

// Initialize app
app.whenReady().then(() => {
    log.info('App starting...');
    log.info('Current version:', app.getVersion());
    
    const instanceLock = app.requestSingleInstanceLock();
    
    if (!instanceLock) {
        app.quit();
    } else {
        app.on('second-instance', () => {
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.show();
                mainWindow.focus();
            }
        });
        
        createWindow();
        createTray();
        checkForUpdates();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
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
    app.isQuitting = true;
});

app.on('will-quit', () => {
    log.info('Application will quit...');
});

app.on('quit', () => {
    log.info('Application has quit.');
});
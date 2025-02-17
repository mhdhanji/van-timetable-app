const { app, BrowserWindow, Tray, Menu, Notification, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const isDev = require('electron-is-dev');
const fs = require('fs');
require('@electron/remote/main').initialize();

let mainWindow = null;
let tray = null;

// Configure logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'debug';

// Configure updater
autoUpdater.autoDownload = false;
autoUpdater.allowDowngrade = false;

// Set update feed URL
autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'mhdhanji',
    repo: 'van-timetable-app',
    private: false,
    releaseType: 'release',
    vPrefixedTagName: false
});

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
        message: 'Update downloaded. The application will restart to install the update.',
        buttons: ['Restart Now']
    }).then(() => {
        try {
            log.info('Preparing to install update...');
            
            // Set updating flag
            app.isUpdating = true;
            
            // Create a batch script to restart the app
            const restartScript = `
                @echo off
                timeout /t 2 /nobreak > nul
                start "" "${app.getPath('exe')}"
                del "%~f0"
            `;
            
            const scriptPath = path.join(app.getPath('temp'), 'restart.bat');
            fs.writeFileSync(scriptPath, restartScript);
            
            log.info('Created restart script at:', scriptPath);

            // Cleanup existing app
            if (mainWindow) {
                mainWindow.removeAllListeners('close');
                mainWindow.hide();
            }
            
            if (tray) {
                tray.destroy();
                tray = null;
            }

            // Execute restart script and quit
            require('child_process').spawn(scriptPath, [], {
                detached: true,
                stdio: 'ignore',
                shell: true
            });

            // Install update and quit
            setImmediate(() => {
                app.isQuitting = true;
                autoUpdater.quitAndInstall(false, true);
            });

        } catch (err) {
            log.error('Error during update installation:', err);
            try {
                // Fallback restart method
                app.relaunch();
                app.exit(0);
            } catch (innerErr) {
                log.error('Final restart attempt failed:', innerErr);
            }
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
            enableRemoteModule: true,
            preload: path.join(app.getAppPath(), 'preload.js')
        },
        show: false
    });

    require('@electron/remote/main').enable(mainWindow.webContents);
    
    log.info('Preload script path:', path.join(app.getAppPath(), 'preload.js'));
    
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
    autoUpdater.checkForUpdates().catch(err => {
        log.error('Error checking for updates:', err);
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
                mainWindow.show();
            }
        },
        {
            label: 'Check for Updates',
            click: function() {
                log.info('Manually checking for updates...');
                autoUpdater.checkForUpdates().catch(err => {
                    log.error('Error checking for updates:', err);
                });
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
    
    // Check if app was launched from update
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

        autoUpdater.checkForUpdates().catch(err => {
            log.error('Initial update check failed:', err);
        });
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
    if (app.isUpdating) {
        log.info('Application is updating, preparing for restart...');
        app.relaunch();
    }
});

app.on('quit', () => {
    log.info('Application has quit.');
    if (app.isUpdating) {
        log.info('Application quit due to update, restarting...');
        app.relaunch();
    }
});

app.on('ready-to-show', () => {
    log.info('Application is ready to show');
    if (mainWindow) {
        mainWindow.show();
    }
});
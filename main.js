const { app, BrowserWindow, Tray, Menu, Notification } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

let mainWindow = null;
let tray = null;

// Configure logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// Configure updater
autoUpdater.autoDownload = false;
autoUpdater.allowDowngrade = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Handle close button
    mainWindow.on('close', function (event) {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            
            // Show system notification properly
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

    // Check for updates
    autoUpdater.checkForUpdates();
}

// Auto-updater events
autoUpdater.on('update-available', (info) => {
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

autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded. The application will restart to install the update.',
        buttons: ['Restart Now']
    }).then(() => {
        autoUpdater.quitAndInstall(false, true);
    });
});

autoUpdater.on('error', (err) => {
    log.error('AutoUpdater error:', err);
    dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Update Error',
        message: 'Error updating application: ' + err
    });
});

function createTray() {
    tray = new Tray(path.join(__dirname, 'icon.png'));
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show App',
            click: function () {
                mainWindow.show();
            }
        },
        {
            label: 'Check for Updates',
            click: function() {
                autoUpdater.checkForUpdates();
            }
        },
        {
            label: 'Exit',
            click: function () {
                app.isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Van Timetable App');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        mainWindow.show();
    });
}

app.whenReady().then(() => {
    createWindow();
    createTray();
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
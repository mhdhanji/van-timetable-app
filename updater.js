const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');

// Configure logging
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

// Disable auto download
autoUpdater.autoDownload = false;

function initializeAutoUpdater(mainWindow) {
    // Check for updates
    autoUpdater.checkForUpdates();

    // Update available
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

    // Update not available
    autoUpdater.on('update-not-available', () => {
        console.log('App is up to date');
    });

    // Update downloaded
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

    // Error handling
    autoUpdater.on('error', (err) => {
        dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: 'Update Error',
            message: 'Error updating application: ' + err
        });
    });

    // Download progress
    autoUpdater.on('download-progress', (progressObj) => {
        mainWindow.webContents.send('update-progress', progressObj.percent);
    });
}

module.exports = { initializeAutoUpdater };
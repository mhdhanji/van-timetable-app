const { app, BrowserWindow, Tray, Menu } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;

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

    // Prevent window from being garbage collected
    mainWindow.on('close', function (event) {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });

    // Load the index.html file
    mainWindow.loadFile('index.html');
}

function createTray() {
    tray = new Tray(path.join(__dirname, 'icon.ico')); // Make sure you have an icon.ico file
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show App',
            click: function () {
                mainWindow.show();
            }
        },
        {
            label: 'Quit',
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
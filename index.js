const path = require('path');
const electron = require('electron');

const BrowserWindow = electron.BrowserWindow;
const app = electron.app;

const debug = /--debug/.test(process.argv[2]);

if (process.mas) app.setName('Electron APIs');

var mainWindow = null;

function initialize () {
    app.on('ready', function () {
        createWindow();
    });

    app.on('window-all-closed', function () {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', function () {
        if (mainWindow === null) {
            createWindow();
        }
    });
}

initialize();

function createWindow () {
    var windowOptions = {
        width: 1080,
        minWidth: 680,
        height: 840,
        title: app.getName()
    };

    if (process.platform === 'linux') {
        windowOptions.icon = path.join(__dirname, '/assets/app-icon/png/512.png');
    }

    mainWindow = new BrowserWindow(windowOptions);
    mainWindow.loadURL(path.join('file://', __dirname, 'src', 'index.html'));

    // Launch fullscreen with DevTools open, usage: npm run debug
    if (debug) {
        mainWindow.webContents.openDevTools();
        mainWindow.maximize();
        require('devtron').install();
    }

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}
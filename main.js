/**
 * MAIN.JS - Versión Mejorada
 */

const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development' || 
              process.defaultApp || 
              /[\\/]electron[\\/]/.test(process.execPath);

let mainWindow;

function createWindow() {
    console.log('Iniciando aplicacion Electron...');
    
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: true // ✅ Mejor seguridad
        },
        title: 'Organizador de Tareas - Electron + MySQL',
        show: false
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
        
        if (isDev) {
            mainWindow.webContents.openDevTools();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    createApplicationMenu();
}

function createApplicationMenu() {
    const template = [
        {
            label: 'Archivo',
            submenu: [
                { role: 'quit', label: 'Salir' }
            ]
        },
        {
            label: 'Ver',
            submenu: [
                { role: 'reload', label: 'Recargar' },
                { role: 'toggleDevTools', label: 'Herramientas de Desarrollo' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

console.log('main.js cargado correctamente');
console.log('Configuracion de Electron lista');
console.log('Esperando conexion a MySQL...');
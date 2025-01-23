// src/main/main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // The preload file if you use it
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false, // generally good practice for security
      contextIsolation: true, // recommended for security
    },
    name: 'mainWindow'
  });

  // Load your React app (Vite dev server in development, or index.html in production)
  // if (process.env.NODE_ENV === 'development') {
  //   mainWindow.loadURL('http://localhost:5173'); 
  // } else {
  //   // In production, load the local index.html file
  //   mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  // }
  mainWindow.loadURL('http://localhost:5173'); 
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function() {
    // On macOS it's common to re-create a window if the dock icon is clicked and no other
    // windows are open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  // On macOS, apps typically stay active until user explicitly quits.
  if (process.platform !== 'darwin') app.quit();
});

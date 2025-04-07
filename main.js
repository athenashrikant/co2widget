const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');


let mainWindow;
let pythonProcess;
let lastPowerData = null; // Store last JSON to resend after load

app.whenReady().then(() => {
  // Start Python script for power tracking
  pythonProcess = spawn('python', [path.join(__dirname, 'adaptive_power_tracker.py')], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: false
  });

  // Handle incoming JSON data from Python
  pythonProcess.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim()) {
        console.log('[Python output]', line);
        try {
          const jsonData = JSON.parse(line);
          lastPowerData = jsonData;
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('power-data', jsonData);
          }
        } catch (e) {
          console.error('Invalid JSON from Python:', line);
        }
      }
    });
  });

  pythonProcess.stderr.on('data', (err) => {
    console.error('Python stderr:', err.toString());
  });

  pythonProcess.on('close', () => {
    pythonProcess = null;
  });

  // Launch login window
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('login.html');

  ipcMain.on('login-success', () => {
    mainWindow.loadFile('index.html');
    mainWindow.webContents.once('did-finish-load', () => {
      console.log('✅ index.html fully loaded');
      if (lastPowerData) {
        mainWindow.webContents.send('power-data', lastPowerData);
      }
    });
  });

  ipcMain.on('logout', () => {
    mainWindow.loadFile('login.html');
    if (pythonProcess) {
      pythonProcess.kill();
      pythonProcess = null;
    }
  });
});

const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;
let pythonProcess;

function createWindow() {
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
    if (!pythonProcess) startPythonProcess();
  });

  ipcMain.on('logout', () => {
    mainWindow.loadFile('login.html');
    if (pythonProcess) {
      pythonProcess.kill();
      pythonProcess = null;
    }
  });
}

function startPythonProcess() {
  pythonProcess = spawn('python', [path.join(__dirname, 'adaptive_power_tracker.py')]);

  pythonProcess.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim()) {
        try {
          const jsonData = JSON.parse(line);
          mainWindow.webContents.send('power-data', jsonData);
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
}

app.whenReady().then(createWindow);

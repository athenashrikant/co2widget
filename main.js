// === main.js (Electron Main Process) ===
const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('index.html');

  const pythonProcess = spawn('python', [path.join(__dirname, 'adaptive_power_tracker.py')]);

  pythonProcess.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim()) {
        try {
          const jsonData = JSON.parse(line);
          mainWindow.webContents.send('power-data', jsonData);
        } catch (e) {
          console.error('Invalid JSON:', line);
        }
      }
    });
  });

  pythonProcess.stderr.on('data', (err) => {
    console.error('Python stderr:', err.toString());
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python script exited with code ${code}`);
  });
});

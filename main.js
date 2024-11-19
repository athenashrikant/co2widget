const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');

let mainWindow;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Allows using CommonJS modules
    },
  });

  mainWindow.loadFile('index.html');
});

// IPC communication to fetch data
ipcMain.on('fetch-data', (event) => {
  const pythonProcess = spawn('python', ['data.py']);

  let data = '';
  let error = '';

  // Collect data output
  pythonProcess.stdout.on('data', (chunk) => {
    data += chunk.toString();
  });

  // Collect errors
  pythonProcess.stderr.on('data', (chunk) => {
    error += chunk.toString();
  });

  // On process close, send the data back to the renderer process
  pythonProcess.on('close', (code) => {
    if (code === 0) {
      try {
        const parsedData = JSON.parse(data); // Ensure `data.py` outputs JSON
        event.reply('data-response', parsedData);
      } catch (err) {
        event.reply('data-response', { error: 'Failed to parse data from Python script' });
      }
    } else {
      event.reply('data-response', { error: error || 'Python script error' });
    }
  });
});

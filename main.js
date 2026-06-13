const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;
let pythonProcess;
let lastPowerData = null;

// Resolve path to the Python script depending on packaged state
const pythonScriptPath = app.isPackaged
	? path.join(process.resourcesPath, 'adaptive_power_tracker.py')
	: path.join(__dirname, 'adaptive_power_tracker.py');

// Cross-platform Python launcher
function getPythonCommand() {
	if (process.platform === 'win32') {
		return { cmd: 'py', argsPrefix: ['-3'] };
	}

	if (process.platform === 'darwin') {
		return { cmd: '/usr/bin/python3', argsPrefix: [] };
	}

	return { cmd: 'python3', argsPrefix: [] };
}

app.whenReady().then(() => {
	const python = getPythonCommand();

	console.log('Using Python:', python.cmd);
	console.log('Python Script:', pythonScriptPath);

	// Start Python script
	pythonProcess = spawn(
		python.cmd,
		[...python.argsPrefix, pythonScriptPath],
		{
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true,
			shell: false
		}
	);

	pythonProcess.stdout.on('data', (chunk) => {
		const lines = chunk.toString().split('\n');

		lines.forEach((line) => {
			if (!line.trim()) return;

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
		});
	});

	pythonProcess.stderr.on('data', (err) => {
		console.error('Python stderr:', err.toString());
	});

	pythonProcess.on('error', (err) => {
		console.error('Failed to start Python process:', err);
	});

	pythonProcess.on('close', (code) => {
		console.log(`Python process exited with code ${code}`);
		pythonProcess = null;
	});

	// Main window
	mainWindow = new BrowserWindow({
		width: 1000,
		height: 800,
		autoHideMenuBar: true,
		titleBarStyle: 'hidden',
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false
		}
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

	ipcMain.on('window-control', (event, action) => {
		const window = BrowserWindow.getFocusedWindow();

		if (!window) return;

		switch (action) {
			case 'minimize':
				window.minimize();
				break;

			case 'maximize':
				if (window.isMaximized()) {
					window.unmaximize();
				} else {
					window.maximize();
				}
				break;

			case 'close':
				window.close();
				break;
		}
	});

	app.on('before-quit', () => {
		if (pythonProcess) {
			pythonProcess.kill();
			pythonProcess = null;
		}
	});
});
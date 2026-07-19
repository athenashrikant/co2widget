const { app, BrowserWindow, ipcMain } = require('electron');
const { startPowerStream } = require('./power_tracker');

let mainWindow;
let powerStream = null;
let lastPowerData = null;

function startTracking() {
	if (powerStream) return; // already running

	powerStream = startPowerStream((data) => {
		lastPowerData = data;

		if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
			mainWindow.webContents.send('power-data', data);
		}
	}, 1000);

	console.log('✅ Power tracking started (native JS)');
}

function stopTracking() {
	if (powerStream) {
		powerStream.stop();
		powerStream = null;
		console.log('🛑 Power tracking stopped');
	}
}

app.whenReady().then(() => {
	// Start tracking immediately (was: spawn Python script)
	startTracking();

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

		// Restart tracking in case a previous logout stopped it
		startTracking();

		mainWindow.webContents.once('did-finish-load', () => {
			console.log('✅ index.html fully loaded');

			if (lastPowerData) {
				mainWindow.webContents.send('power-data', lastPowerData);
			}
		});
	});

	ipcMain.on('logout', () => {
		mainWindow.loadFile('login.html');
		stopTracking();
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
		stopTracking();
	});
});

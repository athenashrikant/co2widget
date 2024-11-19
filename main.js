console.log('Hello from Electron 👋')

const { app, BrowserWindow } = require('electron')

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    autoHideMenuBar: true,
    frame: false
  })

  win.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow()
})
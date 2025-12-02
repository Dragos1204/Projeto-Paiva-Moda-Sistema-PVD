const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Paiva Moda",
    icon: path.join(__dirname, 'build/favicon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.setMenuBarVisibility(false); // Remove menu superior

  // Carrega o arquivo index.html da pasta build (produção)
  const startUrl = `file://${path.join(__dirname, '/build/index.html')}`;
  
  win.loadURL(startUrl);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
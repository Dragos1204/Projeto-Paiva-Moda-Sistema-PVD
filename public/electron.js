const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Paiva Moda",
    // Tenta pegar o ícone do local correto (seja dev ou prod)
    icon: path.join(__dirname, 'favicon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.setMenuBarVisibility(false);

  // Lógica inteligente:
  // Se estivermos rodando no localhost (npm start), usa a URL local.
  // Se for o EXE final, usa o arquivo index.html que está na mesma pasta.
  const isDev = process.argv.some(arg => arg === 'public/electron.js');
  
  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, 'index.html')}`;
  
  win.loadURL(startUrl);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
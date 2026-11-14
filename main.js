const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn, execFile, execSync } = require('child_process');
const http = require('http');

let serverProcess = null;
let mainWindow = null;
const PORT = 4173;

function startPythonServer() {
  const isPackaged = app.isPackaged;
  let serverPath;
  let cwd;
  let args = [];

  // Clean up any orphaned backend instances to free up the port
  if (process.platform === 'win32') {
    try {
      execSync('taskkill /f /im server.exe', { stdio: 'ignore' });
    } catch (e) {
      // Ignore if no process is found
    }
  }

  if (isPackaged) {
    // In packaged app, server.exe is in the resources folder
    serverPath = path.join(process.resourcesPath, 'server.exe');
    cwd = process.resourcesPath;
  } else {
    // In development mode, run python server.py
    serverPath = 'python';
    cwd = __dirname;
    args = ['server.py'];
  }

  console.log(`Starting backend server: ${serverPath} CWD: ${cwd}`);

  if (isPackaged) {
    serverProcess = execFile(serverPath, [], { cwd, env: process.env });
  } else {
    serverProcess = spawn(serverPath, args, { cwd, env: process.env });
  }

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Python Stdout]: ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Python Stderr]: ${data}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`Python server process exited with code ${code}`);
  });
}

let isPollActive = false;
function pollServer(callback) {
  if (isPollActive) return;
  isPollActive = true;

  const check = () => {
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/ping',
      method: 'GET',
      timeout: 2000
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        isPollActive = false;
        callback(true);
      } else {
        req.destroy();
        setTimeout(check, 1000);
      }
    });

    req.on('error', () => {
      req.destroy();
      setTimeout(check, 1000);
    });

    req.end();
  };

  check();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    show: false, // Show only when loaded
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      zoomFactor: 0.8 // Zoom out to 80% to fit data tables and sidebar without horizontal scroll
    },
    title: "Tally Automation"
  });

  mainWindow.removeMenu(); // Remove default Electron menu bar for premium native feel

  pollServer(() => {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.setZoomFactor(0.8);
    });
    mainWindow.loadURL(`http://127.0.0.1:${PORT}/index.html`);
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Start server on app ready
app.whenReady().then(() => {
  startPythonServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Terminate python server cleanly on quit
function cleanQuit() {
  if (serverProcess) {
    console.log("Shutting down background python server...");
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', serverProcess.pid, '/f', '/t']);
    } else {
      serverProcess.kill('SIGINT');
    }
    serverProcess = null;
  }
}

app.on('will-quit', cleanQuit);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

const { app, BrowserWindow, ipcMain, shell, clipboard, Tray, Menu, nativeImage, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { exec } = require('node:child_process');

if (require('electron-squirrel-startup')) {
  app.quit();
}

const STORE_FILE = 'store.json';
let store = {
  notes: '',
  disabledStartup: {},
  clipboard: [],
  clipboardSettings: {
    expireMinutes: 0,
  },
};

const loadStore = () => {
  try {
    const storePath = path.join(app.getPath('userData'), STORE_FILE);
    if (fs.existsSync(storePath)) {
      const raw = fs.readFileSync(storePath, 'utf8');
      store = { ...store, ...JSON.parse(raw) };
    }
  } catch (err) {
    // ignore
  }
};

const saveStore = () => {
  try {
    const storePath = path.join(app.getPath('userData'), STORE_FILE);
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    // ignore
  }
};

const cleanupExpiredClipboard = () => {
  const now = Date.now();
  store.clipboard = (store.clipboard || []).filter((item) => !item.expiresAt || item.expiresAt > now);
};

const runPowerShell = (command) =>
  new Promise((resolve, reject) => {
    const escaped = command.replace(/"/g, '\\"');
    exec(
      'powershell -NoProfile -ExecutionPolicy Bypass -Command "' + escaped + '"',
      { windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve(stdout.trim());
      },
    );
  });

const runPowerShellSafe = (command) =>
  new Promise((resolve) => {
    const escaped = command.replace(/"/g, '\\"');
    exec(
      'powershell -NoProfile -ExecutionPolicy Bypass -Command "' + escaped + '"',
      { windowsHide: true },
      (error, stdout, stderr) => {
        resolve({ ok: !error, stdout: (stdout || '').trim(), stderr: (stderr || '').trim() });
      },
    );
  });

const psQuote = (value) => "'" + String(value || '').replace(/'/g, "''") + "'";

let lastCpuInfo = os.cpus();
let mainWindow;
let tray;

const getCpuUsage = () => {
  const current = os.cpus();
  let idleDiff = 0;
  let totalDiff = 0;

  current.forEach((cpu, i) => {
    const prev = lastCpuInfo[i];
    const prevTimes = prev.times;
    const curTimes = cpu.times;

    const prevTotal =
      prevTimes.user + prevTimes.nice + prevTimes.sys + prevTimes.idle + prevTimes.irq;
    const curTotal =
      curTimes.user + curTimes.nice + curTimes.sys + curTimes.idle + curTimes.irq;

    idleDiff += curTimes.idle - prevTimes.idle;
    totalDiff += curTotal - prevTotal;
  });

  lastCpuInfo = current;
  const usage = totalDiff === 0 ? 0 : Math.round((1 - idleDiff / totalDiff) * 100);
  return Math.max(0, Math.min(100, usage));
};

const getDiskInfo = async () => {
  const output = await runPowerShell(
    'Get-PSDrive -PSProvider FileSystem | Select-Object Name,Used,Free | ConvertTo-Json',
  );
  let data = [];
  if (output) {
    data = JSON.parse(output);
  }
  const drives = Array.isArray(data) ? data : [data];
  return drives
    .filter((d) => d && d.Name)
    .map((d) => ({
      name: d.Name,
      used: Number(d.Used || 0),
      free: Number(d.Free || 0),
      total: Number(d.Used || 0) + Number(d.Free || 0),
    }));
};

const getNetworkInfo = () => {
  const nets = os.networkInterfaces();
  const result = [];
  Object.keys(nets).forEach((name) => {
    nets[name].forEach((net) => {
      if (net.family === 'IPv4' && !net.internal) {
        result.push({ name, address: net.address });
      }
    });
  });
  return result;
};

let clipboardTimer;
let lastClipboard = '';

const startClipboardWatcher = () => {
  if (clipboardTimer) return;
  clipboardTimer = setInterval(() => {
    cleanupExpiredClipboard();
    const text = clipboard.readText();
    if (!text || text === lastClipboard) return;
    lastClipboard = text;

    const item = {
      id: Date.now() + '-' + Math.random().toString(16).slice(2, 8),
      text,
      ts: Date.now(),
      pinned: false,
      tags: [],
    };

    const expireMinutes = Number(store.clipboardSettings?.expireMinutes || 0);
    if (expireMinutes > 0) {
      item.expiresAt = Date.now() + expireMinutes * 60000;
    }

    store.clipboard = [item, ...store.clipboard].slice(0, 50);
    saveStore();
  }, 1000);
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#0a0f1a',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
};

const createTray = () => {
  const dataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAU0lEQVR4nO3PMQ0AIBAEwff/0U0tKQd2QzZzYq0vQ1BVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVn0FZwo7YpT1pQAAAABJRU5ErkJggg==';
  const icon = nativeImage.createFromDataURL(dataUrl);
  tray = new Tray(icon);
  const menu = Menu.buildFromTemplate([
    { label: 'Show Multitool', click: () => mainWindow && mainWindow.show() },
    { label: 'Hide', click: () => mainWindow && mainWindow.hide() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setToolTip('Fluxtool');
  tray.setContextMenu(menu);
  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) mainWindow.hide();
    else mainWindow.show();
  });
};

app.whenReady().then(() => {
  loadStore();
  startClipboardWatcher();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('system:getStats', async () => {
  const memoryTotal = os.totalmem();
  const memoryFree = os.freemem();
  const memoryUsed = memoryTotal - memoryFree;

  const drives = await getDiskInfo();
  const primary = drives.find((d) => d.name.toUpperCase() === 'C') || drives[0];

  return {
    cpu: getCpuUsage(),
    memoryUsed,
    memoryTotal,
    disk: primary || null,
    uptime: os.uptime(),
    hostname: os.hostname(),
    network: getNetworkInfo(),
  };
});

ipcMain.handle('system:getDrives', async () => getDiskInfo());

ipcMain.handle('system:getNetwork', async () => getNetworkInfo());

ipcMain.handle('network:ping', async (_, target) => {
  return runPowerShell('ping -n 4 ' + target);
});

ipcMain.handle('network:trace', async (_, target) => {
  return runPowerShell('tracert ' + target);
});

ipcMain.handle('network:dns', async (_, target) => {
  return runPowerShell('nslookup ' + target);
});

ipcMain.handle('quick:flushDns', async () => runPowerShell('ipconfig /flushdns'));

ipcMain.handle('quick:restartExplorer', async () => {
  await runPowerShell('taskkill /f /im explorer.exe');
  await runPowerShell('Start-Process explorer.exe');
  return 'Explorer restarted';
});

ipcMain.handle('quick:clearTemp', async () => {
  const script =
    "$ErrorActionPreference='SilentlyContinue';" +
    'Remove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue;';
  const result = await runPowerShellSafe(script);
  return result.ok ? 'Temp cleared' : 'Temp cleared with some locked files.';
});

ipcMain.handle('quick:openDeviceManager', async () => {
  await shell.openPath('devmgmt.msc');
  return 'Opened Device Manager';
});

ipcMain.handle('quick:batteryReport', async () => {
  const outPath = path.join(app.getPath('documents'), 'Multitool-battery-report.html');
  await runPowerShell('powercfg /batteryreport /output "' + outPath + '"');
  await shell.openPath(outPath);
  return outPath;
});

ipcMain.handle('quick:killHung', async () => {
  await runPowerShell('Get-Process | Where-Object {$_.Responding -eq $false} | Stop-Process -Force');
  return 'Closed unresponsive apps';
});

ipcMain.handle('disk:scanLargeFiles', async (_, options) => {
  const targetPath = options && options.path ? options.path : 'C:\\';
  const minBytes = Math.max(0, Number(options && options.minBytes ? options.minBytes : 0));
  const exclude = options && options.exclude ? String(options.exclude) : '';
  const safePath = psQuote(targetPath);
  const filter = minBytes > 0 ? ` | Where-Object {$_.Length -gt ${minBytes}}` : '';
  const excludeFilter = exclude
    ? ` | Where-Object {$_.FullName -notmatch '${exclude.replace(/'/g, "''")}' }`
    : '';
  const output = await runPowerShell(
    'Get-ChildItem -LiteralPath ' +
      safePath +
      ' -Recurse -File -ErrorAction SilentlyContinue' +
      filter +
      excludeFilter +
      ' | Sort-Object Length -Descending | Select-Object -First 50 FullName,Length | ConvertTo-Json',
  );
  if (!output) return [];
  const parsed = JSON.parse(output);
  return Array.isArray(parsed) ? parsed : [parsed];
});

ipcMain.handle('process:list', async () => {
  const output = await runPowerShell(
    'Get-Process | Select-Object Id,ProcessName,CPU,WorkingSet,Responding | Sort-Object CPU -Descending | Select-Object -First 200 | ConvertTo-Json',
  );
  if (!output) return [];
  const parsed = JSON.parse(output);
  return Array.isArray(parsed) ? parsed : [parsed];
});

ipcMain.handle('process:kill', async (_, pid) => {
  await runPowerShell('Stop-Process -Id ' + pid + ' -Force');
  return 'Process stopped';
});

ipcMain.handle('startup:list', async () => {
  const output = await runPowerShell(
    "Get-ItemProperty -Path 'HKCU:\\\\Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Run' | ConvertTo-Json",
  );
  if (!output) return { enabled: [], disabled: store.disabledStartup };
  const parsed = JSON.parse(output);
  const entries = Object.entries(parsed)
    .filter(([key, value]) => !key.startsWith('PS') && typeof value === 'string' && value)
    .map(([key, value]) => ({ name: key, command: value }));
  return { enabled: entries, disabled: store.disabledStartup };
});

ipcMain.handle('startup:disable', async (_, name, command) => {
  await runPowerShell(
    'Remove-ItemProperty -Path "HKCU:\\\\Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Run" -Name "' +
      name +
      '" -ErrorAction SilentlyContinue',
  );
  store.disabledStartup[name] = command;
  saveStore();
  return 'Disabled';
});

ipcMain.handle('startup:enable', async (_, name) => {
  const command = store.disabledStartup[name];
  if (!command) return 'Not found';
  await runPowerShell(
    'Set-ItemProperty -Path "HKCU:\\\\Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Run" -Name "' +
      name +
      '" -Value "' +
      command +
      '"',
  );
  delete store.disabledStartup[name];
  saveStore();
  return 'Enabled';
});

ipcMain.handle('notes:get', async () => store.notes || '');

ipcMain.handle('notes:set', async (_, text) => {
  store.notes = text || '';
  saveStore();
  return 'Saved';
});

ipcMain.handle('clipboard:getHistory', async () => store.clipboard || []);

ipcMain.handle('clipboard:clear', async () => {
  store.clipboard = [];
  saveStore();
  return 'Cleared';
});

ipcMain.handle('clipboard:pin', async (_, id, pinned) => {
  store.clipboard = (store.clipboard || []).map((item) =>
    item.id === id ? { ...item, pinned, expiresAt: pinned ? undefined : item.expiresAt } : item,
  );
  saveStore();
  return 'Updated';
});

ipcMain.handle('clipboard:delete', async (_, id) => {
  store.clipboard = (store.clipboard || []).filter((item) => item.id !== id);
  saveStore();
  return 'Deleted';
});

ipcMain.handle('clipboard:write', async (_, text) => {
  clipboard.writeText(text || '');
  return 'Copied';
});

ipcMain.handle('clipboard:tag', async (_, id, tags) => {
  const normalized = Array.isArray(tags) ? tags : [];
  store.clipboard = (store.clipboard || []).map((item) =>
    item.id === id ? { ...item, tags: normalized } : item,
  );
  saveStore();
  return 'Tagged';
});

ipcMain.handle('clipboard:expire', async (_, id, minutes) => {
  const mins = Math.max(0, Number(minutes || 0));
  store.clipboard = (store.clipboard || []).map((item) =>
    item.id === id ? { ...item, expiresAt: mins ? Date.now() + mins * 60000 : undefined } : item,
  );
  saveStore();
  return 'Expires updated';
});

ipcMain.handle('clipboard:setSettings', async (_, settings) => {
  const mins = Math.max(0, Number(settings?.expireMinutes || 0));
  store.clipboardSettings = { expireMinutes: mins };
  store.clipboard = (store.clipboard || []).map((item) => {
    if (item.pinned || item.expiresAt) return item;
    return mins ? { ...item, expiresAt: Date.now() + mins * 60000 } : item;
  });
  saveStore();
  return 'Settings saved';
});

ipcMain.handle('app:getAutostart', () => app.getLoginItemSettings().openAtLogin);
ipcMain.handle('app:setAutostart', (_, enabled) => {
  app.setLoginItemSettings({ openAtLogin: !!enabled });
});

ipcMain.handle('app:checkUpdates', () => 'Updates not configured');
ipcMain.handle('app:getVersion', () => app.getVersion());
ipcMain.handle('app:getPaths', () => ({
  userData: app.getPath('userData'),
  logs: app.getPath('logs'),
}));

ipcMain.handle('app:checkUpdates', async () => {
  try {
    autoUpdater.autoDownload = true;
    const result = await autoUpdater.checkForUpdatesAndNotify();
    return result ? 'Update check complete' : 'No updates';
  } catch (err) {
    return 'Update check failed';
  }
});

autoUpdater.on('update-downloaded', () => {
  if (mainWindow) {
    mainWindow.webContents.send('app:updateReady');
  }
});

ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});

ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.handle('app:notify', (_, title, body) => {
  if (Notification.isSupported()) {
    new Notification({ title: title || 'Multitool', body: body || '' }).show();
  }
});

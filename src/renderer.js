import './index.css';

const titles = {
  dashboard: {
    title: 'Dashboard',
    sub: 'Quick access to the tools you need',
  },
  quick: {
    title: 'Quick Actions',
    sub: 'Run common fixes and utilities with one click',
  },
  disk: {
    title: 'Disk Tools',
    sub: 'Analyze storage and find large files fast',
  },
  network: {
    title: 'Network',
    sub: 'Ping, trace, and inspect connection status',
  },
  clipboard: {
    title: 'Clipboard',
    sub: 'Pinned items stay across sessions',
  },
  process: {
    title: 'Processes',
    sub: 'Search and stop with safety warnings',
  },
  startup: {
    title: 'Startup',
    sub: 'Enable or disable apps that launch on boot',
  },
  notes: {
    title: 'Notes',
    sub: 'Scratchpad for snippets and reminders',
  },
  settings: {
    title: 'Settings',
    sub: 'Tune the look and feel',
  },
};

const el = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const series = {
  cpu: [],
  mem: [],
  disk: [],
};
let recentClipboardCache = [];
let notesCache = '';
let recentProcessCache = [];

const recentCommands = () => {
  try {
    return JSON.parse(localStorage.getItem('multitoolRecent') || '[]');
  } catch {
    return [];
  }
};

const saveRecent = (id) => {
  const list = recentCommands().filter((x) => x !== id);
  list.unshift(id);
  localStorage.setItem('multitoolRecent', JSON.stringify(list.slice(0, 8)));
};

const scheduleHistory = () => {
  try {
    return JSON.parse(localStorage.getItem('multitoolScheduleHistory') || '[]');
  } catch {
    return [];
  }
};

const addScheduleHistory = (entry) => {
  const list = scheduleHistory();
  list.unshift(entry);
  localStorage.setItem('multitoolScheduleHistory', JSON.stringify(list.slice(0, 20)));
};

const loadAutomations = () => {
  try {
    return JSON.parse(localStorage.getItem('multitoolAutomations') || '[]');
  } catch {
    return [];
  }
};

const saveAutomations = (list) => {
  localStorage.setItem('multitoolAutomations', JSON.stringify(list));
};

const automationTimers = {};
const automationHistory = () => {
  try {
    return JSON.parse(localStorage.getItem('multitoolAutomationHistory') || '[]');
  } catch {
    return [];
  }
};

const addAutomationHistory = (entry) => {
  const list = automationHistory();
  list.unshift(entry);
  localStorage.setItem('multitoolAutomationHistory', JSON.stringify(list.slice(0, 40)));
};

const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const titleEl = el('page-title');
const subEl = el('page-sub');

const setActive = (page) => {
  navItems.forEach((item) => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  pages.forEach((section) => {
    section.classList.toggle('active', section.dataset.page === page);
  });

  const meta = titles[page] || titles.dashboard;
  if (titleEl) titleEl.textContent = meta.title;
  if (subEl) subEl.textContent = meta.sub;
};

navItems.forEach((item) => {
  item.addEventListener('click', () => {
    setActive(item.dataset.page);
  });
});

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return value.toFixed(1) + ' ' + units[index];
};

const formatUptime = (seconds) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return days + 'd ' + hours + 'h ' + mins + 'm';
};

const updateStats = async () => {
  try {
    const stats = await window.api.getStats();
    el('cpuValue').textContent = stats.cpu + '%';
    el('cpuSub').textContent = 'Live usage';
    el('memValue').textContent = formatBytes(stats.memoryUsed);
    el('memSub').textContent =
      Math.round((stats.memoryUsed / stats.memoryTotal) * 100) + '% in use';

    if (stats.disk) {
      el('diskValue').textContent = formatBytes(stats.disk.free);
      el('diskSub').textContent = 'Free on ' + stats.disk.name + ':';
      const diskPct = stats.disk.total
        ? Math.round((stats.disk.used / stats.disk.total) * 100)
        : 0;
      series.disk.push(diskPct);
    } else {
      el('diskValue').textContent = '--';
      el('diskSub').textContent = 'No disk data';
    }

    const netText = stats.network.length
      ? stats.network.map((n) => n.name + ': ' + n.address).join(', ')
      : 'No active network';
    el('netValue').textContent = netText;
    el('uptimeValue').textContent = formatUptime(stats.uptime);
    el('systemUptime').textContent = 'Uptime ' + formatUptime(stats.uptime);

    series.cpu.push(stats.cpu);
    const memPct = Math.round((stats.memoryUsed / stats.memoryTotal) * 100);
    series.mem.push(memPct);
    ['cpu', 'mem', 'disk'].forEach((key) => {
      if (series[key].length > 40) series[key].shift();
    });
    drawSparkline('cpuChart', series.cpu);
    drawSparkline('memChart', series.mem);
    drawSparkline('diskChart', series.disk);
  } catch (err) {
    // ignore
  }
};

const drawSparkline = (id, data) => {
  const canvas = el(id);
  if (!canvas || data.length < 2) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(79, 209, 255, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((value, index) => {
    const x = (index / (data.length - 1)) * (width - 8) + 4;
    const y = height - (value / 100) * (height - 8) - 4;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
};

const wireSparklineHover = (canvasId, tooltipId, label) => {
  const canvas = el(canvasId);
  const tip = el(tooltipId);
  if (!canvas || !tip) return;
  const onMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const data =
      canvasId === 'cpuChart' ? series.cpu : canvasId === 'memChart' ? series.mem : series.disk;
    if (!data.length) return;
    const index = Math.round((x / rect.width) * (data.length - 1));
    const value = data[Math.max(0, Math.min(index, data.length - 1))];
    tip.textContent = label + ' ' + value + '%';
    tip.style.opacity = '1';
  };
  const onLeave = () => {
    tip.style.opacity = '0';
  };
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseleave', onLeave);
};

const refreshDrives = async () => {
  const drives = await window.api.getDrives();
  const container = el('drivesList');
  container.innerHTML = '';
  drives.forEach((drive) => {
    const item = document.createElement('div');
    item.className = 'glass-inset card';
    const percent = drive.total ? Math.round((drive.used / drive.total) * 100) : 0;
    item.innerHTML =
      '<div class="card-title">' +
      drive.name +
      ':</div>' +
      '<div class="card-sub">' +
      percent +
      '% used</div>' +
      '<div class="bar"><span style="width:' +
      percent +
      '%"></span></div>' +
      '<div class="card-sub">' +
      formatBytes(drive.free) +
      ' free</div>';
    container.appendChild(item);
  });
};

const scanLargeFiles = async () => {
  const target = el('scanPath').value || 'C:\\';
  const minSizeMb = Number(el('scanMinSize').value || 0);
  const exclude = el('scanExclude').value || '';
  const resultsEl = el('scanResults');
  resultsEl.textContent = 'Scanning...';
  try {
    const results = await window.api.scanLargeFiles({
      path: target,
      minBytes: minSizeMb * 1024 * 1024,
      exclude,
    });
    resultsEl.innerHTML = '';
    results.forEach((file) => {
      const row = document.createElement('div');
      row.className = 'item-row glass-inset card';
      row.innerHTML =
        '<div>' +
        '<div>' +
        file.FullName +
        '</div>' +
        '<div class="item-meta">' +
        formatBytes(file.Length) +
        '</div>' +
        '</div>';
      resultsEl.appendChild(row);
    });
  } catch (err) {
    resultsEl.textContent = err.message || 'Scan failed.';
  }
};

const setActionStatus = (text) => {
  el('actionStatus').textContent = text;
};

const wireQuickActions = () => {
  el('actionClearTemp').addEventListener('click', async () => {
    setActionStatus('Clearing temp...');
    try {
      const msg = await window.api.clearTemp();
      window.api.notify('Fluxtool', msg);
      setActionStatus(msg);
    } catch (err) {
      setActionStatus('Temp cleanup failed.');
    }
  });
  el('actionFlushDns').addEventListener('click', async () => {
    setActionStatus('Flushing DNS...');
    try {
      await window.api.flushDns();
      window.api.notify('Fluxtool', 'DNS flushed.');
      setActionStatus('DNS flushed.');
    } catch (err) {
      setActionStatus('DNS flush failed.');
    }
  });
  el('actionRestartExplorer').addEventListener('click', async () => {
    setActionStatus('Restarting Explorer...');
    try {
      await window.api.restartExplorer();
      window.api.notify('Fluxtool', 'Explorer restarted.');
      setActionStatus('Explorer restarted.');
    } catch (err) {
      setActionStatus('Explorer restart failed.');
    }
  });
  el('actionDeviceManager').addEventListener('click', async () => {
    try {
      await window.api.openDeviceManager();
      setActionStatus('Opened Device Manager.');
    } catch (err) {
      setActionStatus('Device Manager failed.');
    }
  });
  el('actionBatteryReport').addEventListener('click', async () => {
    setActionStatus('Generating report...');
    try {
      await window.api.batteryReport();
      window.api.notify('Fluxtool', 'Battery report generated.');
      setActionStatus('Battery report generated.');
    } catch (err) {
      setActionStatus('Battery report failed.');
    }
  });
  el('actionKillHung').addEventListener('click', async () => {
    setActionStatus('Closing hung apps...');
    try {
      await window.api.killHung();
      window.api.notify('Fluxtool', 'Closed unresponsive apps.');
      setActionStatus('Closed unresponsive apps.');
    } catch (err) {
      setActionStatus('Kill hung apps failed.');
    }
  });
};

const wireNetworkTools = () => {
  const output = el('netOutput');
  el('netPing').addEventListener('click', async () => {
    output.textContent = 'Running ping...';
    output.textContent = await window.api.ping(el('netTarget').value || '8.8.8.8');
  });
  el('netTrace').addEventListener('click', async () => {
    output.textContent = 'Running traceroute...';
    output.textContent = await window.api.trace(el('netTarget').value || '8.8.8.8');
  });
  el('netDns').addEventListener('click', async () => {
    output.textContent = 'Running DNS lookup...';
    output.textContent = await window.api.dns(el('netTarget').value || '8.8.8.8');
  });
};

const wireWindowControls = () => {
  const min = el('winMin');
  const max = el('winMax');
  const close = el('winClose');
  if (min) min.addEventListener('click', () => window.api.minimize());
  if (max) max.addEventListener('click', () => window.api.maximize());
  if (close) close.addEventListener('click', () => window.api.close());
};

const wireCommandPalette = () => {
  const palette = el('commandPalette');
  const input = el('paletteInput');
  const listEl = el('paletteList');
  if (!palette || !input || !listEl) return;

  const commands = [
    { id: 'nav-dashboard', label: 'Go to Dashboard', action: () => setActive('dashboard') },
    { id: 'nav-quick', label: 'Go to Quick Actions', action: () => setActive('quick') },
    { id: 'nav-disk', label: 'Go to Disk Tools', action: () => setActive('disk') },
    { id: 'nav-network', label: 'Go to Network Tools', action: () => setActive('network') },
    { id: 'nav-clipboard', label: 'Go to Clipboard', action: () => setActive('clipboard') },
    { id: 'nav-process', label: 'Go to Processes', action: () => setActive('process') },
    { id: 'nav-startup', label: 'Go to Startup', action: () => setActive('startup') },
    { id: 'nav-notes', label: 'Go to Notes', action: () => setActive('notes') },
    { id: 'nav-settings', label: 'Go to Settings', action: () => setActive('settings') },
    { id: 'act-clear-temp', label: 'Clear Temp Files', action: () => window.api.clearTemp() },
    { id: 'act-flush-dns', label: 'Flush DNS', action: () => window.api.flushDns() },
    { id: 'act-restart-explorer', label: 'Restart Explorer', action: () => window.api.restartExplorer() },
    { id: 'act-battery', label: 'Generate Battery Report', action: () => window.api.batteryReport() },
    { id: 'act-device', label: 'Open Device Manager', action: () => window.api.openDeviceManager() },
    { id: 'act-kill-hung', label: 'Kill Hung Apps', action: () => window.api.killHung() },
    { id: 'open-automation', label: 'Automation: Open Center', action: () => setActive('automation') },
    { id: 'open-processes', label: 'Focus Process Search', action: () => {
      setActive('process');
      const input = el('processSearch');
      if (input) input.focus();
    }},
    { id: 'open-clipboard', label: 'Clipboard: Focus Search', action: () => {
      setActive('clipboard');
      const input = el('clipboardSearch');
      if (input) input.focus();
    }},
    { id: 'open-notes', label: 'Notes: Focus Editor', action: () => {
      setActive('notes');
      const input = el('notesArea');
      if (input) input.focus();
    }},
    { id: 'app-update', label: 'App: Check Updates', action: () => el('checkUpdates')?.click() },
    { id: 'app-automation', label: 'Automation: Create Schedule', action: () => {
      setActive('automation');
      el('autoName')?.focus();
    }},
  ];

  let activeIndex = 0;

  const renderList = (query) => {
    const q = query.toLowerCase();
    const recent = recentCommands();
    const dynamic = [];
    if (notesCache) {
      dynamic.push({
        id: 'notes-open',
        label: 'Notes: ' + notesCache.slice(0, 60),
        action: () => setActive('notes'),
      });
    }
    const clipItems = recentClipboardCache
      .map((item, idx) => ({
        id: 'clip-' + item.id,
        label: 'Clipboard: ' + item.text.slice(0, 60),
        action: () => window.api.writeClipboard(item.text),
      }))
      .slice(0, 5);
    dynamic.push(...clipItems);

    const processItems = recentProcessCache
      .map((item) => ({
        id: 'proc-' + item.Id,
        label: 'Process: End ' + item.ProcessName + ' (PID ' + item.Id + ')',
        action: async () => {
          const ok = window.confirm(
            'End ' + item.ProcessName + ' (PID ' + item.Id + ')?',
          );
          if (!ok) return;
          await window.api.killProcess(item.Id);
        },
      }))
      .slice(0, 5);
    dynamic.push(...processItems);

    const ranked = [...commands, ...dynamic]
      .filter((cmd) => fuzzyMatch(cmd.label.toLowerCase(), q))
      .sort((a, b) => {
        const ai = recent.indexOf(a.id);
        const bi = recent.indexOf(b.id);
        const av = ai === -1 ? 999 : ai;
        const bv = bi === -1 ? 999 : bi;
        if (av === bv) {
          return a.label.localeCompare(b.label);
        }
        return av - bv;
      });
    listEl.innerHTML = '';
    ranked.forEach((cmd, index) => {
      const row = document.createElement('div');
      row.className = 'palette-item' + (index === activeIndex ? ' active' : '');
      row.textContent = cmd.label;
      row.addEventListener('click', () => runCommand(cmd));
      listEl.appendChild(row);
    });
    if (!ranked.length) {
      listEl.innerHTML = '<div class="card-sub">No matches.</div>';
    }
  };

  const runCommand = (cmd) => {
    cmd.action();
    saveRecent(cmd.id);
    palette.classList.remove('active');
  };

  const openPalette = (prefill = '') => {
    palette.classList.add('active');
    input.value = prefill;
    activeIndex = 0;
    renderList(prefill);
    input.focus();
  };

  const closePalette = () => {
    palette.classList.remove('active');
  };

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openPalette();
    }
    if (e.key === 'Escape' && palette.classList.contains('active')) {
      closePalette();
    }
  });

  input.addEventListener('input', () => {
    activeIndex = 0;
    renderList(input.value);
  });

  input.addEventListener('keydown', (e) => {
    const items = listEl.querySelectorAll('.palette-item');
    if (e.key === 'ArrowDown') {
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      renderList(input.value);
    } else if (e.key === 'ArrowUp') {
      activeIndex = Math.max(activeIndex - 1, 0);
      renderList(input.value);
    } else if (e.key === 'Enter') {
      const list = commands.filter((cmd) =>
        cmd.label.toLowerCase().includes(input.value.toLowerCase()),
      );
      if (list[activeIndex]) runCommand(list[activeIndex]);
    }
  });

  el('runShortcut').addEventListener('click', () => openPalette());

  const searchBox = document.querySelector('.topbar .search input');
  if (searchBox) {
    searchBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        openPalette(searchBox.value);
        searchBox.value = '';
      }
    });
  }
};

const fuzzyMatch = (text, query) => {
  if (!query) return true;
  let ti = 0;
  for (let qi = 0; qi < query.length; qi += 1) {
    const q = query[qi];
    ti = text.indexOf(q, ti);
    if (ti === -1) return false;
    ti += 1;
  }
  return true;
};

const applyTheme = (mode) => {
  document.documentElement.dataset.theme = mode;
  localStorage.setItem('multitoolTheme', mode);
};

const wireTheme = () => {
  const saved = localStorage.getItem('multitoolTheme') || 'dark';
  applyTheme(saved);
  el('themeLight').addEventListener('click', () => applyTheme('light'));
  el('themeDark').addEventListener('click', () => applyTheme('dark'));
};

const wireUpdates = () => {
  const btn = el('checkUpdates');
  const status = el('updateStatus');
  if (!btn || !status) return;
  btn.addEventListener('click', async () => {
    status.textContent = 'Checking...';
    const result = await window.api.checkUpdates();
    status.textContent = result || 'No updates found';
  });

  window.api.onUpdateReady(() => {
    status.textContent = 'Update ready — restart to install.';
  });
};

const wireAutostart = async () => {
  const toggle = el('autoStartToggle');
  if (!toggle) return;
  const enabled = await window.api.getAutostart();
  toggle.checked = !!enabled;
  toggle.addEventListener('change', () => {
    window.api.setAutostart(toggle.checked);
  });
};

const wireVersion = async () => {
  const target = el('appVersion');
  if (!target) return;
  const version = await window.api.getVersion();
  target.textContent = 'v' + version;
};

const wirePaths = async () => {
  const target = el('appPaths');
  if (!target) return;
  const paths = await window.api.getPaths();
  target.textContent = 'Data: ' + paths.userData + ' • Logs: ' + paths.logs;
};

const wireScheduler = () => {
  const actionEl = el('scheduleAction');
  const minutesEl = el('scheduleMinutes');
  const toggleEl = el('scheduleToggle');
  const runNowEl = el('scheduleRunNow');
  const statusEl = el('scheduleStatus');
  const historyEl = el('scheduleHistory');
  let timer = null;

  const renderHistory = () => {
    const list = scheduleHistory();
    historyEl.innerHTML = '';
    if (!list.length) {
      historyEl.innerHTML = '<div class="card-sub">No runs yet.</div>';
      return;
    }
    list.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'history-item';
      row.textContent = item;
      historyEl.appendChild(row);
    });
  };

  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
    statusEl.textContent = 'Not running';
    toggleEl.textContent = 'Start';
    localStorage.removeItem('multitoolSchedule');
  };

  const start = () => {
    const minutes = Math.max(5, Number(minutesEl.value || 60));
    statusEl.textContent = 'Running every ' + minutes + ' min';
    toggleEl.textContent = 'Stop';
    localStorage.setItem(
      'multitoolSchedule',
      JSON.stringify({ minutes, action: actionEl.value }),
    );
    timer = setInterval(async () => {
      const action = actionEl.value;
      if (action === 'clearTemp') await window.api.clearTemp();
      if (action === 'flushDns') await window.api.flushDns();
      if (action === 'restartExplorer') await window.api.restartExplorer();
      if (action === 'batteryReport') await window.api.batteryReport();
      window.api.notify('Fluxtool', 'Scheduled task complete.');
      addScheduleHistory(
        new Date().toLocaleString() + ' • ' + action + ' complete',
      );
      renderHistory();
    }, minutes * 60000);
  };

  toggleEl.addEventListener('click', () => {
    if (timer) stop();
    else start();
  });

  if (runNowEl) runNowEl.addEventListener('click', async () => {
    const action = actionEl.value;
    if (action === 'clearTemp') await window.api.clearTemp();
    if (action === 'flushDns') await window.api.flushDns();
    if (action === 'restartExplorer') await window.api.restartExplorer();
    if (action === 'batteryReport') await window.api.batteryReport();
    addScheduleHistory(new Date().toLocaleString() + ' • ' + action + ' run');
    renderHistory();
  });

  const saved = localStorage.getItem('multitoolSchedule');
  if (saved) {
    try {
      const config = JSON.parse(saved);
      actionEl.value = config.action || 'clearTemp';
      minutesEl.value = config.minutes || 60;
      start();
    } catch (err) {
      // ignore
    }
  }
  renderHistory();
};

const renderAutomation = () => {
  const list = loadAutomations();
  const container = el('automationList');
  container.innerHTML = '';
  if (!list.length) {
    container.innerHTML = '<div class="card-sub">No schedules yet.</div>';
    return;
  }
  list.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'glass-inset card item-row';
    row.innerHTML =
      '<div>' +
      '<div class="card-title">' +
      item.name +
      '</div>' +
      '<div class="card-sub">' +
      item.action +
      ' every ' +
      item.minutes +
      ' min</div>' +
      '</div>' +
      '<div class="inline">' +
      '<button class="btn ghost" data-action="run">Run</button>' +
      '<button class="btn ghost" data-action="toggle">' +
      (item.enabled ? 'Disable' : 'Enable') +
      '</button>' +
      '<button class="btn ghost" data-action="delete">Delete</button>' +
      '</div>';

  const run = async () => {
    if (item.action === 'clearTemp') await window.api.clearTemp();
    if (item.action === 'flushDns') await window.api.flushDns();
    if (item.action === 'restartExplorer') await window.api.restartExplorer();
    if (item.action === 'batteryReport') await window.api.batteryReport();
    const entry = new Date().toLocaleString() + ' • ' + item.name + ' run';
    addScheduleHistory(entry);
    addAutomationHistory(entry);
    renderAutomationHistory();
  };

    row.querySelector('[data-action="run"]').addEventListener('click', run);
    row.querySelector('[data-action="toggle"]').addEventListener('click', () => {
      item.enabled = !item.enabled;
      const next = loadAutomations().map((x) => (x.id === item.id ? item : x));
      saveAutomations(next);
      syncAutomationTimers();
      renderAutomation();
    });
    row.querySelector('[data-action="delete"]').addEventListener('click', () => {
      const next = loadAutomations().filter((x) => x.id !== item.id);
      saveAutomations(next);
      syncAutomationTimers();
      renderAutomation();
    });

    container.appendChild(row);
  });
};

const syncAutomationTimers = () => {
  const list = loadAutomations();
  Object.values(automationTimers).forEach((t) => clearInterval(t));
  Object.keys(automationTimers).forEach((k) => delete automationTimers[k]);
  list.forEach((item) => {
    if (!item.enabled) return;
    automationTimers[item.id] = setInterval(async () => {
      if (item.action === 'clearTemp') await window.api.clearTemp();
      if (item.action === 'flushDns') await window.api.flushDns();
      if (item.action === 'restartExplorer') await window.api.restartExplorer();
      if (item.action === 'batteryReport') await window.api.batteryReport();
      const entry = new Date().toLocaleString() + ' • ' + item.name + ' complete';
      addScheduleHistory(entry);
      addAutomationHistory(entry);
    }, item.minutes * 60000);
  });
};

const wireAutomation = () => {
  const addBtn = el('autoAdd');
  if (!addBtn) return;
  addBtn.addEventListener('click', () => {
    const name = el('autoName').value || 'Schedule';
    const action = el('autoAction').value;
    const minutes = Math.max(5, Number(el('autoMinutes').value || 60));
    const list = loadAutomations();
    list.push({
      id: Date.now().toString(36),
      name,
      action,
      minutes,
      enabled: true,
    });
    saveAutomations(list);
    el('autoName').value = '';
    renderAutomation();
    syncAutomationTimers();
  });
  renderAutomation();
  syncAutomationTimers();
  renderAutomationHistory();
};

const renderAutomationHistory = () => {
  const list = automationHistory();
  const container = el('automationHistory');
  container.innerHTML = '';
  if (!list.length) {
    container.innerHTML = '<div class="card-sub">No runs yet.</div>';
    return;
  }
  list.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'history-item';
    row.innerHTML = '<strong>' + item.split('•')[0].trim() + '</strong> ' + item.split('•')[1];
    container.appendChild(row);
  });
};

const renderClipboard = async () => {
  const list = await window.api.getClipboard();
  recentClipboardCache = list || [];
  const search = (el('clipboardSearch').value || '').toLowerCase();
  const tagFilter = (el('clipboardTagFilter').value || '').toLowerCase();
  const container = el('clipboardList');
  container.innerHTML = '';

  const filtered = list.filter((item) => {
    const textMatch = item.text.toLowerCase().includes(search);
    const tags = (item.tags || []).map((t) => t.toLowerCase());
    const tagMatch = tagFilter ? tags.some((t) => t.includes(tagFilter)) : true;
    return textMatch && tagMatch;
  });

  if (!filtered.length) {
    container.innerHTML = '<div class="card-sub">Clipboard history is empty.</div>';
    return;
  }

  filtered.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'glass-inset card';
    const tags = (item.tags || []).join(', ');
    const expireText = item.expiresAt ? 'Expires ' + new Date(item.expiresAt).toLocaleString() : '';
    row.innerHTML =
      '<div class="item-row">' +
      '<div>' +
      '<div>' +
      item.text +
      '</div>' +
      '<div class="item-meta">' +
      new Date(item.ts).toLocaleString() +
      (tags ? ' • Tags: ' + tags : '') +
      (expireText ? ' • ' + expireText : '') +
      '</div>' +
      (item.tags && item.tags.length
        ? '<div class="tag-row">' +
          item.tags.map((t) => '<span class="tag-chip">' + t + '</span>').join('') +
          '</div>'
        : '') +
      '</div>' +
      '<div class="inline">' +
      '<button class="btn ghost" data-action="copy">Copy</button>' +
      '<button class="btn ghost" data-action="tag">Tag</button>' +
      '<button class="btn ghost" data-action="expire">Expire</button>' +
      '<button class="btn ghost" data-action="pin">' +
      (item.pinned ? 'Unpin' : 'Pin') +
      '</button>' +
      '<button class="btn ghost" data-action="delete">Delete</button>' +
      '</div>' +
      '</div>';

    row.querySelector('[data-action="copy"]').addEventListener('click', () => {
      window.api.writeClipboard(item.text);
    });
    row.querySelector('[data-action="tag"]').addEventListener('click', async () => {
      const input = window.prompt('Enter tags (comma separated):', (item.tags || []).join(', '));
      if (input === null) return;
      const tagsList = input
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await window.api.tagClipboard(item.id, tagsList);
      renderClipboard();
    });
    row.querySelector('[data-action="expire"]').addEventListener('click', async () => {
      const input = window.prompt('Expire in minutes (0 to remove):', '0');
      if (input === null) return;
      await window.api.expireClipboard(item.id, Number(input));
      renderClipboard();
    });
    row.querySelector('[data-action="pin"]').addEventListener('click', async () => {
      await window.api.pinClipboard(item.id, !item.pinned);
      renderClipboard();
    });
    row.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      await window.api.deleteClipboard(item.id);
      renderClipboard();
    });

    container.appendChild(row);
  });
};

const renderProcesses = async () => {
  const list = await window.api.listProcesses();
  recentProcessCache = list || [];
  const search = (el('processSearch').value || '').toLowerCase();
  const sort = el('processSort').value || 'cpu';
  const container = el('processList');
  container.innerHTML = '';

  const sorted = [...list];
  if (sort === 'ram') {
    sorted.sort((a, b) => (b.WorkingSet || 0) - (a.WorkingSet || 0));
  } else if (sort === 'name') {
    sorted.sort((a, b) => (a.ProcessName || '').localeCompare(b.ProcessName || ''));
  } else {
    sorted.sort((a, b) => (b.CPU || 0) - (a.CPU || 0));
  }

  const risky = [
    'explorer',
    'wininit',
    'csrss',
    'services',
    'lsass',
    'smss',
    'svchost',
    'dwm',
  ];

  sorted
    .filter((p) => p.ProcessName.toLowerCase().includes(search))
    .slice(0, 80)
    .forEach((proc) => {
      const row = document.createElement('div');
      row.className = 'glass-inset card item-row';
      row.innerHTML =
        '<div>' +
        '<div class="card-title">' +
        proc.ProcessName +
        ' (PID ' +
        proc.Id +
        ')</div>' +
        '<div class="card-sub">CPU ' +
        (proc.CPU ? proc.CPU.toFixed(1) : 0) +
        ' | RAM ' +
        formatBytes(proc.WorkingSet) +
        '</div>' +
        '</div>' +
        '<button class="btn danger">End</button>';

      row.querySelector('button').addEventListener('click', async () => {
        const name = proc.ProcessName.toLowerCase();
        if (risky.some((r) => name.includes(r))) {
          const ok = window.confirm(
            'This looks like a system process. Ending it may destabilize Windows. Continue?',
          );
          if (!ok) return;
        }
        await window.api.killProcess(proc.Id);
        renderProcesses();
      });
      container.appendChild(row);
    });
};

const renderStartup = async () => {
  const data = await window.api.listStartup();
  const enabled = data.enabled || [];
  const disabled = data.disabled || {};

  const enabledContainer = el('startupList');
  const disabledContainer = el('startupDisabled');
  enabledContainer.innerHTML = '';
  disabledContainer.innerHTML = '';

  enabled.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'glass-inset card item-row';
    row.innerHTML =
      '<div>' +
      '<div class="card-title">' +
      item.name +
      '</div>' +
      '<div class="card-sub">' +
      item.command +
      '</div>' +
      '</div>' +
      '<button class="btn ghost">Disable</button>';
    row.querySelector('button').addEventListener('click', async () => {
      await window.api.disableStartup(item.name, item.command);
      renderStartup();
    });
    enabledContainer.appendChild(row);
  });

  Object.keys(disabled).forEach((name) => {
    const row = document.createElement('div');
    row.className = 'glass-inset card item-row';
    row.innerHTML =
      '<div>' +
      '<div class="card-title">' +
      name +
      '</div>' +
      '<div class="card-sub">' +
      disabled[name] +
      '</div>' +
      '</div>' +
      '<button class="btn ghost">Enable</button>';
    row.querySelector('button').addEventListener('click', async () => {
      await window.api.enableStartup(name);
      renderStartup();
    });
    disabledContainer.appendChild(row);
  });
};

const wireNotes = async () => {
  const saved = await window.api.getNotes();
  notesCache = saved || '';
  el('notesArea').value = saved;
  el('notesSave').addEventListener('click', async () => {
    el('notesStatus').textContent = 'Saving...';
    await window.api.setNotes(el('notesArea').value);
    notesCache = el('notesArea').value;
    el('notesStatus').textContent = 'Saved.';
  });
};

const wireDashboardButtons = () => {
  el('dashCleanup').addEventListener('click', async () => {
    try {
      await window.api.clearTemp();
    } catch (err) {
      // ignore
    }
  });
  el('dashLogs').addEventListener('click', () => {
    el('netOutput').textContent = 'Logs are stored in the app data folder.';
  });
};

const init = async () => {
  setActive('dashboard');

  wireQuickActions();
  wireNetworkTools();
  wireDashboardButtons();
  wireWindowControls();
  wireCommandPalette();
  wireTheme();
  wireUpdates();
  wireAutostart();
  wireVersion();
  wirePaths();
  wireScheduler();
  wireAutomation();
  wireSparklineHover('cpuChart', 'cpuTip', 'CPU');
  wireSparklineHover('memChart', 'memTip', 'RAM');
  wireSparklineHover('diskChart', 'diskTip', 'Disk');

  el('scanBtn').addEventListener('click', scanLargeFiles);
  el('clipboardClear').addEventListener('click', async () => {
    await window.api.clearClipboard();
    renderClipboard();
  });
  el('clipboardSearch').addEventListener('input', renderClipboard);
  el('clipboardTagFilter').addEventListener('input', renderClipboard);
  el('clipboardExpireSave').addEventListener('click', async () => {
    const minutes = Number(el('clipboardExpire').value || 0);
    await window.api.setClipboardSettings({ expireMinutes: minutes });
    renderClipboard();
  });
  el('processRefresh').addEventListener('click', renderProcesses);
  el('processSearch').addEventListener('input', renderProcesses);
  el('processSort').addEventListener('change', renderProcesses);

  await updateStats();
  await refreshDrives();
  await renderClipboard();
  await renderProcesses();
  await renderStartup();
  await wireNotes();

  setInterval(updateStats, 2000);
  setInterval(renderClipboard, 3000);
};

const runLoading = async () => {
  const bar = el('loadingBar');
  const screen = el('loadingScreen');
  if (!bar || !screen) return;

  const steps = [18, 36, 52, 68, 82, 94, 100];
  for (const value of steps) {
    bar.style.width = value + '%';
    await sleep(180);
  }
  await sleep(200);
  screen.classList.add('hidden');
  await sleep(400);
  screen.style.display = 'none';
};

const tourSteps = [
  {
    title: 'Welcome to Multitool',
    body: 'This quick tour will show you the essentials. You can skip anytime.',
    page: 'dashboard',
    pos: 'center',
  },
  {
    title: 'System Dashboard',
    body: 'Live CPU, memory, disk and network info. Glance here to see how your PC is doing.',
    page: 'dashboard',
    pos: 'dock',
    target: '.stat-grid',
    union: '.stat-card',
  },
  {
    title: 'Quick Actions',
    body: 'One-click fixes like clearing temp files, flushing DNS, and restarting Explorer.',
    page: 'quick',
    pos: 'dock',
    target: '.tile-grid',
    deblur: true,
    union: '.tile',
  },
  {
    title: 'Disk Tools',
    body: 'Scan drives and find the largest files when space gets tight.',
    page: 'disk',
    pos: 'dock',
    target: '#scanBtn',
  },
  {
    title: 'Network Tools',
    body: 'Ping, trace, and DNS lookups for fast troubleshooting.',
    page: 'network',
    pos: 'dock',
    target: '#netOutput',
  },
  {
    title: 'Clipboard & Notes',
    body: 'Keep clipboard history and quick notes in one place.',
    page: 'clipboard',
    pos: 'dock',
    target: '#clipboardList',
    union: '.card',
  },
  {
    title: 'Process & Startup',
    body: 'See running apps and manage what launches on boot.',
    page: 'process',
    pos: 'dock',
    target: '#processList',
    union: '.card',
  },
  {
    title: 'All set',
    body: 'That’s it. You can revisit any section from the sidebar.',
    page: 'settings',
    pos: 'center',
  },
];

const startTour = () => {
  const tour = el('tour');
  const title = el('tourTitle');
  const body = el('tourBody');
  const stepsEl = el('tourSteps');
  const prev = el('tourPrev');
  const next = el('tourNext');
  const skip = el('tourSkip');
  if (!tour || !title || !body || !stepsEl || !prev || !next || !skip) return;

  let index = 0;
  let highlighted = [];
  stepsEl.innerHTML = '';
  tourSteps.forEach(() => stepsEl.appendChild(document.createElement('span')));

  const clearHighlights = () => {
    highlighted.forEach((node) => {
      node.classList.remove('tour-highlight');
      node.style.removeProperty('--tour-radius');
    });
    highlighted = [];
  };

  const getHighlightNodes = (step, target) => {
    if (step.union) {
      const nodes = Array.from(target.querySelectorAll(step.union));
      return nodes.length ? nodes : [target];
    }
    return [target];
  };

  const getUnionRect = (elements) => {
    const rects = Array.from(elements)
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    if (!rects.length) return null;
    const left = Math.min(...rects.map((r) => r.left));
    const top = Math.min(...rects.map((r) => r.top));
    const right = Math.max(...rects.map((r) => r.right));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  };

  const positionDocked = (step) => {
    if (!step.target) return;
    const target = document.querySelector(step.target);
    if (!target) {
      return;
    }
    const highlightNodes = getHighlightNodes(step, target);
    const rect =
      step.union && highlightNodes.length
        ? getUnionRect(highlightNodes)
        : target.getBoundingClientRect();
    if (!rect) return;

    const card = tour.querySelector('.tour-card');
    if (!card) return;
    const cardRect = card.getBoundingClientRect();
    const gap = 16;
    const margin = 16;
    const space = {
      right: window.innerWidth - rect.right - margin,
      left: rect.left - margin,
      bottom: window.innerHeight - rect.bottom - margin,
      top: rect.top - margin,
    };

    const fitsRight = space.right >= cardRect.width + gap;
    const fitsLeft = space.left >= cardRect.width + gap;
    const fitsBottom = space.bottom >= cardRect.height + gap;
    const fitsTop = space.top >= cardRect.height + gap;

    let left = rect.right + gap;
    let top = rect.top;

    if (fitsBottom) {
      left = rect.left;
      top = rect.bottom + gap;
    } else if (fitsTop) {
      left = rect.left;
      top = rect.top - cardRect.height - gap;
    } else if (fitsRight) {
      left = rect.right + gap;
      top = rect.top;
    } else if (fitsLeft) {
      left = rect.left - cardRect.width - gap;
      top = rect.top;
    }

    left = Math.max(margin, Math.min(left, window.innerWidth - cardRect.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - cardRect.height - margin));

    card.style.left = left + 'px';
    card.style.top = top + 'px';
  };

  const clearDocked = () => {
    const card = tour.querySelector('.tour-card');
    if (card) {
      card.style.left = '';
      card.style.top = '';
    }
  };

  const render = () => {
    const step = tourSteps[index];
    title.textContent = step.title;
    body.textContent = step.body;
    setActive(step.page);
    const docked = step.pos === 'dock';
    tour.classList.toggle('docked', docked);
    const deblur = docked ? step.deblur !== false : !!step.deblur;
    tour.classList.toggle('deblur', deblur);
    Array.from(stepsEl.children).forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
    prev.disabled = index === 0;
    next.textContent = index === tourSteps.length - 1 ? 'Finish' : 'Next';

    clearHighlights();
    if (step.pos === 'dock') {
      requestAnimationFrame(() => {
        const target = document.querySelector(step.target);
        if (target) {
          highlighted = getHighlightNodes(step, target);
          highlighted.forEach((node) => {
            const radius = getComputedStyle(node).borderRadius || '12px';
            node.style.setProperty('--tour-radius', radius);
            node.classList.add('tour-highlight');
          });
        }
        positionDocked(step);
      });
    } else {
      clearDocked();
    }
  };

  const cleanup = () => {
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('scroll', handleResize, true);
  };

  const finish = () => {
    tour.classList.remove('active');
    clearHighlights();
    cleanup();
  };

  prev.onclick = () => {
    if (index > 0) {
      index -= 1;
      render();
    }
  };

  next.onclick = () => {
    if (index < tourSteps.length - 1) {
      index += 1;
      render();
    } else {
      localStorage.setItem('multitoolTourSeen', 'true');
      finish();
    }
  };

  skip.onclick = () => {
    localStorage.setItem('multitoolTourSeen', 'true');
    finish();
  };

  render();
  tour.classList.add('active');

  const handleResize = () => {
    const step = tourSteps[index];
    if (step.pos === 'dock') {
      positionDocked(step);
    }
  };
  window.addEventListener('resize', handleResize);
  window.addEventListener('scroll', handleResize, true);
};

const boot = async () => {
  await init();
  await runLoading();
  if (!localStorage.getItem('multitoolTourSeen')) {
    startTour();
  }
};

boot();

const restartButton = el('restartTour');
if (restartButton) {
  restartButton.addEventListener('click', () => {
    localStorage.removeItem('multitoolTourSeen');
    startTour();
  });
}

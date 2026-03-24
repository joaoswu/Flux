# Fluxtool

Fluxtool is a modern Windows multitool for power users, built with Electron. It combines fast system utilities, automation, diagnostics, and productivity tools in a sleek glass UI.

## Highlights
- Live system dashboard with CPU/RAM/Disk metrics
- One-click quick actions (clear temp, flush DNS, restart Explorer, battery report)
- Disk scan with size filters + exclude patterns
- Network tools: ping, traceroute, DNS lookup
- Clipboard history with tags + auto-expire rules
- Process manager with safety prompts
- Startup manager
- Automation center with multiple schedules + run history
- Command palette (Ctrl+K)
- Tray mode + autostart toggle

## Getting Started

### Install dependencies
```powershell
npm install
```

### Run in dev mode
```powershell
npm start
```

## Build & Package

### Create distributables (installer + nupkg)
```powershell
npm run make
```

Artifacts will appear in:
```
out\make\
```

### Portable ZIP
If you want a portable ZIP, package then zip the `out\fluxtool-win32-x64` folder.

## Publishing (Auto-Updates)
Fluxtool uses GitHub Releases for updates. Make sure your repo settings are configured and then publish:
```powershell
$env:GITHUB_TOKEN="YOUR_TOKEN"
npm run publish
```

## Project Structure
```
assets/          App icons
src/             Main + renderer code
out/             Build output (gitignored)
```

## Notes
- Some system actions require admin rights depending on Windows policy.
- Auto-updates require a valid GitHub release feed.

---

Built by joaoswu.

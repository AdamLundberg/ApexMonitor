# Apex Pro OLED System Monitor

Displays real-time CPU, GPU and RAM stats on your SteelSeries Apex Pro OLED screen. Cycles through three screens every 2 seconds, each with its matching SteelSeries icon:

```
[CPU icon]  45%          [GPU icon]  60%          [RAM icon]  52%
            72°C                     81°C                     6.2/32 GB
```

Runs silently in the background — right-click the system tray icon to quit.

---

## Requirements

- SteelSeries GG must be running
- Node.js v18+ (only needed to build the exe)

---

## Installation (pre-built exe)

Download the latest release zip from the [Releases](../../releases) page, extract it anywhere, then run `setup-autostart.bat` once. Done — the monitor starts automatically and silently on every login.

---

## Building from source

```bash
npm install
build.bat
```

The `dist\` folder will contain everything needed to run or share.

---

## Running in dev mode

```bash
npm start
```

---

## CPU temperature (AMD Ryzen)

`systeminformation` cannot read AMD Zen sensor data via WMI. To get CPU temps working:

1. Download [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/releases)
2. Open it → Options → Remote Web Server → Run (port 8085)
3. Restart the monitor

The app detects LHM automatically if it's running.

---

## Config

Edit `config.json` to change the screen update speed (restart required):

```json
{ "updateIntervalMs": 2000 }
```

- `1000` = 1 second per screen
- `2000` = 2 seconds (default)
- `5000` = 5 seconds

---

## How it works

SteelSeries GG exposes a local REST API (the [GameSense SDK](https://github.com/SteelSeries/gamesense-sdk)) that any app can POST JSON to. This app:

1. Reads `%PROGRAMDATA%\SteelSeries\SteelSeries Engine 3\coreProps.json` to find the local port GG is listening on
2. Registers itself as a game called `SYSMONITOR` with three events: `CPU_STATS`, `GPU_STATS`, `RAM_STATS`
3. Binds OLED screen handlers with SteelSeries CPU/GPU/RAM icons for each event
4. Polls hardware stats every 2 seconds and cycles which event is sent, rotating the display
5. Sends a heartbeat every 10 seconds so GG knows the app is still alive

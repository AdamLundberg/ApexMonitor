# Apex Pro OLED System Monitor

Displays real-time CPU, GPU, and RAM stats on your SteelSeries Apex Pro OLED screen.

```
CPU 45% 72°C
GPU 60% 81°C
RAM 52%
```

## Requirements

- **SteelSeries GG** must be running (the app talks to it via local HTTP)
- **Node.js** v18 or newer

## Setup

```bash
npm install
```

> **Note on GPU temperature:** On Windows, GPU utilization % and temperature are
> read via `systeminformation`. This works well for NVIDIA cards. For AMD GPUs,
> utilization may show as N/A depending on your drivers — temperature should
> still work.

> **Note on CPU temperature:** Some systems require admin/elevated privileges
> to read CPU sensor data. If CPU temp shows N/A, try running as Administrator.

## Run

```bash
npm start
```

Press `Ctrl+C` to stop. The app will unregister itself from SteelSeries Engine cleanly.

## Auto-start with Windows (optional)

1. Press `Win+R`, type `shell:startup`, hit Enter
2. Create a new file called `apex-monitor.bat` in that folder with:

```bat
@echo off
cd /d "C:\path\to\apex-monitor"
node index.js
```

Replace the path with wherever you saved this folder.

## How it works

SteelSeries exposes a local REST API (the GameSense SDK) that any app can POST
JSON to. This app:

1. Reads `%PROGRAMDATA%\SteelSeries\SteelSeries Engine 3\coreProps.json` to
   find the local port Engine is listening on
2. Registers itself as a "game" called `SYSMONITOR`
3. Binds a 3-line screen handler to the Apex Pro OLED
4. Every 2 seconds, collects CPU/GPU/RAM stats and POSTs them as an event
5. Sends a heartbeat every 10 seconds so Engine knows the app is alive

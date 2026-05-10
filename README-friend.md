# Apex Pro OLED System Monitor

Shows CPU, GPU and RAM stats on your SteelSeries Apex Pro OLED screen.

## Requirements

- SteelSeries GG must be running (the app that controls your keyboard)
- That's it!

## How to run

Double-click **apex-monitor.exe**

A black console window will appear — that's normal, leave it open.
Close it (or press Ctrl+C) to stop the monitor.

## What you'll see on the keyboard

The OLED cycles through three screens every 2 seconds:

```
[CPU icon]  45%        [GPU icon]  60%        [RAM icon]  52%
            72°C                   81°C                   6.2/32 GB
```

## Changing the update speed

Open **config.json** in Notepad and change the number:

```json
{ "updateIntervalMs": 2000 }
```

- `1000` = 1 second per screen
- `2000` = 2 seconds (default)
- `5000` = 5 seconds

Save the file and restart the exe for the change to take effect.

## CPU temperature not showing?

For AMD Ryzen CPUs (like the 9800X3D), Windows doesn't expose CPU temps
directly. To get CPU temp working:

1. Download LibreHardwareMonitor: https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/releases
2. Run it
3. Go to Options → Remote Web Server → Run
4. Restart apex-monitor.exe

## Auto-start with Windows

1. Press Win+R, type `shell:startup`, press Enter
2. Copy a shortcut to `apex-monitor.exe` into that folder

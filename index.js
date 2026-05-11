/**
 * Apex Pro OLED System Monitor
 * Runs silently in the system tray (right-click to Quit).
 * Cycles CPU → GPU → RAM on the OLED with matching SteelSeries icons.
 *
 * CPU temp on AMD (9800X3D): needs LibreHardwareMonitor web server.
 *   Open LHM → Options → Remote Web Server → Run  (port 8085)
 */

const fs   = require("fs");
const path = require("path");
const http = require("http");

// ─── Config ───────────────────────────────────────────────────────────────────
const GAME_NAME             = "SYSMONITOR";
const HEARTBEAT_INTERVAL_MS = 10000;
const LHM_URL               = "http://localhost:8085/data.json";

const EVENTS = {
  CPU: { name: "CPU_STATS", icon: 27 },
  GPU: { name: "GPU_STATS", icon: 28 },
  RAM: { name: "RAM_STATS", icon: 29 },
};

// ─── User config (config.json) ────────────────────────────────────────────────
const CONFIG_PATH    = path.join(__dirname, "config.json");
const DEFAULT_CONFIG = {
  // How long each screen (CPU / GPU / RAM) is shown in milliseconds
  updateIntervalMs: 2000,
  // Which screen device types to show stats on.
  // Remove entries you don't want. Available options:
  //   "screened"         - generic (catches Arctis Pro Wireless dock, Rival 700, GameDAC)
  //   "screened-128x40"  - Apex Pro Gen 1 & Gen 2, Apex 7
  //   "screened-128x48"  - some older Apex variants
  //   "screened-128x52"  - Apex Pro Gen 3+
  devices: ["screened", "screened-128x40", "screened-128x48", "screened-128x52"],
};

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return { ...DEFAULT_CONFIG };
  }
  try {
    const user   = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    const merged = { ...DEFAULT_CONFIG, ...user };
    merged.updateIntervalMs = Math.min(30000, Math.max(500, merged.updateIntervalMs));
    return merged;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function post(address, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const [host, port] = address.split(":");
    const req = http.request(
      { hostname: host, port: parseInt(port), path: `/${endpoint}`, method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } },
      (res) => { let r = ""; res.on("data", c => r += c); res.on("end", () => resolve({ status: res.statusCode, body: r })); }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let r = ""; res.on("data", c => r += c); res.on("end", () => resolve(r));
    }).on("error", reject);
  });
}

// ─── SteelSeries Engine ───────────────────────────────────────────────────────
function getEngineAddress() {
  const p = process.platform === "win32"
    ? path.join(process.env.PROGRAMDATA || "C:\\ProgramData", "SteelSeries", "SteelSeries Engine 3", "coreProps.json")
    : "/Library/Application Support/SteelSeries Engine 3/coreProps.json";
  if (!fs.existsSync(p)) throw new Error(`SteelSeries Engine not found. Is SteelSeries GG running?`);
  return JSON.parse(fs.readFileSync(p, "utf8")).address;
}

async function registerApp(address) {
  await post(address, "game_metadata", { game: GAME_NAME, game_display_name: "System Monitor", developer: "Custom" });
}

function makeHandlers(iconId, devices) {
  return devices.map(dt => ({
    "device-type": dt, zone: "one", mode: "screen",
    datas: [{ "icon-id": iconId, lines: [
      { "has-text": true, "context-frame-key": "value" },
      { "has-text": true, "context-frame-key": "label" },
    ]}],
  }));
}

// On first run: bind handlers with defaults so they show up in GG UI.
// On subsequent runs: only register (no handlers) so user customizations in GG are preserved.
const FIRST_RUN_FLAG = path.join(__dirname, ".initialized");

async function bindAllHandlers(address, devices) {
  const isFirstRun = !fs.existsSync(FIRST_RUN_FLAG);

  if (isFirstRun) {
    // First run: bind with default handlers so GG knows which devices to use
    for (const [, ev] of Object.entries(EVENTS)) {
      await post(address, "bind_game_event", {
        game: GAME_NAME, event: ev.name,
        min_value: 0, max_value: 100, icon_id: ev.icon, value_optional: true,
        handlers: makeHandlers(ev.icon, devices),
      });
    }
    // Mark as initialized so future runs don't overwrite user's GG settings
    fs.writeFileSync(FIRST_RUN_FLAG, new Date().toISOString());
    console.log("✓ First run: default handlers bound. You can now customize devices in SteelSeries GG.");
  } else {
    // Subsequent runs: just register the events, preserving user's GG customizations
    for (const [, ev] of Object.entries(EVENTS)) {
      await post(address, "register_game_event", {
        game: GAME_NAME, event: ev.name,
        min_value: 0, max_value: 100, icon_id: ev.icon, value_optional: true,
      });
    }
  }
}

async function removeGame(address) {
  try { await post(address, "remove_game", { game: GAME_NAME }); } catch { /* ignore */ }
}

// ─── LibreHardwareMonitor ─────────────────────────────────────────────────────
function walkLhm(node, acc) {
  if (!acc) acc = { cpuTemps: [], gpuTemps: [] };
  if (node.Type === "Temperature") {
    const name = (node.Text || "").toLowerCase();
    const val  = parseFloat((node.Value || "").replace(",", "."));
    if (!isNaN(val) && val > 0 && val < 120) {
      if (name.includes("tdie") || name.includes("tctl") || name.includes("cpu die") ||
          name.includes("ccd") || name.includes("cpu temperature") || name.includes("package"))
        acc.cpuTemps.push({ name, val });
      if (name.includes("gpu core") || name.includes("gpu temperature") ||
          (name.includes("gpu") && name.includes("temp")))
        acc.gpuTemps.push({ name, val });
    }
  }
  if (Array.isArray(node.Children)) node.Children.forEach(c => walkLhm(c, acc));
  return acc;
}

async function getLhmTemps() {
  try {
    const { cpuTemps, gpuTemps } = walkLhm(JSON.parse(await httpGet(LHM_URL)));
    const cpuTemp =
      cpuTemps.find(s => s.name.includes("tdie") || s.name.includes("ccd"))?.val ??
      cpuTemps.find(s => s.name.includes("cpu die"))?.val ??
      cpuTemps[0]?.val ?? null;
    return {
      cpuTemp: cpuTemp != null ? Math.round(cpuTemp) : null,
      gpuTemp: gpuTemps[0]?.val != null ? Math.round(gpuTemps[0].val) : null,
    };
  } catch { return { cpuTemp: null, gpuTemp: null }; }
}

// ─── System stats ─────────────────────────────────────────────────────────────
let si;
function loadSI() {
  try { si = require("systeminformation"); }
  catch { process.exit(1); }
}

async function getStats() {
  const [lhm, cpuLoad, cpuTempSI, mem, gfx] = await Promise.all([
    getLhmTemps(), si.currentLoad(), si.cpuTemperature(), si.mem(), si.graphics(),
  ]);

  const cpuPct = Math.round(cpuLoad.currentLoad);
  const cpuTempVal = lhm.cpuTemp ?? (() => {
    const t = cpuTempSI;
    for (const v of [t.main, t.max, t.tdie, t.tctl,
      t.cores?.length ? t.cores.reduce((a,b)=>a+b,0)/t.cores.length : null, t.chipset])
      if (v != null && v > 0 && v < 120) return Math.round(v);
    return null;
  })();

  const ramPct     = Math.round((mem.active / mem.total) * 100);
  const ramGB      = (mem.active / 1073741824).toFixed(1);
  const ramTotalGB = (mem.total / 1073741824).toFixed(0);

  const gpu        = gfx.controllers?.[0];
  const gpuTempVal = lhm.gpuTemp ?? (gpu?.temperatureGpu > 0 ? Math.round(gpu.temperatureGpu) : null);
  const gpuUtilVal = gpu?.utilizationGpu != null ? Math.round(gpu.utilizationGpu) : null;

  return { cpuPct, cpuTempVal, ramPct, ramGB, ramTotalGB, gpuTempVal, gpuUtilVal };
}

// ─── Send to OLED ─────────────────────────────────────────────────────────────
const CYCLE_KEYS = ["CPU", "GPU", "RAM"];
let cycle = 0;

async function sendStats(address) {
  const { cpuPct, cpuTempVal, ramPct, ramGB, ramTotalGB, gpuTempVal, gpuUtilVal } = await getStats();

  const screens = {
    CPU: { value: `${cpuPct}%`,                               label: cpuTempVal != null ? `${cpuTempVal}\xB0C` : "No temp" },
    GPU: { value: gpuUtilVal != null ? `${gpuUtilVal}%` : "--", label: gpuTempVal != null ? `${gpuTempVal}\xB0C` : "No temp" },
    RAM: { value: `${ramPct}%`,                               label: `${ramGB}/${ramTotalGB} GB` },
  };

  const activeKey = CYCLE_KEYS[cycle % CYCLE_KEYS.length];
  cycle++;

  await post(address, "game_event", {
    game: GAME_NAME, event: EVENTS[activeKey].name,
    data: { value: 1, frame: screens[activeKey] },
  });
}

async function sendHeartbeat(address) {
  await post(address, "game_heartbeat", { game: GAME_NAME });
}

// ─── System tray ─────────────────────────────────────────────────────────────
function startTray(onQuit) {
  let SysTray;
  try { SysTray = require("systray2").default; } catch { return; }

  // Icon path: look next to the exe (pkg sets __dirname to exe location)
  const iconPath = path.join(__dirname, "icon.ico");
  if (!fs.existsSync(iconPath)) {
    // Silently skip tray if icon missing — app still runs fine
    return;
  }

  const itemQuit = {
    title: "Quit",
    tooltip: "Stop the monitor",
    checked: false,
    enabled: true,
    click: () => { tray.kill(false); onQuit(); },
  };

  // When running as a pkg exe:  process.execPath = the .exe itself  → use its folder
  // When running via node.js:    process.execPath = node.exe         → use __dirname (project folder)
  const isPkg = typeof process.pkg !== "undefined";
  const trayDir = isPkg ? path.dirname(process.execPath) : __dirname;

  const tray = new SysTray({
    menu: {
      icon: iconPath,
      title: "",
      tooltip: "Apex OLED Monitor",
      items: [
        { title: "Apex OLED Monitor", tooltip: "Running in background", checked: false, enabled: false },
        SysTray.separator,
        itemQuit,
      ],
    },
    debug: false,
    copyDir: trayDir,
  });

  tray.onClick(action => {
    if (action.item.click != null) action.item.click();
  });

  tray.ready().catch(() => {});
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const config = loadConfig();
  loadSI();

  let address;
  try {
    address = getEngineAddress();
  } catch (err) {
    // SteelSeries GG not running — retry in 10s silently
    setTimeout(main, 10000);
    return;
  }

  try {
    await registerApp(address);
    await bindAllHandlers(address, config.devices);
  } catch {
    setTimeout(main, 10000);
    return;
  }

  await sendStats(address);
  const statsTimer     = setInterval(() => sendStats(address).catch(() => {}), config.updateIntervalMs);
  const heartbeatTimer = setInterval(() => sendHeartbeat(address).catch(() => {}), HEARTBEAT_INTERVAL_MS);

  async function shutdown() {
    clearInterval(statsTimer);
    clearInterval(heartbeatTimer);
    await removeGame(address);
    process.exit(0);
  }

  // Start tray — if systray2 isn't available just run headless
  startTray(shutdown);

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(() => process.exit(1));

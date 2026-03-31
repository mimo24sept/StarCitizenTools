const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const devServerUrl = process.env.ELECTRON_RENDERER_URL;
const isDev = Boolean(devServerUrl);
const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const TRADE_SNAPSHOT_PATH = path.join(DATA_DIR, "trade_snapshot.json");
const UEX_API_BASE = "https://api.uexcorp.uk/2.0";
let mainWindow = null;
let overlayWindow = null;
const overlayState = {
  visible: false,
  progressIndex: 0,
  route: null
};

async function fetchJson(endpoint) {
  const response = await fetch(`${UEX_API_BASE}/${endpoint}`);
  if (!response.ok) {
    throw new Error(`UEX ${endpoint} failed with HTTP ${response.status}`);
  }
  return await response.json();
}

function simplifyVehicle(item) {
  return {
    id: item.id,
    name: item.name,
    fullName: item.name_full,
    manufacturer: item.company_name,
    scu: Number(item.scu ?? 0),
    crew: item.crew,
    length: Number(item.length ?? 0),
    width: Number(item.width ?? 0),
    height: Number(item.height ?? 0),
    padType: item.pad_type ?? "",
    containerSizes: item.container_sizes ?? "",
    isCargo: Number(item.is_cargo ?? 0) === 1,
    isSpaceship: Number(item.is_spaceship ?? 0) === 1,
    isGroundVehicle: Number(item.is_ground_vehicle ?? 0) === 1,
    isIndustrial: Number(item.is_industrial ?? 0) === 1,
    isStarter: Number(item.is_starter ?? 0) === 1,
    isQuantumCapable: Number(item.is_quantum_capable ?? 0) === 1,
    photoUrl: item.url_photo ?? ""
  };
}

function simplifyTerminal(item) {
  return {
    id: item.id,
    name: item.name,
    nickname: item.nickname,
    displayName: item.displayname,
    code: item.code,
    type: item.type,
    starSystem: item.star_system_name,
    planet: item.planet_name,
    orbit: item.orbit_name,
    moon: item.moon_name,
    station: item.space_station_name,
    outpost: item.outpost_name,
    city: item.city_name,
    faction: item.faction_name,
    company: item.company_name,
    maxContainerSize: Number(item.max_container_size ?? 0),
    isVisible: Number(item.is_visible ?? 0) === 1,
    isAvailableLive: Number(item.is_available_live ?? 0) === 1,
    isAutoLoad: Number(item.is_auto_load ?? 0) === 1,
    hasDockingPort: Number(item.has_docking_port ?? 0) === 1,
    hasLoadingDock: Number(item.has_loading_dock ?? 0) === 1,
    hasFreightElevator: Number(item.has_freight_elevator ?? 0) === 1,
    screenshot: item.screenshot ?? null
  };
}

function simplifyCommodity(item) {
  return {
    id: item.id,
    name: item.name,
    code: item.code,
    kind: item.kind,
    weightScu: Number(item.weight_scu ?? 0),
    priceBuy: Number(item.price_buy ?? 0),
    priceSell: Number(item.price_sell ?? 0),
    isAvailableLive: Number(item.is_available_live ?? 0) === 1,
    isVisible: Number(item.is_visible ?? 0) === 1,
    isBuyable: Number(item.is_buyable ?? 0) === 1,
    isSellable: Number(item.is_sellable ?? 0) === 1,
    isIllegal: Number(item.is_illegal ?? 0) === 1,
    isRaw: Number(item.is_raw ?? 0) === 1,
    isMineral: Number(item.is_mineral ?? 0) === 1,
    isFuel: Number(item.is_fuel ?? 0) === 1,
    isTemporary: Number(item.is_temporary ?? 0) === 1,
    wiki: item.wiki ?? ""
  };
}

function simplifyPrice(item) {
  return {
    id: item.id,
    commodityId: item.id_commodity,
    terminalId: item.id_terminal,
    commodityName: item.commodity_name,
    terminalName: item.terminal_name,
    priceBuy: Number(item.price_buy ?? 0),
    priceBuyAvg: Number(item.price_buy_avg ?? 0),
    priceSell: Number(item.price_sell ?? 0),
    priceSellAvg: Number(item.price_sell_avg ?? 0),
    scuBuy: Number(item.scu_buy ?? 0),
    scuBuyAvg: Number(item.scu_buy_avg ?? 0),
    scuSellStock: Number(item.scu_sell_stock ?? 0),
    scuSellStockAvg: Number(item.scu_sell_stock_avg ?? 0),
    scuSell: Number(item.scu_sell ?? 0),
    scuSellAvg: Number(item.scu_sell_avg ?? 0),
    statusBuy: Number(item.status_buy ?? 0),
    statusSell: Number(item.status_sell ?? 0),
    containerSizes: item.container_sizes ?? "",
    modifiedAt: Number(item.date_modified ?? 0)
  };
}

function getOverlayPayload() {
  return {
    visible: overlayState.visible,
    progressIndex: overlayState.progressIndex,
    route: overlayState.route
  };
}

function broadcastOverlayState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("overlay:state", getOverlayPayload());
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send("overlay:render", getOverlayPayload());
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1280,
    minHeight: 820,
    backgroundColor: "#07121c",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(ROOT_DIR, "web-dist", "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  overlayWindow = new BrowserWindow({
    width: 360,
    height: 260,
    minWidth: 240,
    minHeight: 180,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: true,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  overlayWindow.loadFile(path.join(__dirname, "overlay.html"));

  overlayWindow.on("closed", () => {
    overlayWindow = null;
    overlayState.visible = false;
    broadcastOverlayState();
  });

  overlayWindow.on("hide", () => {
    overlayState.visible = false;
    broadcastOverlayState();
  });

  overlayWindow.on("show", () => {
    overlayState.visible = true;
    broadcastOverlayState();
  });

  return overlayWindow;
}

ipcMain.handle("app:get-meta", async () => {
  return {
    isDev,
    rootDir: ROOT_DIR,
    dataDir: DATA_DIR
  };
});

ipcMain.handle("fs:read-bytes", async (_event, relativePath) => {
  const fullPath = path.join(ROOT_DIR, relativePath);
  const buffer = await fs.promises.readFile(fullPath);
  return buffer;
});

ipcMain.handle("fs:write-bytes", async (_event, relativePath, arrayBuffer) => {
  const fullPath = path.join(ROOT_DIR, relativePath);
  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.promises.writeFile(fullPath, Buffer.from(arrayBuffer));
  return true;
});

ipcMain.handle("sync:run", async () => {
  return await new Promise((resolve) => {
    const child = spawn("py", ["sync_all.py"], {
      cwd: ROOT_DIR,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        code,
        stdout,
        stderr
      });
    });
    child.on("error", (error) => {
      resolve({
        ok: false,
        code: -1,
        stdout,
        stderr: `${stderr}\n${String(error)}`
      });
    });
  });
});

ipcMain.handle("trade:sync", async () => {
  try {
    const [vehiclesPayload, terminalsPayload, commoditiesPayload, pricesPayload] = await Promise.all([
      fetchJson("vehicles"),
      fetchJson("terminals"),
      fetchJson("commodities"),
      fetchJson("commodities_prices_all")
    ]);

    const snapshot = {
      source: "UEX API 2.0",
      apiBase: UEX_API_BASE,
      fetchedAt: new Date().toISOString(),
      vehicles: (vehiclesPayload.data ?? []).map(simplifyVehicle),
      terminals: (terminalsPayload.data ?? []).map(simplifyTerminal),
      commodities: (commoditiesPayload.data ?? []).map(simplifyCommodity),
      prices: (pricesPayload.data ?? []).map(simplifyPrice)
    };

    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    await fs.promises.writeFile(TRADE_SNAPSHOT_PATH, JSON.stringify(snapshot), "utf8");

    return {
      ok: true,
      fetchedAt: snapshot.fetchedAt,
      counts: {
        vehicles: snapshot.vehicles.length,
        terminals: snapshot.terminals.length,
        commodities: snapshot.commodities.length,
        prices: snapshot.prices.length
      }
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error)
    };
  }
});

ipcMain.handle("trade:get-snapshot", async () => {
  try {
    const content = await fs.promises.readFile(TRADE_SNAPSHOT_PATH, "utf8");
    return {
      ok: true,
      snapshot: JSON.parse(content)
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error)
    };
  }
});

ipcMain.handle("overlay:get-state", async () => {
  return getOverlayPayload();
});

ipcMain.handle("overlay:show", async (_event, route) => {
  if (route) {
    overlayState.route = route;
    overlayState.progressIndex = 0;
  }
  const window = createOverlayWindow();
  overlayState.visible = true;
  if (!window.isVisible()) {
    window.show();
  }
  window.focus();
  broadcastOverlayState();
  return getOverlayPayload();
});

ipcMain.handle("overlay:hide", async () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide();
  }
  overlayState.visible = false;
  broadcastOverlayState();
  return getOverlayPayload();
});

ipcMain.handle("overlay:set-progress", async (_event, progressIndex) => {
  const maxIndex = Math.max((overlayState.route?.steps?.length ?? 1) - 1, 0);
  overlayState.progressIndex = Math.max(0, Math.min(Number(progressIndex) || 0, maxIndex));
  broadcastOverlayState();
  return getOverlayPayload();
});

ipcMain.handle("overlay:reset-progress", async () => {
  overlayState.progressIndex = 0;
  broadcastOverlayState();
  return getOverlayPayload();
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

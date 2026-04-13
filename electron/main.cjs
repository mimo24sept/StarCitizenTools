const { app, BrowserWindow, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("fs");
const path = require("path");
const { runSync } = require("./sync.cjs");
const { syncTradeSnapshot, syncLoadoutSnapshot, syncMiningSnapshot, syncItemFinderSnapshot, resolveTerminalDistances } = require("./services/uex.cjs");
const { syncWikeloSnapshot } = require("./services/wikelo.cjs");

const devServerUrl = process.env.ELECTRON_RENDERER_URL;
const isDev = Boolean(devServerUrl);

const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");

const SNAPSHOT_PATHS = {
  trade: path.join(DATA_DIR, "trade_snapshot.json"),
  mining: path.join(DATA_DIR, "mining_snapshot.json"),
  itemFinder: path.join(DATA_DIR, "item_finder_snapshot.json"),
  loadout: path.join(DATA_DIR, "loadout_snapshot.json"),
  wikelo: path.join(DATA_DIR, "wikelo_snapshot.json"),
  tradeDistanceCache: path.join(DATA_DIR, "trade_distance_cache.json")
};

let mainWindow = null;
let overlayWindow = null;

const overlayState = {
  visible: false,
  progressIndex: 0,
  route: null
};

let updateState = {
  checking: false,
  available: false,
  downloaded: false,
  version: "",
  error: ""
};

function broadcastUpdateState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update:state", updateState);
  }
}

function initAutoUpdater() {
  const owner = process.env.UPDATE_OWNER || process.env.GITHUB_OWNER || "";
  const repo = process.env.UPDATE_REPO || process.env.GITHUB_REPO || "";

  if (!owner || !repo) {
    console.log("[Update] Missing UPDATE_OWNER/UPDATE_REPO env vars, skipping auto-update.");
    return;
  }

  autoUpdater.setFeedURL({
    provider: "github",
    owner,
    repo
  });

  autoUpdater.autoDownload = true;

  autoUpdater.on("checking-for-update", () => {
    updateState = { ...updateState, checking: true, error: "" };
    broadcastUpdateState();
  });

  autoUpdater.on("update-available", (info) => {
    updateState = {
      ...updateState,
      checking: false,
      available: true,
      version: info?.version || updateState.version
    };
    broadcastUpdateState();
  });

  autoUpdater.on("update-not-available", (info) => {
    updateState = {
      ...updateState,
      checking: false,
      available: false,
      downloaded: false,
      version: info?.version || updateState.version
    };
    broadcastUpdateState();
  });

  autoUpdater.on("update-downloaded", (info) => {
    updateState = {
      ...updateState,
      checking: false,
      available: true,
      downloaded: true,
      version: info?.version || updateState.version
    };
    broadcastUpdateState();
  });

  autoUpdater.on("error", (error) => {
    updateState = {
      ...updateState,
      checking: false,
      error: String(error)
    };
    broadcastUpdateState();
  });

  autoUpdater.checkForUpdatesAndNotify();
}

function getOverlayPayload() {
  return {
    visible: overlayState.visible,
    progressIndex: overlayState.progressIndex,
    route: overlayState.route
  };
}

function broadcastOverlayState() {
  const payload = getOverlayPayload();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("overlay:state", payload);
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send("overlay:render", payload);
  }
}

async function ensureDataDir() {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
}

async function readSnapshot(snapshotPath) {
  const content = await fs.promises.readFile(snapshotPath, "utf8");
  return JSON.parse(content);
}

async function withSnapshotResponse(snapshotPath) {
  try {
    return {
      ok: true,
      snapshot: await readSnapshot(snapshotPath)
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error)
    };
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

ipcMain.handle("app:get-meta", async () => ({
  isDev,
  rootDir: ROOT_DIR,
  dataDir: DATA_DIR
}));

ipcMain.handle("fs:read-bytes", async (_event, relativePath) => {
  const fullPath = path.join(ROOT_DIR, relativePath);
  return await fs.promises.readFile(fullPath);
});

ipcMain.handle("fs:write-bytes", async (_event, relativePath, arrayBuffer) => {
  const fullPath = path.join(ROOT_DIR, relativePath);
  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.promises.writeFile(fullPath, Buffer.from(arrayBuffer));
  return true;
});

ipcMain.handle("sync:run", async () => {
  try {
    const result = await runSync(DATA_DIR, (message) => {
      console.log("[Sync]", message);
    });

    if (!result.ok) {
      return { ok: false, code: -1, stdout: "", stderr: result.error || "Unknown error" };
    }

    return {
      ok: true,
      code: 0,
      stdout: `Synchronisation terminee pour ${result.version}: ${result.imported} blueprints locaux, dernier ID scanne ${result.lastId}.`,
      stderr: ""
    };
  } catch (error) {
    return { ok: false, code: -1, stdout: "", stderr: String(error) };
  }
});

ipcMain.handle("trade:sync", async () => {
  try {
    await ensureDataDir();
    return await syncTradeSnapshot(SNAPSHOT_PATHS.trade);
  } catch (error) {
    return {
      ok: false,
      error: String(error)
    };
  }
});

ipcMain.handle("trade:get-snapshot", async () => await withSnapshotResponse(SNAPSHOT_PATHS.trade));

ipcMain.handle("mining:sync", async () => {
  try {
    await ensureDataDir();
    return await syncMiningSnapshot(SNAPSHOT_PATHS.mining);
  } catch (error) {
    return {
      ok: false,
      error: String(error)
    };
  }
});

ipcMain.handle("mining:get-snapshot", async () => await withSnapshotResponse(SNAPSHOT_PATHS.mining));

ipcMain.handle("itemfinder:sync", async () => {
  try {
    await ensureDataDir();
    return await syncItemFinderSnapshot(SNAPSHOT_PATHS.itemFinder);
  } catch (error) {
    return {
      ok: false,
      error: String(error)
    };
  }
});

ipcMain.handle("itemfinder:get-snapshot", async () => await withSnapshotResponse(SNAPSHOT_PATHS.itemFinder));

ipcMain.handle("trade:resolve-distances", async (_event, pairs = []) => {
  try {
    await ensureDataDir();
    return await resolveTerminalDistances(SNAPSHOT_PATHS.tradeDistanceCache, pairs);
  } catch (error) {
    return {
      ok: false,
      error: String(error)
    };
  }
});

ipcMain.handle("wikelo:sync", async () => {
  try {
    await ensureDataDir();
    return await syncWikeloSnapshot(SNAPSHOT_PATHS.wikelo);
  } catch (error) {
    return {
      ok: false,
      error: String(error)
    };
  }
});

ipcMain.handle("wikelo:get-snapshot", async () => await withSnapshotResponse(SNAPSHOT_PATHS.wikelo));

ipcMain.handle("loadout:sync", async () => {
  try {
    await ensureDataDir();
    return await syncLoadoutSnapshot(SNAPSHOT_PATHS.loadout);
  } catch (error) {
    return {
      ok: false,
      error: String(error)
    };
  }
});

ipcMain.handle("loadout:get-snapshot", async () => await withSnapshotResponse(SNAPSHOT_PATHS.loadout));

ipcMain.handle("overlay:get-state", async () => getOverlayPayload());

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

ipcMain.handle("update:get-state", async () => updateState);

ipcMain.handle("update:apply", async () => {
  if (updateState.downloaded) {
    autoUpdater.quitAndInstall();
    return { ok: true };
  }
  return { ok: false, error: "Update not downloaded yet." };
});

app.whenReady().then(() => {
  createWindow();
  initAutoUpdater();
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

const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { runSync } = require("./sync.cjs");

const devServerUrl = process.env.ELECTRON_RENDERER_URL;
const isDev = Boolean(devServerUrl);
const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const TRADE_SNAPSHOT_PATH = path.join(DATA_DIR, "trade_snapshot.json");
const LOADOUT_SNAPSHOT_PATH = path.join(DATA_DIR, "loadout_snapshot.json");
const WIKELO_SNAPSHOT_PATH = path.join(DATA_DIR, "wikelo_snapshot.json");
const TRADE_DISTANCE_CACHE_PATH = path.join(DATA_DIR, "trade_distance_cache.json");
const UEX_API_BASE = "https://api.uexcorp.uk/2.0";
const WIKELO_DATA_URL = "https://raw.githubusercontent.com/SeekND/Wikelo/main/data/wikelo_data.json";
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

async function readJsonFile(filePath, fallback) {
  try {
    const content = await fs.promises.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

function getDistanceCacheKey(originTerminalId, destinationTerminalId) {
  const left = Number(originTerminalId);
  const right = Number(destinationTerminalId);
  if (!left || !right) return "";
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

async function fetchTerminalDistance(originTerminalId, destinationTerminalId) {
  const payload = await fetchJson(`terminals_distances?id_terminal_origin=${originTerminalId}&id_terminal_destination=${destinationTerminalId}`);
  const distance = Number(payload?.data?.distance);
  return Number.isFinite(distance) && distance > 0 ? distance : null;
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

function simplifyLoadoutCategory(item) {
  return {
    id: item.id,
    type: item.type,
    section: item.section,
    name: item.name
  };
}

function simplifyLoadoutAttribute(item) {
  return {
    itemId: item.id_item,
    itemUuid: item.item_uuid ?? "",
    categoryId: item.id_category,
    attributeName: item.attribute_name,
    value: item.value,
    unit: item.unit ?? ""
  };
}

function simplifyLoadoutComponent(item, category, attributes = []) {
  const attributeMap = Object.fromEntries(
    attributes.map((attribute) => [
      attribute.attributeName,
      {
        value: attribute.value,
        unit: attribute.unit ?? ""
      }
    ])
  );

  const size = String(item.size || attributeMap["Size"]?.value || "").trim();
  return {
    id: item.id,
    uuid: item.uuid ?? "",
    vehicleId: Number(item.id_vehicle ?? 0),
    vehicleName: item.vehicle_name ?? "",
    categoryId: category.id,
    categoryName: category.name,
    section: category.section,
    manufacturer: item.company_name ?? "",
    name: item.name,
    slug: item.slug,
    size,
    typeLabel: String(attributeMap["Item Type"]?.value || category.name),
    classLabel: String(attributeMap["Class"]?.value || ""),
    grade: String(attributeMap["Grade"]?.value || ""),
    screenshot: item.screenshot || "",
    storeUrl: item.url_store || "",
    attributes,
    attributeMap
  };
}

function simplifyLoadoutPrice(item) {
  return {
    id: item.id,
    itemId: item.id_item,
    categoryId: item.id_category,
    terminalId: item.id_terminal,
    priceBuy: Number(item.price_buy ?? 0),
    priceSell: Number(item.price_sell ?? 0),
    modifiedAt: Number(item.date_modified ?? 0),
    itemName: item.item_name,
    itemUuid: item.item_uuid ?? "",
    terminalName: item.terminal_name
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
  try {
    const result = await runSync(DATA_DIR, (msg) => {
      console.log("[Sync]", msg);
    });
    if (result.ok) {
      return { 
        ok: true, 
        code: 0, 
        stdout: `Synchronisation terminee pour ${result.version}: ${result.imported} blueprints locaux, dernier ID scanne ${result.lastId}.`, 
        stderr: "" 
      };
    }
    return { ok: false, code: -1, stdout: "", stderr: result.error || "Unknown error" };
  } catch (error) {
    return { ok: false, code: -1, stdout: "", stderr: String(error) };
  }
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

ipcMain.handle("wikelo:sync", async () => {
  try {
    const response = await fetch(WIKELO_DATA_URL);
    if (!response.ok) {
      throw new Error(`Wikelo sync failed with HTTP ${response.status}`);
    }

    const data = await response.json();
    const snapshot = {
      source: "SeekND/Wikelo",
      repo: "https://github.com/SeekND/Wikelo",
      fetchedAt: new Date().toISOString(),
      data
    };

    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    await fs.promises.writeFile(WIKELO_SNAPSHOT_PATH, JSON.stringify(snapshot), "utf8");

    return {
      ok: true,
      fetchedAt: snapshot.fetchedAt,
      counts: {
        items: Array.isArray(data.items) ? data.items.length : 0,
        ships: Array.isArray(data.ships) ? data.ships.length : 0,
        currency: Array.isArray(data.currency_exchanges) ? data.currency_exchanges.length : 0
      }
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error)
    };
  }
});

ipcMain.handle("wikelo:get-snapshot", async () => {
  try {
    const content = await fs.promises.readFile(WIKELO_SNAPSHOT_PATH, "utf8");
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

ipcMain.handle("loadout:sync", async () => {
  try {
    const [categoriesPayload, vehiclesPayload, terminalsPayload, pricesPayload] = await Promise.all([
      fetchJson("categories"),
      fetchJson("vehicles"),
      fetchJson("terminals"),
      fetchJson("items_prices_all")
    ]);

    const relevantCategoryNames = new Set([
      "Coolers",
      "Power Plants",
      "Quantum Drives",
      "Shield Generators",
      "Guns",
      "Missile Racks",
      "Missiles",
      "Turrets",
      "Bombs",
      "Bomb Racks",
      "Point Defense Cannon"
    ]);

    const categories = (categoriesPayload.data ?? [])
      .filter((item) => item.type === "item" && relevantCategoryNames.has(item.name))
      .map(simplifyLoadoutCategory);

    const categoryResults = await Promise.all(
      categories.map(async (category) => {
        const [itemsPayload, attributesPayload] = await Promise.all([
          fetchJson(`items?id_category=${category.id}`),
          fetchJson(`items_attributes?id_category=${category.id}`)
        ]);

        const rawAttributes = (attributesPayload.data ?? []).map(simplifyLoadoutAttribute);
        const attributesByItemId = new Map();

        for (const attribute of rawAttributes) {
          if (!attributesByItemId.has(attribute.itemId)) {
            attributesByItemId.set(attribute.itemId, []);
          }
          attributesByItemId.get(attribute.itemId).push(attribute);
        }

        const components = (itemsPayload.data ?? []).map((item) =>
          simplifyLoadoutComponent(item, category, attributesByItemId.get(item.id) ?? [])
        );

        return {
          category,
          components
        };
      })
    );

    const components = categoryResults.flatMap((entry) => entry.components);
    const relevantItemIds = new Set(components.map((item) => item.id));
    const prices = (pricesPayload.data ?? [])
      .filter((item) => relevantItemIds.has(item.id_item) && (Number(item.price_buy ?? 0) > 0 || Number(item.price_sell ?? 0) > 0))
      .map(simplifyLoadoutPrice);

    const snapshot = {
      source: "UEX API 2.0",
      apiBase: UEX_API_BASE,
      fetchedAt: new Date().toISOString(),
      categories,
      vehicles: (vehiclesPayload.data ?? [])
        .map(simplifyVehicle)
        .filter((item) => item.isSpaceship || item.isGroundVehicle),
      terminals: (terminalsPayload.data ?? []).map(simplifyTerminal),
      components,
      prices
    };

    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    await fs.promises.writeFile(LOADOUT_SNAPSHOT_PATH, JSON.stringify(snapshot), "utf8");

    return {
      ok: true,
      fetchedAt: snapshot.fetchedAt,
      counts: {
        categories: snapshot.categories.length,
        vehicles: snapshot.vehicles.length,
        components: snapshot.components.length,
        prices: snapshot.prices.length,
        terminals: snapshot.terminals.length
      }
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error)
    };
  }
});

ipcMain.handle("loadout:get-snapshot", async () => {
  try {
    const content = await fs.promises.readFile(LOADOUT_SNAPSHOT_PATH, "utf8");
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

ipcMain.handle("trade:resolve-distances", async (_event, pairs = []) => {
  try {
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    const cache = await readJsonFile(TRADE_DISTANCE_CACHE_PATH, {});
    const result = {};

    for (const pair of pairs) {
      const originTerminalId = Number(pair?.originTerminalId);
      const destinationTerminalId = Number(pair?.destinationTerminalId);
      const key = getDistanceCacheKey(originTerminalId, destinationTerminalId);
      if (!key) continue;

      if (!(key in cache)) {
        cache[key] = await fetchTerminalDistance(originTerminalId, destinationTerminalId);
      }

      result[key] = cache[key];
    }

    await fs.promises.writeFile(TRADE_DISTANCE_CACHE_PATH, JSON.stringify(cache), "utf8");

    return {
      ok: true,
      distances: result
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

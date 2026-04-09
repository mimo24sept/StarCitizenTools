const fs = require("fs");

const UEX_API_BASE = "https://api.uexcorp.uk/2.0";
const WIKI_API_BASE = "https://api.star-citizen.wiki/api/v2/vehicles";
const WIKI_HARDPOINT_FILTER = ["SeatAccess", "SeatDashboard", "Seat", "DockingAnimator", "DoorController", "Door"]
  .map((entry) => `!${entry}`)
  .join(",");

async function fetchUexJson(endpoint) {
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

function isMiningVehicle(item) {
  const name = String(item.name_full || item.name || "").toLowerCase();
  return [
    "prospector",
    "mole",
    "roc",
    "roc-ds",
    "arrastra",
    "orion"
  ].some((needle) => name.includes(needle));
}

function buildMiningVehicleWikiQueries(vehicle) {
  const names = [
    vehicle.fullName,
    vehicle.name
  ]
    .filter(Boolean)
    .map((entry) => String(entry).trim());

  const simplified = names.flatMap((entry) => {
    const parts = entry.split(" ").filter(Boolean);
    if (parts.length <= 1) return [];
    return [
      parts.slice(1).join(" "),
      parts.at(-1)
    ];
  });

  return Array.from(new Set([...names, ...simplified].filter(Boolean)));
}

async function fetchWikiVehicleByQuery(query) {
  const url = new URL(`${WIKI_API_BASE}/${encodeURIComponent(query)}`);
  url.searchParams.set("locale", "en_EN");
  url.searchParams.set("include", "hardpoints,components,parts,shops");
  url.searchParams.set("filter[hardpoints]", WIKI_HARDPOINT_FILTER);

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "StarCitizenCompanion/0.2.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Wiki vehicle ${query} failed with HTTP ${response.status}`);
  }

  return await response.json();
}

function collectPotentialHardpoints(value, output = [], seen = new Set()) {
  if (!value || typeof value !== "object") return output;
  if (seen.has(value)) return output;
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((entry) => collectPotentialHardpoints(entry, output, seen));
    return output;
  }

  const keys = Object.keys(value);
  const looksLikeHardpoint = ["type", "sub_type", "class_name", "hardpoint", "item", "equipped_item"].some((key) => key in value);
  if (looksLikeHardpoint) {
    output.push(value);
  }

  keys.forEach((key) => collectPotentialHardpoints(value[key], output, seen));
  return output;
}

function stringifyHardpoint(value) {
  if (!value || typeof value !== "object") return "";
  return [
    value.name,
    value.type,
    value.sub_type,
    value.class_name,
    value.hardpoint,
    value.item?.name,
    value.equipped_item?.name
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function extractEquippedItemName(hardpoint) {
  return hardpoint?.item?.name || hardpoint?.equipped_item?.name || "";
}

function buildMiningProfileFromWiki(vehicle, components) {
  const hardpoints = collectPotentialHardpoints(vehicle?.hardpoints ?? []);
  const miningHeadNodes = hardpoints.filter((entry) => {
    const haystack = stringifyHardpoint(entry);
    return haystack.includes("mining") && (haystack.includes("arm") || haystack.includes("laser") || haystack.includes("head"));
  });

  const equippedHeadItems = miningHeadNodes
    .map((entry) => extractEquippedItemName(entry))
    .filter(Boolean)
    .map((name) => components.find((component) => component.categoryName === "Mining Laser Heads" && component.name === name))
    .filter(Boolean);

  const headSize = equippedHeadItems.find((item) => item.size)?.size || "";
  const moduleSlots = equippedHeadItems.reduce((total, item) => {
    const slotValue = Number(item.attributeMap?.["Module Slots"]?.value ?? 0);
    return total + (Number.isFinite(slotValue) ? slotValue : 0);
  }, 0);

  const typeName = String(vehicle?.type || vehicle?.classification || "").toLowerCase();
  const roleName = String(vehicle?.role || "").toLowerCase();
  const isGround = typeName.includes("ground") || roleName.includes("ground");
  const miningType = isGround ? "Ground gem mining" : "Ship mining";

  return {
    type: miningType,
    headSize,
    headCount: miningHeadNodes.length || 1,
    moduleSlots: moduleSlots || 0
  };
}

async function enrichMiningVehiclesWithWiki(vehicles, components) {
  const results = await Promise.all(
    vehicles.map(async (vehicle) => {
      const queries = buildMiningVehicleWikiQueries(vehicle);
      for (const query of queries) {
        try {
          const payload = await fetchWikiVehicleByQuery(query);
          const data = payload?.data;
          if (!data) continue;

          return {
            ...vehicle,
            miningProfile: buildMiningProfileFromWiki(data, components),
            wikiVehicle: {
              query,
              uuid: data.uuid || "",
              name: data.name || query
            }
          };
        } catch {
          // Best effort only: keep UEX vehicle even if wiki enrichment fails.
        }
      }

      return vehicle;
    })
  );

  return results;
}

async function syncTradeSnapshot(snapshotPath) {
  const [vehiclesPayload, terminalsPayload, commoditiesPayload, pricesPayload] = await Promise.all([
    fetchUexJson("vehicles"),
    fetchUexJson("terminals"),
    fetchUexJson("commodities"),
    fetchUexJson("commodities_prices_all")
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

  await fs.promises.writeFile(snapshotPath, JSON.stringify(snapshot), "utf8");

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
}

async function syncLoadoutSnapshot(snapshotPath) {
  const [categoriesPayload, vehiclesPayload, terminalsPayload, pricesPayload] = await Promise.all([
    fetchUexJson("categories"),
    fetchUexJson("vehicles"),
    fetchUexJson("terminals"),
    fetchUexJson("items_prices_all")
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
        fetchUexJson(`items?id_category=${category.id}`),
        fetchUexJson(`items_attributes?id_category=${category.id}`)
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

  await fs.promises.writeFile(snapshotPath, JSON.stringify(snapshot), "utf8");

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
}

async function syncMiningSnapshot(snapshotPath) {
  const [categoriesPayload, vehiclesPayload, terminalsPayload, pricesPayload, commoditiesPayload, commodityPricesPayload] = await Promise.all([
    fetchUexJson("categories"),
    fetchUexJson("vehicles"),
    fetchUexJson("terminals"),
    fetchUexJson("items_prices_all"),
    fetchUexJson("commodities"),
    fetchUexJson("commodities_prices_all")
  ]);

  const relevantCategoryNames = new Set([
    "Mining Laser Heads",
    "Mining Modules",
    "Gadgets"
  ]);

  const categories = (categoriesPayload.data ?? [])
    .filter((item) => item.type === "item" && relevantCategoryNames.has(item.name))
    .map(simplifyLoadoutCategory);

  const categoryResults = await Promise.all(
    categories.map(async (category) => {
      const [itemsPayload, attributesPayload] = await Promise.all([
        fetchUexJson(`items?id_category=${category.id}`),
        fetchUexJson(`items_attributes?id_category=${category.id}`)
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

  const minerals = (commoditiesPayload.data ?? [])
    .map(simplifyCommodity)
    .filter((item) => item.isVisible && item.isAvailableLive && (item.isMineral || item.isRaw));

  const mineralCommodityIds = new Set(minerals.map((item) => item.id));
  const mineralPrices = (commodityPricesPayload.data ?? [])
    .map(simplifyPrice)
    .filter((item) => mineralCommodityIds.has(item.commodityId) && (Number(item.priceBuy ?? 0) > 0 || Number(item.priceSell ?? 0) > 0));

  const vehicles = await enrichMiningVehiclesWithWiki(
    (vehiclesPayload.data ?? [])
      .map(simplifyVehicle)
      .filter(isMiningVehicle),
    components
  );

  const snapshot = {
    source: "UEX API 2.0",
    apiBase: UEX_API_BASE,
    fetchedAt: new Date().toISOString(),
    categories,
    vehicles,
    terminals: (terminalsPayload.data ?? []).map(simplifyTerminal),
    components,
    prices,
    minerals,
    mineralPrices
  };

  await fs.promises.writeFile(snapshotPath, JSON.stringify(snapshot), "utf8");

  return {
    ok: true,
    fetchedAt: snapshot.fetchedAt,
    counts: {
      categories: snapshot.categories.length,
      vehicles: snapshot.vehicles.length,
      components: snapshot.components.length,
      prices: snapshot.prices.length,
      minerals: snapshot.minerals.length,
      mineralPrices: snapshot.mineralPrices.length
    }
  };
}

function getDistanceCacheKey(originTerminalId, destinationTerminalId) {
  const left = Number(originTerminalId);
  const right = Number(destinationTerminalId);
  if (!left || !right) return "";
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

async function fetchTerminalDistance(originTerminalId, destinationTerminalId) {
  const payload = await fetchUexJson(`terminals_distances?id_terminal_origin=${originTerminalId}&id_terminal_destination=${destinationTerminalId}`);
  const distance = Number(payload?.data?.distance);
  return Number.isFinite(distance) && distance > 0 ? distance : null;
}

async function readJsonFile(filePath, fallback) {
  try {
    const content = await fs.promises.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

async function resolveTerminalDistances(cachePath, pairs = []) {
  const cache = await readJsonFile(cachePath, {});
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

  await fs.promises.writeFile(cachePath, JSON.stringify(cache), "utf8");

  return {
    ok: true,
    distances: result
  };
}

module.exports = {
  UEX_API_BASE,
  syncTradeSnapshot,
  syncLoadoutSnapshot,
  syncMiningSnapshot,
  resolveTerminalDistances
};

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const APP_SCHEMA = `
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS owned_blueprints (
  blueprint_ref INTEGER PRIMARY KEY,
  owned INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS saved_routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  ship_name TEXT,
  cargo_capacity INTEGER DEFAULT 0,
  investment_budget INTEGER DEFAULT 0,
  estimated_minutes INTEGER DEFAULT 0,
  origin TEXT,
  destination TEXT,
  route_json TEXT NOT NULL,
  overlay_x INTEGER DEFAULT 32,
  overlay_y INTEGER DEFAULT 32,
  overlay_scale REAL DEFAULT 1.0,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tracked_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  target_quantity REAL DEFAULT 0,
  current_quantity REAL DEFAULT 0,
  rarity TEXT,
  source_notes TEXT,
  session_delta REAL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS saved_loadouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ship_name TEXT NOT NULL,
  role TEXT,
  loadout_json TEXT NOT NULL,
  source_notes TEXT,
  updated_at TEXT NOT NULL
);
`;

function nowIso() {
  return new Date().toISOString();
}

function getIngredientQualityKey(ingredient) {
  return ingredient?.slot ?? ingredient?.name ?? "?";
}

let dbInstance = null;

function initDb(dataDir) {
  const dbPath = path.join(dataDir, 'craft_tracker.db');
  fs.mkdirSync(dataDir, { recursive: true });
  dbInstance = new Database(dbPath);
  dbInstance.exec(APP_SCHEMA);
  return dbInstance;
}

function queryAll(sql, params = []) {
  return dbInstance.prepare(sql).all(...params);
}

function queryOne(sql, params = []) {
  return dbInstance.prepare(sql).get(...params) ?? null;
}

function runDb(sql, params = []) {
  const info = dbInstance.prepare(sql).run(...params);
  return info;
}

function getVersions() {
  return queryAll(
    `SELECT version, channel, active, created_at
     FROM versions
     ORDER BY active DESC, CASE channel WHEN 'live' THEN 0 ELSE 1 END, created_at DESC`
  );
}

function getDefaultVersion() {
  const versions = getVersions();
  return versions[0]?.version ?? "";
}

function getStats(version) {
  return queryOne(
    `SELECT total_blueprints AS totalBlueprints, unique_ingredients AS uniqueIngredients, fetched_at AS fetchedAt
     FROM stats_snapshot WHERE version = ?`,
    [version]
  );
}

function getOverview(version) {
  const totalRow = queryOne("SELECT COUNT(*) AS total FROM blueprints WHERE version = ?", [version]);
  const ownedRow = queryOne(
    `SELECT COUNT(*) AS total
     FROM owned_blueprints ob
     JOIN blueprints b ON b.id = ob.blueprint_ref
     WHERE b.version = ? AND ob.owned = 1`,
    [version]
  );
  const stats = getStats(version);
  return {
    totalBlueprints: Number(totalRow?.total ?? 0),
    ownedBlueprints: Number(ownedRow?.total ?? 0),
    uniqueIngredients: Number(stats?.uniqueIngredients ?? 0),
    fetchedAt: stats?.fetchedAt ?? null
  };
}

function getCategories(version) {
  return queryAll(
    `SELECT DISTINCT category
     FROM blueprints
     WHERE version = ? AND category IS NOT NULL AND category <> ''
     ORDER BY category`,
    [version]
  ).map((row) => row.category);
}

function getResources(version) {
  const hinted = queryAll(
    `SELECT value FROM filter_values WHERE version = ? AND value_type = 'resource' ORDER BY value`,
    [version]
  ).map((row) => row.value);
  if (hinted.length) return hinted;
  return queryAll("SELECT DISTINCT name FROM ingredient_options WHERE name IS NOT NULL AND name <> '' ORDER BY name").map((row) => row.name);
}

function getMissionTypes(version) {
  return queryAll(
    `SELECT DISTINCT m.mission_type AS missionType
     FROM missions m
     JOIN blueprints b ON b.id = m.blueprint_ref
     WHERE b.version = ? AND m.mission_type IS NOT NULL AND TRIM(m.mission_type) <> ''
     ORDER BY m.mission_type`,
    [version]
  ).map((row) => row.missionType);
}

function getMissionLocations(version) {
  const rows = queryAll(
    `SELECT DISTINCT m.locations
     FROM missions m
     JOIN blueprints b ON b.id = m.blueprint_ref
     WHERE b.version = ? AND m.locations IS NOT NULL AND TRIM(m.locations) <> ''`,
    [version]
  );
  const values = new Set();
  for (const row of rows) {
    for (const part of String(row.locations).split(",")) {
      const value = part.trim();
      if (value) values.add(value);
    }
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

function searchBlueprints({ version, search = "", category = "", resource = "", ownedOnly = false, missionOnly = false, missionType = "", missionLocation = "" }) {
  let sql = `
    SELECT DISTINCT
      b.id,
      b.name,
      b.category,
      b.craft_time_seconds AS craftTimeSeconds,
      b.tiers,
      CASE WHEN EXISTS (SELECT 1 FROM missions m2 WHERE m2.blueprint_ref = b.id) THEN 1 ELSE 0 END AS hasMission,
      COALESCE(ob.owned, 0) AS owned
    FROM blueprints b
    LEFT JOIN blueprint_ingredients bi ON bi.blueprint_ref = b.id
    LEFT JOIN ingredient_options io ON io.ingredient_ref = bi.id
    LEFT JOIN owned_blueprints ob ON ob.blueprint_ref = b.id
    WHERE b.version = ?
  `;
  const params = [version];
  if (search.trim()) {
    sql += " AND (LOWER(b.name) LIKE ? OR LOWER(b.blueprint_id) LIKE ?)";
    const pattern = `%${search.trim().toLowerCase()}%`;
    params.push(pattern, pattern);
  }
  if (category) {
    sql += " AND b.category = ?";
    params.push(category);
  }
  if (resource) {
    sql += " AND (bi.display_name = ? OR io.name = ?)";
    params.push(resource, resource);
  }
  if (missionOnly || missionType || missionLocation) {
    sql += " AND EXISTS (SELECT 1 FROM missions m WHERE m.blueprint_ref = b.id";
    if (missionType) {
      sql += " AND m.mission_type = ?";
      params.push(missionType);
    }
    if (missionLocation) {
      sql += " AND LOWER(m.locations) LIKE ?";
      params.push(`%${missionLocation.toLowerCase()}%`);
    }
    sql += ")";
  }
  if (ownedOnly) {
    sql += " AND COALESCE(ob.owned, 0) = 1";
  }
  sql += " ORDER BY b.name LIMIT 1400";
  return queryAll(sql, params).map((row) => ({
    ...row,
    hasMission: Number(row.hasMission) === 1,
    owned: Number(row.owned) === 1
  }));
}

function getBlueprintDetail(id) {
  const row = queryOne(
    `SELECT b.raw_json AS rawJson, COALESCE(ob.owned, 0) AS owned
     FROM blueprints b
     LEFT JOIN owned_blueprints ob ON ob.blueprint_ref = b.id
     WHERE b.id = ?`,
    [id]
  );
  if (!row) return null;
  const payload = JSON.parse(row.rawJson);
  payload.owned = Number(row.owned) === 1;
  return payload;
}

function setBlueprintOwned(id, owned) {
  runDb(
    `INSERT INTO owned_blueprints(blueprint_ref, owned, updated_at)
     VALUES(?, ?, ?)
     ON CONFLICT(blueprint_ref) DO UPDATE SET owned=excluded.owned, updated_at=excluded.updated_at`,
    [id, owned ? 1 : 0, nowIso()]
  );
}

function interpolateQualityEffects(payload, quality) {
  const qualityMap = typeof quality === "object" && quality !== null ? quality : null;
  const defaultQuality = qualityMap ? Number(qualityMap.__default ?? 500) : Number(quality);
  const results = [];
  for (const ingredient of payload.ingredients ?? []) {
    const rawQuality = qualityMap ? qualityMap[getIngredientQualityKey(ingredient)] ?? defaultQuality : defaultQuality;
    const q = Math.max(0, Math.min(1000, Number(rawQuality)));
    for (const effect of ingredient.quality_effects ?? []) {
      const min = Number(effect.quality_min ?? 0);
      const max = Number(effect.quality_max ?? 1000);
      const atMin = Number(effect.modifier_at_min ?? 1);
      const atMax = Number(effect.modifier_at_max ?? 1);
      const ratio = max === min ? 0 : Math.max(0, Math.min(1, (q - min) / (max - min)));
      const modifier = atMin + (atMax - atMin) * ratio;
      results.push({
        slot: ingredient.slot ?? "?",
        material: ingredient.name,
        stat: effect.stat ?? "Stat",
        modifier,
        modifierPercent: (modifier - 1) * 100
      });
    }
  }
  return results;
}

function getInventory() {
  return queryAll(
    `SELECT id, resource_name AS resourceName, quantity_scu AS quantityScu, quality, location, notes, updated_at AS updatedAt
     FROM inventory
     ORDER BY resource_name, quality DESC, quantity_scu DESC`
  );
}

function evaluateCraft(payload, multiplier = 1) {
  const inventory = getInventory();
  const byName = new Map();
  for (const item of inventory) {
    if (!byName.has(item.resourceName)) byName.set(item.resourceName, []);
    byName.get(item.resourceName).push(item);
  }
  const slots = [];
  let craftable = true;
  let possible = null;
  for (const ingredient of payload.ingredients ?? []) {
    let best = null;
    for (const option of ingredient.options ?? []) {
      const required = Number(option.quantity_scu ?? ingredient.quantity_scu ?? 0) * multiplier;
      const minQuality = Number(option.min_quality ?? 0);
      const available = (byName.get(option.name) ?? []).filter((item) => Number(item.quality) >= minQuality);
      const total = available.reduce((sum, item) => sum + Number(item.quantityScu), 0);
      if (!best || total > best.stock) {
        best = {
          slot: ingredient.slot ?? "?",
          material: option.name ?? ingredient.name,
          required,
          stock: total,
          minQuality,
          ok: total >= required
        };
      }
    }
    if (!best) {
      best = {
        slot: ingredient.slot ?? "?",
        material: ingredient.name,
        required: Number(ingredient.quantity_scu ?? 0) * multiplier,
        stock: 0,
        minQuality: 0,
        ok: false
      };
    }
    craftable = craftable && best.ok;
    const count = best.required > 0 ? Math.floor(best.stock / best.required) : 0;
    possible = possible === null ? count : Math.min(possible, count);
    slots.push(best);
  }
  return {
    craftable,
    possibleCount: possible ?? 0,
    slots
  };
}

function addInventory(item) {
  runDb(
    `INSERT INTO inventory(resource_name, quantity_scu, quality, location, notes, updated_at)
     VALUES(?, ?, ?, ?, ?, ?)`,
    [item.resourceName, item.quantityScu, item.quality, item.location ?? "", item.notes ?? "", nowIso()]
  );
}

function updateInventory(id, item) {
  runDb(
    `UPDATE inventory
     SET resource_name = ?, quantity_scu = ?, quality = ?, location = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [item.resourceName, item.quantityScu, item.quality, item.location ?? "", item.notes ?? "", nowIso(), id]
  );
}

function deleteInventory(id) {
  runDb("DELETE FROM inventory WHERE id = ?", [id]);
}

function getRoutes() {
  return queryAll(
    `SELECT id, name, ship_name AS shipName, cargo_capacity AS cargoCapacity, investment_budget AS investmentBudget,
            estimated_minutes AS estimatedMinutes, origin, destination, route_json AS routeJson,
            overlay_x AS overlayX, overlay_y AS overlayY, overlay_scale AS overlayScale, updated_at AS updatedAt
     FROM saved_routes
     ORDER BY updated_at DESC, name`
  ).map((row) => ({
    ...row,
    routeSteps: JSON.parse(row.routeJson)
  }));
}

function saveRoute(route) {
  const routeJson = JSON.stringify(route.routeSteps ?? []);
  if (route.id) {
    runDb(
      `UPDATE saved_routes
       SET name=?, ship_name=?, cargo_capacity=?, investment_budget=?, estimated_minutes=?, origin=?, destination=?, route_json=?, overlay_x=?, overlay_y=?, overlay_scale=?, updated_at=?
       WHERE id=?`,
      [route.name, route.shipName, route.cargoCapacity, route.investmentBudget, route.estimatedMinutes, route.origin, route.destination, routeJson, route.overlayX, route.overlayY, route.overlayScale, nowIso(), route.id]
    );
  } else {
    runDb(
      `INSERT INTO saved_routes(name, ship_name, cargo_capacity, investment_budget, estimated_minutes, origin, destination, route_json, overlay_x, overlay_y, overlay_scale, updated_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [route.name, route.shipName, route.cargoCapacity, route.investmentBudget, route.estimatedMinutes, route.origin, route.destination, routeJson, route.overlayX, route.overlayY, route.overlayScale, nowIso()]
    );
  }
}

function deleteRoute(id) {
  runDb("DELETE FROM saved_routes WHERE id = ?", [id]);
}

function getLoadouts() {
  return queryAll(
    `SELECT id, ship_name AS shipName, role, loadout_json AS loadoutJson, source_notes AS sourceNotes, updated_at AS updatedAt
     FROM saved_loadouts ORDER BY updated_at DESC, ship_name`
  ).map((row) => ({
    ...row,
    loadout: JSON.parse(row.loadoutJson)
  }));
}

function saveLoadout(loadout) {
  const payload = JSON.stringify(loadout.loadout ?? {});
  if (loadout.id) {
    runDb(
      `UPDATE saved_loadouts SET ship_name=?, role=?, loadout_json=?, source_notes=?, updated_at=? WHERE id=?`,
      [loadout.shipName, loadout.role, payload, loadout.sourceNotes ?? "", nowIso(), loadout.id]
    );
  } else {
    runDb(
      `INSERT INTO saved_loadouts(ship_name, role, loadout_json, source_notes, updated_at)
       VALUES(?, ?, ?, ?, ?)`,
      [loadout.shipName, loadout.role, payload, loadout.sourceNotes ?? "", nowIso()]
    );
  }
}

function deleteLoadout(id) {
  runDb("DELETE FROM saved_loadouts WHERE id = ?", [id]);
}

function getTrackedResources() {
  return queryAll(
    `SELECT id, name, target_quantity AS targetQuantity, current_quantity AS currentQuantity,
            rarity, source_notes AS sourceNotes, session_delta AS sessionDelta, updated_at AS updatedAt
     FROM tracked_resources ORDER BY updated_at DESC, name`
  );
}

function saveTrackedResource(item) {
  if (item.id) {
    runDb(
      `UPDATE tracked_resources
       SET name=?, target_quantity=?, current_quantity=?, rarity=?, source_notes=?, session_delta=?, updated_at=?
       WHERE id=?`,
      [item.name, item.targetQuantity, item.currentQuantity, item.rarity, item.sourceNotes ?? "", item.sessionDelta, nowIso(), item.id]
    );
  } else {
    runDb(
      `INSERT INTO tracked_resources(name, target_quantity, current_quantity, rarity, source_notes, session_delta, updated_at)
       VALUES(?, ?, ?, ?, ?, ?, ?)`,
      [item.name, item.targetQuantity, item.currentQuantity, item.rarity, item.sourceNotes ?? "", item.sessionDelta, nowIso()]
    );
  }
}

function deleteTrackedResource(id) {
  runDb("DELETE FROM tracked_resources WHERE id = ?", [id]);
}

function reloadFromDisk() {
  // Not needed internally anymore since better-sqlite3 persists on query
  // but we can expose it if a reload is forced.
  return true;
}

module.exports = {
  initDb,
  getVersions,
  getDefaultVersion,
  getStats,
  getOverview,
  getCategories,
  getResources,
  getMissionTypes,
  getMissionLocations,
  searchBlueprints,
  getBlueprintDetail,
  setBlueprintOwned,
  interpolateQualityEffects,
  getInventory,
  evaluateCraft,
  addInventory,
  updateInventory,
  deleteInventory,
  getRoutes,
  saveRoute,
  deleteRoute,
  getLoadouts,
  saveLoadout,
  deleteLoadout,
  getTrackedResources,
  saveTrackedResource,
  deleteTrackedResource,
  reloadFromDisk
};

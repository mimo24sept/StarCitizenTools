import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";

const DB_PATH = "data/craft_tracker.db";

const APP_SCHEMA = `
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

function rowsFromStatement(statement, params = []) {
  statement.bind(params);
  const rows = [];
  while (statement.step()) {
    rows.push(statement.getAsObject());
  }
  statement.free();
  return rows;
}

function queryAll(db, sql, params = []) {
  const statement = db.prepare(sql);
  return rowsFromStatement(statement, params);
}

function queryOne(db, sql, params = []) {
  return queryAll(db, sql, params)[0] ?? null;
}

export async function createDbClient() {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const bytes = await window.desktopAPI.readBytes(DB_PATH);
  let db = new SQL.Database(new Uint8Array(bytes));
  db.run(APP_SCHEMA);

  async function persist() {
    const exported = db.export();
    await window.desktopAPI.writeBytes(DB_PATH, exported.buffer);
  }

  function getVersions() {
    return queryAll(
      db,
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
      db,
      `SELECT total_blueprints AS totalBlueprints, unique_ingredients AS uniqueIngredients, fetched_at AS fetchedAt
       FROM stats_snapshot WHERE version = ?`,
      [version]
    );
  }

  function getOverview(version) {
    const totalRow = queryOne(db, "SELECT COUNT(*) AS total FROM blueprints WHERE version = ?", [version]);
    const ownedRow = queryOne(
      db,
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
      db,
      `SELECT DISTINCT category
       FROM blueprints
       WHERE version = ? AND category IS NOT NULL AND category <> ''
       ORDER BY category`,
      [version]
    ).map((row) => row.category);
  }

  function getResources(version) {
    const hinted = queryAll(
      db,
      `SELECT value FROM filter_values WHERE version = ? AND value_type = 'resource' ORDER BY value`,
      [version]
    ).map((row) => row.value);
    if (hinted.length) return hinted;
    return queryAll(db, "SELECT DISTINCT name FROM ingredient_options WHERE name IS NOT NULL AND name <> '' ORDER BY name").map((row) => row.name);
  }

  function searchBlueprints({ version, search = "", category = "", resource = "", ownedOnly = false }) {
    let sql = `
      SELECT DISTINCT
        b.id,
        b.name,
        b.category,
        b.craft_time_seconds AS craftTimeSeconds,
        b.tiers,
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
    if (ownedOnly) {
      sql += " AND COALESCE(ob.owned, 0) = 1";
    }
    sql += " ORDER BY b.name LIMIT 1400";
    return queryAll(db, sql, params).map((row) => ({
      ...row,
      owned: Number(row.owned) === 1
    }));
  }

  function getBlueprintDetail(id) {
    const row = queryOne(
      db,
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

  async function setBlueprintOwned(id, owned) {
    db.run(
      `INSERT INTO owned_blueprints(blueprint_ref, owned, updated_at)
       VALUES(?, ?, ?)
       ON CONFLICT(blueprint_ref) DO UPDATE SET owned=excluded.owned, updated_at=excluded.updated_at`,
      [id, owned ? 1 : 0, nowIso()]
    );
    await persist();
  }

  function interpolateQualityEffects(payload, quality) {
    const q = Math.max(0, Math.min(1000, Number(quality)));
    const results = [];
    for (const ingredient of payload.ingredients ?? []) {
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
      db,
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

  async function addInventory(item) {
    db.run(
      `INSERT INTO inventory(resource_name, quantity_scu, quality, location, notes, updated_at)
       VALUES(?, ?, ?, ?, ?, ?)`,
      [item.resourceName, item.quantityScu, item.quality, item.location ?? "", item.notes ?? "", nowIso()]
    );
    await persist();
  }

  async function updateInventory(id, item) {
    db.run(
      `UPDATE inventory
       SET resource_name = ?, quantity_scu = ?, quality = ?, location = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [item.resourceName, item.quantityScu, item.quality, item.location ?? "", item.notes ?? "", nowIso(), id]
    );
    await persist();
  }

  async function deleteInventory(id) {
    db.run("DELETE FROM inventory WHERE id = ?", [id]);
    await persist();
  }

  function getRoutes() {
    return queryAll(
      db,
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

  async function saveRoute(route) {
    const routeJson = JSON.stringify(route.routeSteps ?? []);
    if (route.id) {
      db.run(
        `UPDATE saved_routes
         SET name=?, ship_name=?, cargo_capacity=?, investment_budget=?, estimated_minutes=?, origin=?, destination=?, route_json=?, overlay_x=?, overlay_y=?, overlay_scale=?, updated_at=?
         WHERE id=?`,
        [route.name, route.shipName, route.cargoCapacity, route.investmentBudget, route.estimatedMinutes, route.origin, route.destination, routeJson, route.overlayX, route.overlayY, route.overlayScale, nowIso(), route.id]
      );
    } else {
      db.run(
        `INSERT INTO saved_routes(name, ship_name, cargo_capacity, investment_budget, estimated_minutes, origin, destination, route_json, overlay_x, overlay_y, overlay_scale, updated_at)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [route.name, route.shipName, route.cargoCapacity, route.investmentBudget, route.estimatedMinutes, route.origin, route.destination, routeJson, route.overlayX, route.overlayY, route.overlayScale, nowIso()]
      );
    }
    await persist();
  }

  async function deleteRoute(id) {
    db.run("DELETE FROM saved_routes WHERE id = ?", [id]);
    await persist();
  }

  function getLoadouts() {
    return queryAll(
      db,
      `SELECT id, ship_name AS shipName, role, loadout_json AS loadoutJson, source_notes AS sourceNotes, updated_at AS updatedAt
       FROM saved_loadouts ORDER BY updated_at DESC, ship_name`
    ).map((row) => ({
      ...row,
      loadout: JSON.parse(row.loadoutJson)
    }));
  }

  async function saveLoadout(loadout) {
    const payload = JSON.stringify(loadout.loadout ?? {});
    if (loadout.id) {
      db.run(
        `UPDATE saved_loadouts SET ship_name=?, role=?, loadout_json=?, source_notes=?, updated_at=? WHERE id=?`,
        [loadout.shipName, loadout.role, payload, loadout.sourceNotes ?? "", nowIso(), loadout.id]
      );
    } else {
      db.run(
        `INSERT INTO saved_loadouts(ship_name, role, loadout_json, source_notes, updated_at)
         VALUES(?, ?, ?, ?, ?)`,
        [loadout.shipName, loadout.role, payload, loadout.sourceNotes ?? "", nowIso()]
      );
    }
    await persist();
  }

  async function deleteLoadout(id) {
    db.run("DELETE FROM saved_loadouts WHERE id = ?", [id]);
    await persist();
  }

  function getTrackedResources() {
    return queryAll(
      db,
      `SELECT id, name, target_quantity AS targetQuantity, current_quantity AS currentQuantity,
              rarity, source_notes AS sourceNotes, session_delta AS sessionDelta, updated_at AS updatedAt
       FROM tracked_resources ORDER BY updated_at DESC, name`
    );
  }

  async function saveTrackedResource(item) {
    if (item.id) {
      db.run(
        `UPDATE tracked_resources
         SET name=?, target_quantity=?, current_quantity=?, rarity=?, source_notes=?, session_delta=?, updated_at=?
         WHERE id=?`,
        [item.name, item.targetQuantity, item.currentQuantity, item.rarity, item.sourceNotes ?? "", item.sessionDelta, nowIso(), item.id]
      );
    } else {
      db.run(
        `INSERT INTO tracked_resources(name, target_quantity, current_quantity, rarity, source_notes, session_delta, updated_at)
         VALUES(?, ?, ?, ?, ?, ?, ?)`,
        [item.name, item.targetQuantity, item.currentQuantity, item.rarity, item.sourceNotes ?? "", item.sessionDelta, nowIso()]
      );
    }
    await persist();
  }

  async function deleteTrackedResource(id) {
    db.run("DELETE FROM tracked_resources WHERE id = ?", [id]);
    await persist();
  }

  async function reloadFromDisk() {
    const freshBytes = await window.desktopAPI.readBytes(DB_PATH);
    db.close();
    db = new SQL.Database(new Uint8Array(freshBytes));
    db.run(APP_SCHEMA);
  }

  return {
    getVersions,
    getDefaultVersion,
    getStats,
    getOverview,
    getCategories,
    getResources,
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
}

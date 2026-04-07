const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const API_BASE = "https://sc-craft.tools/api";

const APP_SCHEMA = `
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS versions (id INTEGER PRIMARY KEY, version TEXT NOT NULL UNIQUE, channel TEXT, active INTEGER DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS filter_values (value_type TEXT NOT NULL, value TEXT NOT NULL, version TEXT NOT NULL, PRIMARY KEY (value_type, value, version));
CREATE TABLE IF NOT EXISTS stats_snapshot (version TEXT PRIMARY KEY, total_blueprints INTEGER, unique_ingredients INTEGER, raw_json TEXT NOT NULL, fetched_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS blueprints (id INTEGER PRIMARY KEY, blueprint_id TEXT, name TEXT NOT NULL, category TEXT, craft_time_seconds INTEGER, tiers INTEGER, default_owned INTEGER DEFAULT 0, item_stats_json TEXT, version TEXT NOT NULL, raw_json TEXT NOT NULL, imported_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_blueprints_name ON blueprints(name);
CREATE INDEX IF NOT EXISTS idx_blueprints_version ON blueprints(version);
CREATE INDEX IF NOT EXISTS idx_blueprints_category ON blueprints(category);
CREATE TABLE IF NOT EXISTS blueprint_ingredients (id INTEGER PRIMARY KEY AUTOINCREMENT, blueprint_ref INTEGER NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE, slot TEXT, display_name TEXT, quantity_scu REAL);
CREATE INDEX IF NOT EXISTS idx_ingredients_blueprint_ref ON blueprint_ingredients(blueprint_ref);
CREATE TABLE IF NOT EXISTS ingredient_options (id INTEGER PRIMARY KEY AUTOINCREMENT, ingredient_ref INTEGER NOT NULL REFERENCES blueprint_ingredients(id) ON DELETE CASCADE, guid TEXT, name TEXT NOT NULL, quantity_scu REAL, min_quality INTEGER DEFAULT 0, unit TEXT, loc_key TEXT);
CREATE INDEX IF NOT EXISTS idx_ingredient_options_name ON ingredient_options(name);
CREATE INDEX IF NOT EXISTS idx_ingredient_options_ingredient_ref ON ingredient_options(ingredient_ref);
CREATE TABLE IF NOT EXISTS quality_effects (id INTEGER PRIMARY KEY AUTOINCREMENT, ingredient_ref INTEGER NOT NULL REFERENCES blueprint_ingredients(id) ON DELETE CASCADE, effect_name TEXT, raw_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS missions (id INTEGER PRIMARY KEY AUTOINCREMENT, blueprint_ref INTEGER NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE, name TEXT, contractor TEXT, mission_type TEXT, category TEXT, lawful INTEGER, not_for_release INTEGER, drop_chance TEXT, locations TEXT, description TEXT, time_to_complete_minutes INTEGER, raw_json TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_missions_blueprint_ref ON missions(blueprint_ref);
CREATE TABLE IF NOT EXISTS inventory (id INTEGER PRIMARY KEY AUTOINCREMENT, resource_name TEXT NOT NULL, quantity_scu REAL NOT NULL, quality INTEGER NOT NULL, location TEXT, notes TEXT, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_inventory_resource_name ON inventory(resource_name);
CREATE TABLE IF NOT EXISTS owned_blueprints (blueprint_ref INTEGER PRIMARY KEY REFERENCES blueprints(id) ON DELETE CASCADE, owned INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS saved_routes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, ship_name TEXT, cargo_capacity INTEGER DEFAULT 0, investment_budget INTEGER DEFAULT 0, estimated_minutes INTEGER DEFAULT 0, origin TEXT, destination TEXT, route_json TEXT NOT NULL, overlay_x INTEGER DEFAULT 32, overlay_y INTEGER DEFAULT 32, overlay_scale REAL DEFAULT 1.0, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tracked_resources (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, target_quantity REAL DEFAULT 0, current_quantity REAL DEFAULT 0, rarity TEXT, source_notes TEXT, session_delta REAL DEFAULT 0, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS saved_loadouts (id INTEGER PRIMARY KEY AUTOINCREMENT, ship_name TEXT NOT NULL, role TEXT, loadout_json TEXT NOT NULL, source_notes TEXT, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sync_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, started_at TEXT NOT NULL, ended_at TEXT, status TEXT NOT NULL, version TEXT, imported_blueprints INTEGER DEFAULT 0, last_blueprint_id INTEGER DEFAULT 0, message TEXT);
`;

async function fetchJson(endpoint, params = {}) {
  const url = new URL(`${API_BASE}${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.append(k, v);
  const response = await fetch(url.toString(), {
    headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json, text/plain, */*" },
  });
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function normalizeFilterHintValue(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") {
    if (typeof value.name === "string" && value.name.trim()) return value.name;
    if (typeof value.value === "string" && value.value.trim()) return value.value;
    if (typeof value.loc_key === "string" && value.loc_key.trim()) return value.loc_key;
    return JSON.stringify(value);
  }
  return "";
}

async function fetchBlueprintWithRetry(id, version) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const payload = await fetchJson(`/blueprints/${id}`, { version });
      if (payload && payload.id) return payload;
    } catch (e) {
      if (e.message.includes("404")) return null;
      console.log(`Blueprint ${id} error: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 2000 + attempt * 2000));
  }
  return null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function sanitizeSqlParam(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
}

async function fetchBlueprintPage(version, page = 1, limit = 100) {
  return fetchJson('/blueprints', { version, page, limit });
}

async function fetchAllBlueprints(version, logCallback = console.log) {
  const allItems = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const payload = await fetchBlueprintPage(version, page, 100);
    totalPages = Number(payload?.pagination?.pages ?? 1);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    allItems.push(...items);
    logCallback(`Fetched blueprint page ${page}/${totalPages} (${allItems.length} loaded)`);
    page += 1;
  }

  return allItems.sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0));
}

function sanitizeSqlParams(params = []) {
  return params.map(sanitizeSqlParam);
}

async function runSync(dataDir, logCallback = console.log) {
  const dbPath = path.join(dataDir, 'craft_tracker.db');
  fs.mkdirSync(dataDir, { recursive: true });

  const SQL = await initSqlJs();
  let db;
  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }
  db.run(APP_SCHEMA);

  function exportDb() {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }

  function run(sql, params = []) {
    db.run(sql, sanitizeSqlParams(params));
  }

  function queryOne(sql, params = []) {
    const stmt = db.prepare(sql);
    let result = null;
    stmt.bind(sanitizeSqlParams(params));
    if (stmt.step()) {
        result = stmt.getAsObject();
    }
    stmt.free();
    return result;
  }

  function startSyncRun(version) {
    run("INSERT INTO sync_runs(started_at, status, version, imported_blueprints, last_blueprint_id, message) VALUES(?, 'running', ?, 0, 0, '')", [new Date().toISOString(), version]);
    return queryOne("SELECT last_insert_rowid() as id").id;
  }

  function updateSyncRun(runId, status, imported, lastId, message) {
    run(`UPDATE sync_runs SET status=?, imported_blueprints=?, last_blueprint_id=?, message=?, ended_at=CASE WHEN ? IN ('done', 'failed') THEN ? ELSE ended_at END WHERE id=?`, [status, imported, lastId, message, status, new Date().toISOString(), runId]);
  }

  let runId = null;
  let imported = 0;
  let lastId = 0;
  let chosenVersion = "";

  try {
    logCallback("Fetching versions...");
    const versions = await fetchJson('/versions');
    for (const v of versions) {
      run("INSERT INTO versions(id, version, channel, active, created_at) VALUES(?,?,?,?,?) ON CONFLICT(version) DO UPDATE SET id=excluded.id, channel=excluded.channel, active=excluded.active, created_at=excluded.created_at", [v.id, v.version, v.channel, v.active ? 1 : 0, v.created_at]);
    }

    const versionsList = db.exec("SELECT * FROM versions ORDER BY active DESC, CASE channel WHEN 'live' THEN 0 ELSE 1 END, created_at DESC")[0]?.values || [];
    if (!versionsList.length) throw new Error("No versions available.");
    chosenVersion = versionsList[0][1]; // version string
    logCallback(`Chosen version: ${chosenVersion}`);

    const hints = await fetchJson('/filter-hints', { version: chosenVersion });
    run("DELETE FROM filter_values WHERE version=?", [chosenVersion]);
    for (const [type, values] of Object.entries(hints)) {
      for (const val of values) {
        const normalizedValue = normalizeFilterHintValue(val);
        if (!normalizedValue) continue;
        run("INSERT OR IGNORE INTO filter_values(value_type, value, version) VALUES(?,?,?)", [type, normalizedValue, chosenVersion]);
      }
    }

    const stats = await fetchJson('/stats', { version: chosenVersion });
    run("INSERT INTO stats_snapshot(version, total_blueprints, unique_ingredients, raw_json, fetched_at) VALUES(?,?,?,?,?) ON CONFLICT(version) DO UPDATE SET total_blueprints=excluded.total_blueprints, unique_ingredients=excluded.unique_ingredients, raw_json=excluded.raw_json, fetched_at=excluded.fetched_at", [chosenVersion, stats.totalBlueprints, stats.uniqueIngredients, JSON.stringify(stats), new Date().toISOString()]);

    const blueprints = await fetchAllBlueprints(chosenVersion, logCallback);
    const targetTotal = blueprints.length || stats.totalBlueprints || 0;
    runId = startSyncRun(chosenVersion);

    run("INSERT INTO metadata(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", ["last_sync_version", chosenVersion]);
    run("INSERT INTO metadata(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", ["last_sync_expected_total", String(targetTotal)]);

    for (const payload of blueprints) {
        if (!payload?.id) continue;
        lastId = Number(payload.id);
            run(`
              INSERT INTO blueprints(id, blueprint_id, name, category, craft_time_seconds, tiers, default_owned, item_stats_json, version, raw_json, imported_at)
              VALUES(?,?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT(id) DO UPDATE SET blueprint_id=excluded.blueprint_id, name=excluded.name, category=excluded.category, craft_time_seconds=excluded.craft_time_seconds, tiers=excluded.tiers, default_owned=excluded.default_owned, item_stats_json=excluded.item_stats_json, version=excluded.version, raw_json=excluded.raw_json, imported_at=excluded.imported_at
            `, [payload.id, payload.blueprint_id, payload.name, payload.category, payload.craft_time_seconds, payload.tiers, payload.default_owned ? 1 : 0, JSON.stringify(payload.item_stats || {}), chosenVersion, JSON.stringify(payload), new Date().toISOString()]);

            run("DELETE FROM blueprint_ingredients WHERE blueprint_ref=?", [payload.id]);
            run("DELETE FROM missions WHERE blueprint_ref=?", [payload.id]);

            for (const ing of payload.ingredients || []) {
                run("INSERT INTO blueprint_ingredients(blueprint_ref, slot, display_name, quantity_scu) VALUES(?,?,?,?)", [payload.id, ing.slot, ing.name, ing.quantity_scu]);
                const ingId = queryOne("SELECT last_insert_rowid() as id").id;
                
                for (const opt of ing.options || []) {
                    run("INSERT INTO ingredient_options(ingredient_ref, guid, name, quantity_scu, min_quality, unit, loc_key) VALUES(?,?,?,?,?,?,?)", [ingId, opt.guid, opt.name, opt.quantity_scu, opt.min_quality || 0, opt.unit, opt.loc_key]);
                }
                for (const eff of ing.quality_effects || []) {
                    run("INSERT INTO quality_effects(ingredient_ref, effect_name, raw_json) VALUES(?,?,?)", [ingId, typeof eff === 'object' ? eff.name : null, JSON.stringify(eff)]);
                }
            }

            for (const m of payload.missions || []) {
                run("INSERT INTO missions(blueprint_ref, name, contractor, mission_type, category, lawful, not_for_release, drop_chance, locations, description, time_to_complete_minutes, raw_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", [payload.id, m.name, m.contractor, m.mission_type, m.category, m.lawful ? 1 : 0, m.not_for_release ? 1 : 0, m.drop_chance, m.locations, m.description, m.time_to_complete_minutes, JSON.stringify(m)]);
            }

            imported++;
            updateSyncRun(runId, 'running', imported, lastId, `Blueprint #${payload.id} importe: ${payload.name}`);
            logCallback(`[${imported}] ${payload.name}`);
    }
    
    updateSyncRun(runId, 'done', imported, lastId, "Synchronisation terminee.");
    exportDb();
    logCallback("Sync complete and DB written to disk.");
    return { ok: true, version: chosenVersion, imported, lastId };
  } catch (error) {
    console.error(error);
    if (runId) {
      updateSyncRun(runId, 'failed', imported, lastId, String(error));
    }
    exportDb(); // Export anyway to save logs
    return { ok: false, error: String(error) };
  }
}

module.exports = { runSync };

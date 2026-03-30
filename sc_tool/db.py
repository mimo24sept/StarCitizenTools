from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .config import DATA_DIR, DB_PATH


SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS versions (
    id INTEGER PRIMARY KEY,
    version TEXT NOT NULL UNIQUE,
    channel TEXT,
    active INTEGER DEFAULT 0,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS filter_values (
    value_type TEXT NOT NULL,
    value TEXT NOT NULL,
    version TEXT NOT NULL,
    PRIMARY KEY (value_type, value, version)
);

CREATE TABLE IF NOT EXISTS stats_snapshot (
    version TEXT PRIMARY KEY,
    total_blueprints INTEGER,
    unique_ingredients INTEGER,
    raw_json TEXT NOT NULL,
    fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blueprints (
    id INTEGER PRIMARY KEY,
    blueprint_id TEXT,
    name TEXT NOT NULL,
    category TEXT,
    craft_time_seconds INTEGER,
    tiers INTEGER,
    default_owned INTEGER DEFAULT 0,
    item_stats_json TEXT,
    version TEXT NOT NULL,
    raw_json TEXT NOT NULL,
    imported_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blueprints_name ON blueprints(name);
CREATE INDEX IF NOT EXISTS idx_blueprints_version ON blueprints(version);
CREATE INDEX IF NOT EXISTS idx_blueprints_category ON blueprints(category);

CREATE TABLE IF NOT EXISTS blueprint_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blueprint_ref INTEGER NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
    slot TEXT,
    display_name TEXT,
    quantity_scu REAL
);

CREATE INDEX IF NOT EXISTS idx_ingredients_blueprint_ref ON blueprint_ingredients(blueprint_ref);

CREATE TABLE IF NOT EXISTS ingredient_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ingredient_ref INTEGER NOT NULL REFERENCES blueprint_ingredients(id) ON DELETE CASCADE,
    guid TEXT,
    name TEXT NOT NULL,
    quantity_scu REAL,
    min_quality INTEGER DEFAULT 0,
    unit TEXT,
    loc_key TEXT
);

CREATE INDEX IF NOT EXISTS idx_ingredient_options_name ON ingredient_options(name);
CREATE INDEX IF NOT EXISTS idx_ingredient_options_ingredient_ref ON ingredient_options(ingredient_ref);

CREATE TABLE IF NOT EXISTS quality_effects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ingredient_ref INTEGER NOT NULL REFERENCES blueprint_ingredients(id) ON DELETE CASCADE,
    effect_name TEXT,
    raw_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blueprint_ref INTEGER NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
    name TEXT,
    contractor TEXT,
    mission_type TEXT,
    category TEXT,
    lawful INTEGER,
    not_for_release INTEGER,
    drop_chance TEXT,
    locations TEXT,
    description TEXT,
    time_to_complete_minutes INTEGER,
    raw_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_missions_blueprint_ref ON missions(blueprint_ref);

CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_name TEXT NOT NULL,
    quantity_scu REAL NOT NULL,
    quality INTEGER NOT NULL,
    location TEXT,
    notes TEXT,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_resource_name ON inventory(resource_name);

CREATE TABLE IF NOT EXISTS owned_blueprints (
    blueprint_ref INTEGER PRIMARY KEY REFERENCES blueprints(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS sync_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    status TEXT NOT NULL,
    version TEXT,
    imported_blueprints INTEGER DEFAULT 0,
    last_blueprint_id INTEGER DEFAULT 0,
    message TEXT
);
"""


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def get_connection(db_path: Path = DB_PATH) -> sqlite3.Connection:
    ensure_data_dir()
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    return connection


def init_db(db_path: Path = DB_PATH) -> None:
    with get_connection(db_path) as connection:
        connection.executescript(SCHEMA)


@contextmanager
def db_cursor(db_path: Path = DB_PATH):
    connection = get_connection(db_path)
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()

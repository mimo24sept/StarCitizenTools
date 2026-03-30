from __future__ import annotations

import json
from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

from .db import db_cursor


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def set_metadata(key: str, value: str) -> None:
    with db_cursor() as connection:
        connection.execute(
            """
            INSERT INTO metadata(key, value) VALUES(?, ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value
            """,
            (key, value),
        )


def get_metadata(key: str, default: str | None = None) -> str | None:
    with db_cursor() as connection:
        row = connection.execute("SELECT value FROM metadata WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def upsert_versions(versions: list[dict[str, Any]]) -> None:
    with db_cursor() as connection:
        for item in versions:
            connection.execute(
                """
                INSERT INTO versions(id, version, channel, active, created_at)
                VALUES(?, ?, ?, ?, ?)
                ON CONFLICT(version) DO UPDATE SET
                    id=excluded.id,
                    channel=excluded.channel,
                    active=excluded.active,
                    created_at=excluded.created_at
                """,
                (
                    item.get("id"),
                    item.get("version"),
                    item.get("channel"),
                    item.get("active", 0),
                    item.get("created_at"),
                ),
            )


def get_versions() -> list[dict[str, Any]]:
    with db_cursor() as connection:
        rows = connection.execute(
            """
            SELECT id, version, channel, active, created_at
            FROM versions
            ORDER BY active DESC, CASE channel WHEN 'live' THEN 0 ELSE 1 END, created_at DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def get_default_version() -> str | None:
    versions = get_versions()
    if not versions:
        return None
    live = next((item for item in versions if item["active"] and item["channel"] == "live"), None)
    return (live or versions[0])["version"]


def replace_filter_values(version: str, payload: dict[str, list[str]]) -> None:
    with db_cursor() as connection:
        connection.execute("DELETE FROM filter_values WHERE version = ?", (version,))
        for value_type, values in payload.items():
            for value in values:
                connection.execute(
                    """
                    INSERT OR IGNORE INTO filter_values(value_type, value, version)
                    VALUES(?, ?, ?)
                    """,
                    (value_type, value, version),
                )


def get_filter_values(version: str, value_type: str) -> list[str]:
    with db_cursor() as connection:
        rows = connection.execute(
            """
            SELECT value
            FROM filter_values
            WHERE version = ? AND value_type = ?
            ORDER BY value
            """,
            (version, value_type),
        ).fetchall()
    return [row["value"] for row in rows]


def save_stats(version: str, payload: dict[str, Any]) -> None:
    with db_cursor() as connection:
        connection.execute(
            """
            INSERT INTO stats_snapshot(version, total_blueprints, unique_ingredients, raw_json, fetched_at)
            VALUES(?, ?, ?, ?, ?)
            ON CONFLICT(version) DO UPDATE SET
                total_blueprints=excluded.total_blueprints,
                unique_ingredients=excluded.unique_ingredients,
                raw_json=excluded.raw_json,
                fetched_at=excluded.fetched_at
            """,
            (
                version,
                payload.get("totalBlueprints"),
                payload.get("uniqueIngredients"),
                json.dumps(payload, ensure_ascii=True),
                utc_now(),
            ),
        )


def get_stats(version: str) -> dict[str, Any] | None:
    with db_cursor() as connection:
        row = connection.execute(
            """
            SELECT total_blueprints, unique_ingredients, raw_json, fetched_at
            FROM stats_snapshot
            WHERE version = ?
            """,
            (version,),
        ).fetchone()
    if not row:
        return None
    payload = json.loads(row["raw_json"])
    payload["fetched_at"] = row["fetched_at"]
    return payload


def save_blueprint(version: str, payload: dict[str, Any]) -> None:
    imported_at = utc_now()
    with db_cursor() as connection:
        connection.execute(
            """
            INSERT INTO blueprints(
                id, blueprint_id, name, category, craft_time_seconds, tiers,
                default_owned, item_stats_json, version, raw_json, imported_at
            )
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                blueprint_id=excluded.blueprint_id,
                name=excluded.name,
                category=excluded.category,
                craft_time_seconds=excluded.craft_time_seconds,
                tiers=excluded.tiers,
                default_owned=excluded.default_owned,
                item_stats_json=excluded.item_stats_json,
                version=excluded.version,
                raw_json=excluded.raw_json,
                imported_at=excluded.imported_at
            """,
            (
                payload.get("id"),
                payload.get("blueprint_id"),
                payload.get("name"),
                payload.get("category"),
                payload.get("craft_time_seconds"),
                payload.get("tiers"),
                payload.get("default_owned", 0),
                json.dumps(payload.get("item_stats") or {}, ensure_ascii=True),
                version,
                json.dumps(payload, ensure_ascii=True),
                imported_at,
            ),
        )
        connection.execute("DELETE FROM blueprint_ingredients WHERE blueprint_ref = ?", (payload["id"],))
        connection.execute("DELETE FROM missions WHERE blueprint_ref = ?", (payload["id"],))

        for ingredient in payload.get("ingredients") or []:
            cursor = connection.execute(
                """
                INSERT INTO blueprint_ingredients(blueprint_ref, slot, display_name, quantity_scu)
                VALUES(?, ?, ?, ?)
                """,
                (
                    payload["id"],
                    ingredient.get("slot"),
                    ingredient.get("name"),
                    ingredient.get("quantity_scu"),
                ),
            )
            ingredient_ref = cursor.lastrowid
            for option in ingredient.get("options") or []:
                connection.execute(
                    """
                    INSERT INTO ingredient_options(
                        ingredient_ref, guid, name, quantity_scu, min_quality, unit, loc_key
                    )
                    VALUES(?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        ingredient_ref,
                        option.get("guid"),
                        option.get("name"),
                        option.get("quantity_scu"),
                        option.get("min_quality", 0),
                        option.get("unit"),
                        option.get("loc_key"),
                    ),
                )
            for effect in ingredient.get("quality_effects") or []:
                connection.execute(
                    """
                    INSERT INTO quality_effects(ingredient_ref, effect_name, raw_json)
                    VALUES(?, ?, ?)
                    """,
                    (
                        ingredient_ref,
                        effect.get("name") if isinstance(effect, dict) else None,
                        json.dumps(effect, ensure_ascii=True),
                    ),
                )

        for mission in payload.get("missions") or []:
            connection.execute(
                """
                INSERT INTO missions(
                    blueprint_ref, name, contractor, mission_type, category,
                    lawful, not_for_release, drop_chance, locations, description,
                    time_to_complete_minutes, raw_json
                )
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["id"],
                    mission.get("name"),
                    mission.get("contractor"),
                    mission.get("mission_type"),
                    mission.get("category"),
                    mission.get("lawful"),
                    mission.get("not_for_release"),
                    mission.get("drop_chance"),
                    mission.get("locations"),
                    mission.get("description"),
                    mission.get("time_to_complete_minutes"),
                    json.dumps(mission, ensure_ascii=True),
                ),
            )


def count_blueprints(version: str | None = None) -> int:
    query = "SELECT COUNT(*) AS total FROM blueprints"
    params: tuple[Any, ...] = ()
    if version:
        query += " WHERE version = ?"
        params = (version,)
    with db_cursor() as connection:
        row = connection.execute(query, params).fetchone()
    return int(row["total"]) if row else 0


def search_blueprints(
    *,
    version: str,
    search: str = "",
    category: str = "",
    resource: str = "",
    limit: int = 500,
) -> list[dict[str, Any]]:
    search_value = f"%{search.strip().lower()}%"
    params: list[Any] = [version]
    query = """
        SELECT DISTINCT b.id, b.name, b.category, b.craft_time_seconds, b.tiers, b.version
        FROM blueprints b
        LEFT JOIN blueprint_ingredients bi ON bi.blueprint_ref = b.id
        LEFT JOIN ingredient_options io ON io.ingredient_ref = bi.id
        WHERE b.version = ?
    """
    if search.strip():
        query += " AND (LOWER(b.name) LIKE ? OR LOWER(b.blueprint_id) LIKE ?)"
        params.extend([search_value, search_value])
    if category:
        query += " AND b.category = ?"
        params.append(category)
    if resource:
        query += " AND (bi.display_name = ? OR io.name = ?)"
        params.extend([resource, resource])
    query += " ORDER BY b.name LIMIT ?"
    params.append(limit)

    with db_cursor() as connection:
        rows = connection.execute(query, tuple(params)).fetchall()
    return [dict(row) for row in rows]


def get_blueprint_detail(blueprint_id: int) -> dict[str, Any] | None:
    with db_cursor() as connection:
        row = connection.execute("SELECT raw_json FROM blueprints WHERE id = ?", (blueprint_id,)).fetchone()
    return json.loads(row["raw_json"]) if row else None


def get_categories(version: str) -> list[str]:
    with db_cursor() as connection:
        rows = connection.execute(
            """
            SELECT DISTINCT category
            FROM blueprints
            WHERE version = ? AND category IS NOT NULL AND category <> ''
            ORDER BY category
            """,
            (version,),
        ).fetchall()
    return [row["category"] for row in rows]


def get_known_resources(version: str) -> list[str]:
    values = get_filter_values(version, "resource")
    if values:
        return values
    with db_cursor() as connection:
        rows = connection.execute(
            """
            SELECT DISTINCT name
            FROM ingredient_options
            WHERE name IS NOT NULL AND name <> ''
            ORDER BY name
            """
        ).fetchall()
    return [row["name"] for row in rows]


def list_inventory() -> list[dict[str, Any]]:
    with db_cursor() as connection:
        rows = connection.execute(
            """
            SELECT id, resource_name, quantity_scu, quality, location, notes, updated_at
            FROM inventory
            ORDER BY resource_name, quality DESC, quantity_scu DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def add_inventory(resource_name: str, quantity_scu: float, quality: int, location: str = "", notes: str = "") -> None:
    with db_cursor() as connection:
        connection.execute(
            """
            INSERT INTO inventory(resource_name, quantity_scu, quality, location, notes, updated_at)
            VALUES(?, ?, ?, ?, ?, ?)
            """,
            (resource_name, quantity_scu, quality, location, notes, utc_now()),
        )


def update_inventory(item_id: int, resource_name: str, quantity_scu: float, quality: int, location: str = "", notes: str = "") -> None:
    with db_cursor() as connection:
        connection.execute(
            """
            UPDATE inventory
            SET resource_name = ?, quantity_scu = ?, quality = ?, location = ?, notes = ?, updated_at = ?
            WHERE id = ?
            """,
            (resource_name, quantity_scu, quality, location, notes, utc_now(), item_id),
        )


def delete_inventory(item_id: int) -> None:
    with db_cursor() as connection:
        connection.execute("DELETE FROM inventory WHERE id = ?", (item_id,))


def inventory_summary() -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in list_inventory():
        grouped[row["resource_name"]].append(row)
    return dict(grouped)


def evaluate_blueprint_craftability(blueprint_payload: dict[str, Any], quantity_multiplier: int = 1) -> dict[str, Any]:
    inventory_map = inventory_summary()
    slots: list[dict[str, Any]] = []
    craftable = True
    limiting = 0

    for ingredient in blueprint_payload.get("ingredients") or []:
        options = ingredient.get("options") or []
        chosen = None
        for option in options:
            required_qty = float(option.get("quantity_scu") or ingredient.get("quantity_scu") or 0.0) * quantity_multiplier
            min_quality = int(option.get("min_quality") or 0)
            compatible = [
                entry
                for entry in inventory_map.get(option.get("name", ""), [])
                if float(entry["quantity_scu"]) > 0 and int(entry["quality"]) >= min_quality
            ]
            total_available = sum(float(entry["quantity_scu"]) for entry in compatible)
            if chosen is None or total_available > chosen["available_qty"]:
                chosen = {
                    "slot": ingredient.get("slot"),
                    "name": option.get("name") or ingredient.get("name"),
                    "required_qty": required_qty,
                    "available_qty": total_available,
                    "min_quality": min_quality,
                    "ok": total_available >= required_qty,
                }
        if chosen is None:
            chosen = {
                "slot": ingredient.get("slot"),
                "name": ingredient.get("name"),
                "required_qty": float(ingredient.get("quantity_scu") or 0.0) * quantity_multiplier,
                "available_qty": 0.0,
                "min_quality": 0,
                "ok": False,
            }
        craftable = craftable and chosen["ok"]
        if chosen["required_qty"]:
            possible = int(chosen["available_qty"] // chosen["required_qty"])
            limiting = possible if not slots else min(limiting, possible)
        slots.append(chosen)

    return {
        "craftable": craftable,
        "possible_count": max(limiting, 0) if slots else 0,
        "slots": slots,
    }


def start_sync_run(version: str | None) -> int:
    with db_cursor() as connection:
        cursor = connection.execute(
            """
            INSERT INTO sync_runs(started_at, status, version, imported_blueprints, last_blueprint_id, message)
            VALUES(?, 'running', ?, 0, 0, '')
            """,
            (utc_now(), version),
        )
        return int(cursor.lastrowid)


def update_sync_run(run_id: int, *, status: str, imported_blueprints: int, last_blueprint_id: int, message: str) -> None:
    with db_cursor() as connection:
        connection.execute(
            """
            UPDATE sync_runs
            SET status = ?, imported_blueprints = ?, last_blueprint_id = ?, message = ?,
                ended_at = CASE WHEN ? IN ('done', 'failed') THEN ? ELSE ended_at END
            WHERE id = ?
            """,
            (status, imported_blueprints, last_blueprint_id, message, status, utc_now(), run_id),
        )


def latest_sync_run() -> dict[str, Any] | None:
    with db_cursor() as connection:
        row = connection.execute(
            """
            SELECT id, started_at, ended_at, status, version, imported_blueprints, last_blueprint_id, message
            FROM sync_runs
            ORDER BY id DESC
            LIMIT 1
            """
        ).fetchone()
    return dict(row) if row else None

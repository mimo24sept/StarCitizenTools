from __future__ import annotations

import json
import random
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable

from .config import API_BASE
from .repository import (
    count_blueprints,
    get_default_version,
    get_stats,
    replace_filter_values,
    save_blueprint,
    save_stats,
    set_metadata,
    start_sync_run,
    update_sync_run,
    upsert_versions,
)


LogFn = Callable[[str], None]


class SyncError(RuntimeError):
    pass


@dataclass(slots=True)
class SyncResult:
    version: str
    imported_blueprints: int
    total_blueprints: int | None
    last_blueprint_id: int


class ScCraftImporter:
    def __init__(self, log: LogFn | None = None) -> None:
        self.log = log or (lambda message: None)

    def _fetch_json(self, path: str, params: dict[str, Any] | None = None, timeout: int = 30) -> Any:
        query = ""
        if params:
            query = "?" + urllib.parse.urlencode(params)
        request = urllib.request.Request(
            f"{API_BASE}{path}{query}",
            headers={
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json, text/plain, */*",
            },
        )
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))

    def sync_versions(self) -> list[dict[str, Any]]:
        versions = self._fetch_json("/versions")
        upsert_versions(versions)
        self.log(f"{len(versions)} versions chargees.")
        return versions

    def sync_filter_hints(self, version: str) -> dict[str, list[str]]:
        payload = self._fetch_json("/filter-hints", {"version": version})
        replace_filter_values(version, payload)
        self.log("Filtres de reference mis a jour.")
        return payload

    def sync_stats(self, version: str) -> dict[str, Any]:
        payload = self._fetch_json("/stats", {"version": version})
        save_stats(version, payload)
        self.log(
            f"Stats version {version}: {payload.get('totalBlueprints', 0)} blueprints, "
            f"{payload.get('uniqueIngredients', 0)} ingredients uniques."
        )
        return payload

    def _fetch_blueprint_detail(self, blueprint_id: int, version: str) -> dict[str, Any] | None:
        for attempt in range(4):
            try:
                payload = self._fetch_json(f"/blueprints/{blueprint_id}", {"version": version}, timeout=25)
                if isinstance(payload, dict) and payload.get("id"):
                    return payload
            except urllib.error.HTTPError as error:
                if error.code == 404:
                    return None
                self.log(f"Blueprint {blueprint_id}: HTTP {error.code}, tentative {attempt + 1}/4.")
            except Exception as error:
                self.log(f"Blueprint {blueprint_id}: erreur {error!s}, tentative {attempt + 1}/4.")
            time.sleep(2.0 + attempt * 2.0 + random.uniform(0.0, 1.0))
        return None

    def sync_blueprints(
        self,
        version: str,
        *,
        max_ids_to_scan: int | None = None,
        pause_seconds: float = 2.2,
    ) -> SyncResult:
        stats = get_stats(version) or self.sync_stats(version)
        target_total = int(stats.get("totalBlueprints") or 0) or None
        imported = 0
        last_blueprint_id = 0
        run_id = start_sync_run(version)
        set_metadata("last_sync_version", version)

        max_scan = max_ids_to_scan or max(2500, (target_total or 0) + 500)
        self.log(f"Debut synchronisation blueprints pour {version}.")

        try:
            for blueprint_id in range(1, max_scan + 1):
                payload = self._fetch_blueprint_detail(blueprint_id, version)
                last_blueprint_id = blueprint_id
                if payload:
                    save_blueprint(version, payload)
                    imported += 1
                    update_sync_run(
                        run_id,
                        status="running",
                        imported_blueprints=imported,
                        last_blueprint_id=last_blueprint_id,
                        message=f"Blueprint #{blueprint_id} importe: {payload.get('name', '')}",
                    )
                    self.log(f"[{imported}] {payload.get('name', 'Sans nom')}")
                    if target_total and count_blueprints(version) >= target_total:
                        break
                if blueprint_id % 10 == 0:
                    self.log(f"Scan jusqu'a ID {blueprint_id}...")
                time.sleep(pause_seconds + random.uniform(0.0, 0.8))
        except Exception as error:
            update_sync_run(
                run_id,
                status="failed",
                imported_blueprints=imported,
                last_blueprint_id=last_blueprint_id,
                message=str(error),
            )
            raise

        update_sync_run(
            run_id,
            status="done",
            imported_blueprints=imported,
            last_blueprint_id=last_blueprint_id,
            message="Synchronisation terminee.",
        )
        return SyncResult(
            version=version,
            imported_blueprints=count_blueprints(version),
            total_blueprints=target_total,
            last_blueprint_id=last_blueprint_id,
        )

    def full_sync(self, version: str | None = None, *, max_ids_to_scan: int | None = None) -> SyncResult:
        self.sync_versions()
        chosen_version = version or get_default_version()
        if not chosen_version:
            raise SyncError("Aucune version distante disponible.")
        self.sync_filter_hints(chosen_version)
        self.sync_stats(chosen_version)
        return self.sync_blueprints(chosen_version, max_ids_to_scan=max_ids_to_scan)

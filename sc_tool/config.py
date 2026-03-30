from __future__ import annotations

import sys
from pathlib import Path


APP_NAME = "Star Citizen Craft Tracker"
if getattr(sys, "frozen", False):
    BASE_DIR = Path(sys.executable).resolve().parent
else:
    BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "craft_tracker.db"
API_BASE = "https://sc-craft.tools/api"

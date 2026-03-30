from __future__ import annotations

import os
import sys
from pathlib import Path


def _candidate_roots() -> list[Path]:
    roots: list[Path] = []
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        roots.append(Path(sys._MEIPASS))
    roots.append(Path(sys.executable).resolve().parent)
    roots.append(Path(sys.base_prefix))
    roots.append(Path.home() / "AppData" / "Local" / "Programs" / "Python" / "Python314")
    return [root for root in roots if root.exists()]


def bootstrap_tk_env() -> None:
    if os.environ.get("TCL_LIBRARY") and os.environ.get("TK_LIBRARY"):
        return

    for root in _candidate_roots():
        tcl_dir = root / "tcl" / "tcl8.6"
        tk_dir = root / "tcl" / "tk8.6"
        if (tcl_dir / "init.tcl").exists() and (tk_dir / "tk.tcl").exists():
            os.environ.setdefault("TCL_LIBRARY", str(tcl_dir))
            os.environ.setdefault("TK_LIBRARY", str(tk_dir))
            return

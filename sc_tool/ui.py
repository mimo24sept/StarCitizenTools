from __future__ import annotations

import json
import random
import threading
import tkinter as tk
from tkinter import messagebox, scrolledtext, ttk
from typing import Any

from .config import APP_NAME
from .db import init_db
from .importer import ScCraftImporter, SyncError
from .repository import (
    add_inventory,
    count_blueprints,
    count_owned_blueprints,
    delete_inventory,
    delete_loadout,
    delete_route,
    delete_tracked_resource,
    evaluate_blueprint_craftability,
    get_blueprint_detail,
    get_categories,
    get_default_version,
    get_known_resources,
    get_stats,
    get_versions,
    interpolate_quality_effects,
    latest_sync_run,
    list_inventory,
    list_loadouts,
    list_routes,
    list_tracked_resources,
    owned_blueprint_ids,
    save_loadout,
    save_route,
    save_tracked_resource,
    search_blueprints,
    set_blueprint_owned,
    update_inventory,
)


BG = "#07131d"
SIDEBAR_BG = "#081824"
PANEL = "#0d1d2a"
PANEL_ALT = "#112536"
CARD = "#132b3d"
TEXT = "#edf5ff"
MUTED = "#86a1bb"
ACCENT = "#55d5ff"
ACCENT_ALT = "#f4a261"
SUCCESS = "#7ae582"
WARNING = "#ffd166"
DANGER = "#ff6b6b"

CRAFTING_VISUALS = [
    ("Blueprint Matrix", "Adaptive forge index"),
    ("Industrial Plans", "Pattern archives online"),
    ("Fabrication Deck", "Material quality ready"),
]
TRADE_VISUALS = [
    ("M2 Hercules", "High volume cargo lanes"),
    ("C2 Hercules", "Fast hauls across Stanton"),
    ("Caterpillar", "Modular freight routes"),
    ("Mercury Star Runner", "Rapid trade circuits"),
]
LOADOUT_VISUALS = [
    ("Gladius", "Light combat tuning"),
    ("Arrow", "Interceptor presets"),
    ("Hawk", "Bounty hunter configuration"),
    ("Talon", "Aggressive flight profile"),
]
WIKELO_VISUALS = [
    ("Wikelo Intel", "Rare material tracking"),
    ("Wikelo Network", "Special recipe routes"),
]

TRADE_NODES = {
    "Area18": (120, 150),
    "Lorville": (220, 270),
    "Orison": (360, 170),
    "New Babbage": (470, 95),
    "Everus Harbor": (250, 210),
    "Seraphim Station": (350, 115),
    "Pyro Gateway": (540, 235),
    "Ruin Station": (680, 180),
    "Checkmate": (760, 110),
    "Orbituary": (800, 250),
}

CARGO_SHIPS = ["C2 Hercules", "M2 Hercules", "Caterpillar", "Mercury Star Runner", "Freelancer MAX", "Hull A"]
COMBAT_SHIPS = ["Arrow", "Gladius", "Hawk", "Talon", "Hornet Mk II", "Sabre", "Scorpius"]


def fmt_seconds(value: int | None) -> str:
    if not value:
        return "-"
    minutes, seconds = divmod(int(value), 60)
    if minutes and seconds:
        return f"{minutes}m {seconds}s"
    if minutes:
        return f"{minutes}m"
    return f"{seconds}s"


def to_float(value: str, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def to_int(value: str, fallback: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return fallback


class BaseDialog(tk.Toplevel):
    def __init__(self, master: tk.Misc, title: str) -> None:
        super().__init__(master)
        self.title(title)
        self.transient(master)
        self.grab_set()
        self.resizable(False, False)
        self.result: Any = None
        self.configure(bg=PANEL)


class InventoryDialog(BaseDialog):
    def __init__(self, master: tk.Misc, item: dict[str, Any] | None = None) -> None:
        super().__init__(master, "Materiau")
        self.columnconfigure(1, weight=1)
        pad = {"padx": 10, "pady": 6}

        tk.Label(self, text="Nom", bg=PANEL, fg=TEXT).grid(row=0, column=0, sticky="w", **pad)
        tk.Label(self, text="Quantite (SCU)", bg=PANEL, fg=TEXT).grid(row=1, column=0, sticky="w", **pad)
        tk.Label(self, text="Qualite", bg=PANEL, fg=TEXT).grid(row=2, column=0, sticky="w", **pad)
        tk.Label(self, text="Lieu", bg=PANEL, fg=TEXT).grid(row=3, column=0, sticky="w", **pad)
        tk.Label(self, text="Notes", bg=PANEL, fg=TEXT).grid(row=4, column=0, sticky="w", **pad)

        self.name_var = tk.StringVar(value=(item or {}).get("resource_name", ""))
        self.qty_var = tk.StringVar(value=str((item or {}).get("quantity_scu", "")))
        self.quality_var = tk.StringVar(value=str((item or {}).get("quality", 0)))
        self.location_var = tk.StringVar(value=(item or {}).get("location", ""))
        self.notes_var = tk.StringVar(value=(item or {}).get("notes", ""))

        ttk.Entry(self, textvariable=self.name_var, width=32).grid(row=0, column=1, sticky="ew", **pad)
        ttk.Entry(self, textvariable=self.qty_var, width=18).grid(row=1, column=1, sticky="ew", **pad)
        ttk.Entry(self, textvariable=self.quality_var, width=18).grid(row=2, column=1, sticky="ew", **pad)
        ttk.Entry(self, textvariable=self.location_var, width=32).grid(row=3, column=1, sticky="ew", **pad)
        ttk.Entry(self, textvariable=self.notes_var, width=32).grid(row=4, column=1, sticky="ew", **pad)

        buttons = ttk.Frame(self)
        buttons.grid(row=5, column=0, columnspan=2, sticky="e", padx=10, pady=(8, 10))
        ttk.Button(buttons, text="Annuler", command=self.destroy).pack(side="right", padx=(8, 0))
        ttk.Button(buttons, text="Enregistrer", command=self._save).pack(side="right")

    def _save(self) -> None:
        if not self.name_var.get().strip():
            messagebox.showerror("Champ requis", "Le nom du materiau est obligatoire.")
            return
        try:
            self.result = {
                "resource_name": self.name_var.get().strip(),
                "quantity_scu": float(self.qty_var.get()),
                "quality": int(self.quality_var.get()),
                "location": self.location_var.get().strip(),
                "notes": self.notes_var.get().strip(),
            }
        except ValueError:
            messagebox.showerror("Valeur invalide", "Quantite ou qualite invalide.")
            return
        self.destroy()


class StepDialog(BaseDialog):
    def __init__(self, master: tk.Misc, step: dict[str, Any] | None = None) -> None:
        super().__init__(master, "Etape de route")
        self.columnconfigure(1, weight=1)
        pad = {"padx": 10, "pady": 6}

        tk.Label(self, text="Lieu", bg=PANEL, fg=TEXT).grid(row=0, column=0, sticky="w", **pad)
        tk.Label(self, text="Ressource", bg=PANEL, fg=TEXT).grid(row=1, column=0, sticky="w", **pad)
        tk.Label(self, text="Note", bg=PANEL, fg=TEXT).grid(row=2, column=0, sticky="w", **pad)

        self.location_var = tk.StringVar(value=(step or {}).get("location", ""))
        self.commodity_var = tk.StringVar(value=(step or {}).get("commodity", ""))
        self.note_var = tk.StringVar(value=(step or {}).get("note", ""))

        ttk.Combobox(self, textvariable=self.location_var, values=list(TRADE_NODES.keys()), state="readonly", width=28).grid(row=0, column=1, sticky="ew", **pad)
        ttk.Entry(self, textvariable=self.commodity_var, width=28).grid(row=1, column=1, sticky="ew", **pad)
        ttk.Entry(self, textvariable=self.note_var, width=28).grid(row=2, column=1, sticky="ew", **pad)

        buttons = ttk.Frame(self)
        buttons.grid(row=3, column=0, columnspan=2, sticky="e", padx=10, pady=(8, 10))
        ttk.Button(buttons, text="Annuler", command=self.destroy).pack(side="right", padx=(8, 0))
        ttk.Button(buttons, text="Valider", command=self._save).pack(side="right")

    def _save(self) -> None:
        if not self.location_var.get():
            messagebox.showerror("Champ requis", "Choisis un lieu pour cette etape.")
            return
        self.result = {
            "location": self.location_var.get(),
            "commodity": self.commodity_var.get().strip(),
            "note": self.note_var.get().strip(),
        }
        self.destroy()


class TrackedResourceDialog(BaseDialog):
    def __init__(self, master: tk.Misc, resource_names: list[str], item: dict[str, Any] | None = None) -> None:
        super().__init__(master, "Ressource traquee")
        self.columnconfigure(1, weight=1)
        pad = {"padx": 10, "pady": 6}

        tk.Label(self, text="Nom", bg=PANEL, fg=TEXT).grid(row=0, column=0, sticky="w", **pad)
        tk.Label(self, text="Objectif", bg=PANEL, fg=TEXT).grid(row=1, column=0, sticky="w", **pad)
        tk.Label(self, text="Actuel", bg=PANEL, fg=TEXT).grid(row=2, column=0, sticky="w", **pad)
        tk.Label(self, text="Rareté", bg=PANEL, fg=TEXT).grid(row=3, column=0, sticky="w", **pad)
        tk.Label(self, text="Delta session", bg=PANEL, fg=TEXT).grid(row=4, column=0, sticky="w", **pad)
        tk.Label(self, text="Obtention", bg=PANEL, fg=TEXT).grid(row=5, column=0, sticky="w", **pad)

        self.name_var = tk.StringVar(value=(item or {}).get("name", ""))
        self.target_var = tk.StringVar(value=str((item or {}).get("target_quantity", 0)))
        self.current_var = tk.StringVar(value=str((item or {}).get("current_quantity", 0)))
        self.rarity_var = tk.StringVar(value=(item or {}).get("rarity", "Rare"))
        self.delta_var = tk.StringVar(value=str((item or {}).get("session_delta", 0)))
        self.source_var = tk.StringVar(value=(item or {}).get("source_notes", ""))

        ttk.Combobox(self, textvariable=self.name_var, values=resource_names, width=30).grid(row=0, column=1, sticky="ew", **pad)
        ttk.Entry(self, textvariable=self.target_var, width=20).grid(row=1, column=1, sticky="ew", **pad)
        ttk.Entry(self, textvariable=self.current_var, width=20).grid(row=2, column=1, sticky="ew", **pad)
        ttk.Combobox(self, textvariable=self.rarity_var, values=["Common", "Uncommon", "Rare", "Very Rare"], state="readonly", width=18).grid(row=3, column=1, sticky="ew", **pad)
        ttk.Entry(self, textvariable=self.delta_var, width=20).grid(row=4, column=1, sticky="ew", **pad)
        ttk.Entry(self, textvariable=self.source_var, width=30).grid(row=5, column=1, sticky="ew", **pad)

        buttons = ttk.Frame(self)
        buttons.grid(row=6, column=0, columnspan=2, sticky="e", padx=10, pady=(8, 10))
        ttk.Button(buttons, text="Annuler", command=self.destroy).pack(side="right", padx=(8, 0))
        ttk.Button(buttons, text="Valider", command=self._save).pack(side="right")

    def _save(self) -> None:
        if not self.name_var.get().strip():
            messagebox.showerror("Champ requis", "Choisis une ressource.")
            return
        self.result = {
            "name": self.name_var.get().strip(),
            "target_quantity": to_float(self.target_var.get()),
            "current_quantity": to_float(self.current_var.get()),
            "rarity": self.rarity_var.get().strip(),
            "source_notes": self.source_var.get().strip(),
            "session_delta": to_float(self.delta_var.get()),
        }
        self.destroy()


class ModulePage(tk.Frame):
    def __init__(self, master: tk.Misc, app: "CraftTrackerApp") -> None:
        super().__init__(master, bg=BG)
        self.app = app
        self.hero_title = tk.StringVar()
        self.hero_subtitle = tk.StringVar()

    def build_hero(self) -> tk.Frame:
        frame = tk.Frame(self, bg=CARD, bd=0, highlightthickness=1, highlightbackground="#1f4057")
        frame.pack(fill="x", padx=18, pady=(18, 12))
        tk.Label(frame, textvariable=self.hero_title, bg=CARD, fg=TEXT, font=("Segoe UI", 22, "bold")).pack(anchor="w", padx=18, pady=(16, 2))
        tk.Label(frame, textvariable=self.hero_subtitle, bg=CARD, fg=MUTED, font=("Segoe UI", 10)).pack(anchor="w", padx=18, pady=(0, 16))
        return frame

    def set_visual(self, pair: tuple[str, str]) -> None:
        self.hero_title.set(pair[0])
        self.hero_subtitle.set(pair[1])

    def on_show(self) -> None:
        return


class CraftingPage(ModulePage):
    def __init__(self, master: tk.Misc, app: "CraftTrackerApp") -> None:
        super().__init__(master, app)
        self.search_var = tk.StringVar()
        self.category_var = tk.StringVar()
        self.resource_var = tk.StringVar()
        self.owned_only_var = tk.BooleanVar(value=False)
        self.multiplier_var = tk.StringVar(value="1")
        self.quality_var = tk.IntVar(value=500)
        self.current_blueprint_id: int | None = None
        self.blueprint_rows: dict[str, int] = {}

        self.build_hero()
        self._build_metrics()
        self._build_filters()
        self._build_main()

    def _build_metrics(self) -> None:
        row = tk.Frame(self, bg=BG)
        row.pack(fill="x", padx=18, pady=(0, 10))
        self.total_var = tk.StringVar(value="0")
        self.owned_var = tk.StringVar(value="0")
        self.ingredients_var = tk.StringVar(value="0")
        for title, var, color in [
            ("Blueprints", self.total_var, ACCENT),
            ("Owned", self.owned_var, SUCCESS),
            ("Unique Materials", self.ingredients_var, WARNING),
        ]:
            card = tk.Frame(row, bg=PANEL, highlightthickness=1, highlightbackground="#1f4057")
            card.pack(side="left", fill="x", expand=True, padx=(0, 10))
            tk.Label(card, text=title, bg=PANEL, fg=MUTED, font=("Segoe UI", 10)).pack(anchor="w", padx=14, pady=(12, 4))
            tk.Label(card, textvariable=var, bg=PANEL, fg=color, font=("Segoe UI", 22, "bold")).pack(anchor="w", padx=14, pady=(0, 12))

    def _build_filters(self) -> None:
        bar = tk.Frame(self, bg=BG)
        bar.pack(fill="x", padx=18, pady=(0, 10))
        for text in ("Recherche", "Categorie", "Materiau"):
            tk.Label(bar, text=text, bg=BG, fg=MUTED, font=("Segoe UI", 9)).pack(side="left", padx=(0, 8))
        self.search_entry = ttk.Entry(bar, textvariable=self.search_var, width=26)
        self.search_entry.pack(side="left", padx=(0, 12))
        self.category_combo = ttk.Combobox(bar, textvariable=self.category_var, state="readonly", width=26)
        self.category_combo.pack(side="left", padx=(0, 12))
        self.resource_combo = ttk.Combobox(bar, textvariable=self.resource_var, state="readonly", width=20)
        self.resource_combo.pack(side="left", padx=(0, 12))
        ttk.Checkbutton(bar, text="Owned only", variable=self.owned_only_var, command=self.refresh_blueprints).pack(side="left", padx=(0, 12))
        ttk.Button(bar, text="Apply", command=self.refresh_blueprints).pack(side="left", padx=(0, 8))
        ttk.Button(bar, text="Reset", command=self.reset_filters).pack(side="left")

    def _build_main(self) -> None:
        split = tk.PanedWindow(self, orient="horizontal", sashwidth=8, bg=BG, bd=0)
        split.pack(fill="both", expand=True, padx=18, pady=(0, 18))

        left = tk.Frame(split, bg=BG)
        right = tk.Frame(split, bg=BG)
        split.add(left, minsize=360)
        split.add(right, minsize=640)

        tree_card = tk.Frame(left, bg=PANEL, highlightthickness=1, highlightbackground="#1f4057")
        tree_card.pack(fill="both", expand=True)
        tk.Label(tree_card, text="Blueprint Library", bg=PANEL, fg=TEXT, font=("Segoe UI", 12, "bold")).pack(anchor="w", padx=14, pady=(12, 8))
        self.blueprint_tree = ttk.Treeview(tree_card, columns=("owned", "name", "category"), show="headings")
        self.blueprint_tree.heading("owned", text="Owned")
        self.blueprint_tree.heading("name", text="Blueprint")
        self.blueprint_tree.heading("category", text="Category")
        self.blueprint_tree.column("owned", width=70, anchor="center")
        self.blueprint_tree.column("name", width=220)
        self.blueprint_tree.column("category", width=170)
        self.blueprint_tree.pack(fill="both", expand=True, padx=14, pady=(0, 14))
        self.blueprint_tree.bind("<<TreeviewSelect>>", lambda _event: self.show_selected_blueprint())

        header_card = tk.Frame(right, bg=PANEL, highlightthickness=1, highlightbackground="#1f4057")
        header_card.pack(fill="x", pady=(0, 10))
        self.blueprint_name_var = tk.StringVar(value="Select a blueprint")
        self.blueprint_meta_var = tk.StringVar(value="Quality-aware crafting overview")
        tk.Label(header_card, textvariable=self.blueprint_name_var, bg=PANEL, fg=TEXT, font=("Segoe UI", 18, "bold")).pack(anchor="w", padx=16, pady=(14, 4))
        tk.Label(header_card, textvariable=self.blueprint_meta_var, bg=PANEL, fg=MUTED, font=("Segoe UI", 10)).pack(anchor="w", padx=16, pady=(0, 12))
        actions = tk.Frame(header_card, bg=PANEL)
        actions.pack(fill="x", padx=16, pady=(0, 14))
        self.owned_button = ttk.Button(actions, text="Mark owned", command=self.toggle_owned_current)
        self.owned_button.pack(side="left")
        ttk.Label(actions, text="Craft x", style="Card.TLabel").pack(side="left", padx=(16, 6))
        ttk.Entry(actions, textvariable=self.multiplier_var, width=6).pack(side="left")
        ttk.Label(actions, text="Material quality", style="Card.TLabel").pack(side="left", padx=(16, 8))
        self.quality_scale = ttk.Scale(actions, from_=0, to=1000, variable=self.quality_var, command=lambda _value: self.update_quality_preview())
        self.quality_scale.pack(side="left", fill="x", expand=True, padx=(0, 8))
        self.quality_value = tk.StringVar(value="500")
        tk.Label(actions, textvariable=self.quality_value, bg=PANEL, fg=ACCENT, font=("Segoe UI", 10, "bold")).pack(side="left")

        grid = tk.Frame(right, bg=BG)
        grid.pack(fill="both", expand=True)

        top_row = tk.Frame(grid, bg=BG)
        top_row.pack(fill="both", expand=True, pady=(0, 10))
        bottom_row = tk.Frame(grid, bg=BG)
        bottom_row.pack(fill="both", expand=True)

        self.craft_card = tk.Frame(top_row, bg=PANEL, highlightthickness=1, highlightbackground="#1f4057")
        self.craft_card.pack(side="left", fill="both", expand=True, padx=(0, 10))
        tk.Label(self.craft_card, text="Craft readiness", bg=PANEL, fg=TEXT, font=("Segoe UI", 12, "bold")).pack(anchor="w", padx=14, pady=(12, 8))
        self.craft_summary = tk.StringVar(value="No blueprint selected.")
        tk.Label(self.craft_card, textvariable=self.craft_summary, bg=PANEL, fg=MUTED, justify="left", wraplength=360).pack(anchor="w", padx=14, pady=(0, 12))
        self.ingredients_tree = ttk.Treeview(self.craft_card, columns=("slot", "material", "need", "stock", "minq", "state"), show="headings", height=7)
        for col, label, width in [("slot", "Slot", 90), ("material", "Material", 160), ("need", "Need", 80), ("stock", "Stock", 80), ("minq", "Min Q", 70), ("state", "State", 90)]:
            self.ingredients_tree.heading(col, text=label)
            self.ingredients_tree.column(col, width=width, anchor="center" if col != "material" else "w")
        self.ingredients_tree.pack(fill="both", expand=True, padx=14, pady=(0, 14))

        quality_card = tk.Frame(top_row, bg=PANEL, highlightthickness=1, highlightbackground="#1f4057")
        quality_card.pack(side="left", fill="both", expand=True)
        tk.Label(quality_card, text="Quality modifiers", bg=PANEL, fg=TEXT, font=("Segoe UI", 12, "bold")).pack(anchor="w", padx=14, pady=(12, 8))
        self.quality_hint = tk.StringVar(value="Move the slider to preview modifiers.")
        tk.Label(quality_card, textvariable=self.quality_hint, bg=PANEL, fg=MUTED, justify="left", wraplength=360).pack(anchor="w", padx=14, pady=(0, 12))
        self.effects_tree = ttk.Treeview(quality_card, columns=("slot", "stat", "modifier"), show="headings", height=8)
        self.effects_tree.heading("slot", text="Slot")
        self.effects_tree.heading("stat", text="Stat")
        self.effects_tree.heading("modifier", text="Preview")
        self.effects_tree.column("slot", width=90, anchor="center")
        self.effects_tree.column("stat", width=200)
        self.effects_tree.column("modifier", width=100, anchor="center")
        self.effects_tree.pack(fill="both", expand=True, padx=14, pady=(0, 14))

        sources_card = tk.Frame(bottom_row, bg=PANEL, highlightthickness=1, highlightbackground="#1f4057")
        sources_card.pack(side="left", fill="both", expand=True, padx=(0, 10))
        tk.Label(sources_card, text="Where to find it", bg=PANEL, fg=TEXT, font=("Segoe UI", 12, "bold")).pack(anchor="w", padx=14, pady=(12, 8))
        self.sources_text = scrolledtext.ScrolledText(sources_card, height=12, wrap="word", bg=PANEL_ALT, fg=TEXT, insertbackground=TEXT, relief="flat")
        self.sources_text.pack(fill="both", expand=True, padx=14, pady=(0, 14))

        inventory_card = tk.Frame(bottom_row, bg=PANEL, highlightthickness=1, highlightbackground="#1f4057")
        inventory_card.pack(side="left", fill="both", expand=True)
        tk.Label(inventory_card, text="Material inventory", bg=PANEL, fg=TEXT, font=("Segoe UI", 12, "bold")).pack(anchor="w", padx=14, pady=(12, 8))
        toolbar = tk.Frame(inventory_card, bg=PANEL)
        toolbar.pack(fill="x", padx=14, pady=(0, 8))
        ttk.Button(toolbar, text="Add", command=self.add_inventory_item).pack(side="left")
        ttk.Button(toolbar, text="Edit", command=self.edit_inventory_item).pack(side="left", padx=(8, 0))
        ttk.Button(toolbar, text="Delete", command=self.delete_inventory_item).pack(side="left", padx=(8, 0))
        self.inventory_tree = ttk.Treeview(inventory_card, columns=("name", "qty", "quality", "location"), show="headings", height=9)
        for col, label, width in [("name", "Material", 170), ("qty", "SCU", 80), ("quality", "Q", 60), ("location", "Location", 120)]:
            self.inventory_tree.heading(col, text=label)
            self.inventory_tree.column(col, width=width, anchor="center" if col != "name" and col != "location" else "w")
        self.inventory_tree.pack(fill="both", expand=True, padx=14, pady=(0, 14))

    def on_show(self) -> None:
        self.refresh_filters()
        self.refresh_metrics()
        self.refresh_inventory()
        self.refresh_blueprints()

    def refresh_filters(self) -> None:
        version = self.app.version_var.get()
        self.category_combo["values"] = [""] + get_categories(version)
        self.resource_combo["values"] = [""] + get_known_resources(version)

    def refresh_metrics(self) -> None:
        version = self.app.version_var.get()
        stats = get_stats(version) if version else None
        self.total_var.set(str(count_blueprints(version) if version else 0))
        self.owned_var.set(str(count_owned_blueprints(version) if version else 0))
        self.ingredients_var.set(str(stats.get("uniqueIngredients", 0) if stats else 0))

    def refresh_blueprints(self) -> None:
        version = self.app.version_var.get()
        current_selection = self.current_blueprint_id
        for item in self.blueprint_tree.get_children():
            self.blueprint_tree.delete(item)
        self.blueprint_rows.clear()
        rows = search_blueprints(
            version=version,
            search=self.search_var.get(),
            category=self.category_var.get(),
            resource=self.resource_var.get(),
            owned_only=self.owned_only_var.get(),
            limit=1200,
        ) if version else []
        for row in rows:
            item_id = self.blueprint_tree.insert("", "end", values=("YES" if row.get("owned") else "-", row["name"], row["category"] or "-"))
            self.blueprint_rows[item_id] = row["id"]
            if current_selection and row["id"] == current_selection:
                self.blueprint_tree.selection_set(item_id)
        if not self.blueprint_tree.selection() and self.blueprint_tree.get_children():
            self.blueprint_tree.selection_set(self.blueprint_tree.get_children()[0])
        self.show_selected_blueprint()

    def reset_filters(self) -> None:
        self.search_var.set("")
        self.category_var.set("")
        self.resource_var.set("")
        self.owned_only_var.set(False)
        self.refresh_blueprints()

    def show_selected_blueprint(self) -> None:
        selection = self.blueprint_tree.selection()
        if not selection:
            self.current_blueprint_id = None
            return
        blueprint_id = self.blueprint_rows.get(selection[0])
        if not blueprint_id:
            return
        self.current_blueprint_id = blueprint_id
        payload = get_blueprint_detail(blueprint_id)
        if not payload:
            return

        self.blueprint_name_var.set(payload.get("name", "Unknown blueprint"))
        self.blueprint_meta_var.set(
            f"{payload.get('category', '-')} | {fmt_seconds(payload.get('craft_time_seconds'))} | "
            f"Tiers {payload.get('tiers', '-')}"
        )
        self.owned_button.configure(text="Owned" if payload.get("owned") else "Mark owned")
        self._refresh_craft_preview(payload)
        self.update_quality_preview(payload)
        self._refresh_sources(payload)

    def _refresh_craft_preview(self, payload: dict[str, Any]) -> None:
        multiplier = max(1, to_int(self.multiplier_var.get(), 1))
        craft = evaluate_blueprint_craftability(payload, quantity_multiplier=multiplier)
        self.craft_summary.set(
            f"Craft x{multiplier}: {'READY' if craft['craftable'] else 'MISSING MATERIALS'}\n"
            f"Estimated max crafts from local stock: {craft['possible_count']}"
        )
        for item in self.ingredients_tree.get_children():
            self.ingredients_tree.delete(item)
        for slot in craft["slots"]:
            self.ingredients_tree.insert(
                "",
                "end",
                values=(
                    slot["slot"] or "?",
                    slot["name"],
                    f"{slot['required_qty']:.3f}",
                    f"{slot['available_qty']:.3f}",
                    slot["min_quality"],
                    "OK" if slot["ok"] else "MISS",
                ),
            )

    def update_quality_preview(self, payload: dict[str, Any] | None = None) -> None:
        quality = int(float(self.quality_var.get()))
        self.quality_value.set(str(quality))
        if payload is None and self.current_blueprint_id is not None:
            payload = get_blueprint_detail(self.current_blueprint_id)
        if not payload:
            return
        previews = interpolate_quality_effects(payload, quality)
        for item in self.effects_tree.get_children():
            self.effects_tree.delete(item)
        if not previews:
            self.quality_hint.set("This blueprint has no explicit quality modifier data.")
            return
        self.quality_hint.set(f"Previewing interpolated modifiers at quality {quality}/1000.")
        for preview in previews:
            percent = preview["modifier_percent"]
            label = f"{preview['modifier']:.3f} ({percent:+.1f}%)"
            self.effects_tree.insert("", "end", values=(preview["slot"] or "?", preview["stat"], label))

    def _refresh_sources(self, payload: dict[str, Any]) -> None:
        self.sources_text.configure(state="normal")
        self.sources_text.delete("1.0", "end")
        if payload.get("missions"):
            lines = []
            for mission in payload["missions"][:18]:
                lines.append(
                    f"{mission.get('name', '-')}\n"
                    f"  Contractor: {mission.get('contractor', '-')}\n"
                    f"  Type: {mission.get('mission_type', '-')}\n"
                    f"  Locations: {mission.get('locations', '-')}\n"
                    f"  Drop chance: {mission.get('drop_chance', '-')}\n"
                )
            self.sources_text.insert("1.0", "\n".join(lines))
        else:
            self.sources_text.insert("1.0", "No source mission data available for this blueprint.")
        self.sources_text.configure(state="disabled")

    def toggle_owned_current(self) -> None:
        if self.current_blueprint_id is None:
            return
        payload = get_blueprint_detail(self.current_blueprint_id)
        if not payload:
            return
        set_blueprint_owned(self.current_blueprint_id, not bool(payload.get("owned")))
        self.refresh_metrics()
        self.refresh_blueprints()

    def refresh_inventory(self) -> None:
        for item in self.inventory_tree.get_children():
            self.inventory_tree.delete(item)
        for row in list_inventory():
            self.inventory_tree.insert("", "end", iid=str(row["id"]), values=(row["resource_name"], f"{float(row['quantity_scu']):.3f}", row["quality"], row["location"] or "-"))
        if self.current_blueprint_id:
            payload = get_blueprint_detail(self.current_blueprint_id)
            if payload:
                self._refresh_craft_preview(payload)

    def _selected_inventory_id(self) -> int | None:
        selection = self.inventory_tree.selection()
        return int(selection[0]) if selection else None

    def add_inventory_item(self) -> None:
        dialog = InventoryDialog(self)
        self.wait_window(dialog)
        if dialog.result:
            add_inventory(**dialog.result)
            self.refresh_inventory()

    def edit_inventory_item(self) -> None:
        item_id = self._selected_inventory_id()
        if not item_id:
            messagebox.showinfo("Selection required", "Select an inventory row first.")
            return
        current = next((row for row in list_inventory() if row["id"] == item_id), None)
        if not current:
            return
        dialog = InventoryDialog(self, current)
        self.wait_window(dialog)
        if dialog.result:
            update_inventory(item_id, **dialog.result)
            self.refresh_inventory()

    def delete_inventory_item(self) -> None:
        item_id = self._selected_inventory_id()
        if not item_id:
            messagebox.showinfo("Selection required", "Select an inventory row first.")
            return
        if not messagebox.askyesno("Confirm", "Delete this inventory row?"):
            return
        delete_inventory(item_id)
        self.refresh_inventory()


class TradeRoutesPage(ModulePage):
    def __init__(self, master: tk.Misc, app: "CraftTrackerApp") -> None:
        super().__init__(master, app)
        self.route_id: int | None = None
        self.steps: list[dict[str, Any]] = []
        self.route_name_var = tk.StringVar(value="Main trade loop")
        self.ship_var = tk.StringVar(value=CARGO_SHIPS[0])
        self.cargo_var = tk.StringVar(value="696")
        self.budget_var = tk.StringVar(value="500000")
        self.time_var = tk.StringVar(value="45")
        self.origin_var = tk.StringVar(value="Area18")
        self.destination_var = tk.StringVar(value="Lorville")
        self.overlay_x_var = tk.StringVar(value="32")
        self.overlay_y_var = tk.StringVar(value="32")
        self.overlay_scale_var = tk.StringVar(value="1.0")

        self.build_hero()
        self._build_layout()

    def _build_layout(self) -> None:
        body = tk.Frame(self, bg=BG)
        body.pack(fill="both", expand=True, padx=18, pady=(0, 18))

        left = tk.Frame(body, bg=BG)
        right = tk.Frame(body, bg=BG)
        left.pack(side="left", fill="y")
        right.pack(side="left", fill="both", expand=True, padx=(12, 0))

        form = tk.Frame(left, bg=PANEL, highlightthickness=1, highlightbackground="#1f4057", width=360)
        form.pack(fill="y")
        form.pack_propagate(False)
        tk.Label(form, text="Route builder", bg=PANEL, fg=TEXT, font=("Segoe UI", 12, "bold")).pack(anchor="w", padx=14, pady=(12, 8))
        fields = [
            ("Route name", self.route_name_var),
            ("Ship", self.ship_var),
            ("Cargo capacity", self.cargo_var),
            ("Budget", self.budget_var),
            ("Target minutes", self.time_var),
            ("Origin", self.origin_var),
            ("Destination", self.destination_var),
            ("Overlay X", self.overlay_x_var),
            ("Overlay Y", self.overlay_y_var),
            ("Overlay scale", self.overlay_scale_var),
        ]
        for title, var in fields:
            tk.Label(form, text=title, bg=PANEL, fg=MUTED, font=("Segoe UI", 9)).pack(anchor="w", padx=14, pady=(6, 4))
            if title in {"Ship"}:
                ttk.Combobox(form, textvariable=var, values=CARGO_SHIPS, state="readonly").pack(fill="x", padx=14)
            elif title in {"Origin", "Destination"}:
                ttk.Combobox(form, textvariable=var, values=list(TRADE_NODES.keys()), state="readonly").pack(fill="x", padx=14)
            else:
                ttk.Entry(form, textvariable=var).pack(fill="x", padx=14)

        step_tools = tk.Frame(form, bg=PANEL)
        step_tools.pack(fill="x", padx=14, pady=(12, 8))
        ttk.Button(step_tools, text="Add stop", command=self.add_step).pack(side="left")
        ttk.Button(step_tools, text="Remove stop", command=self.remove_step).pack(side="left", padx=(8, 0))

        self.steps_tree = ttk.Treeview(form, columns=("location", "commodity", "note"), show="headings", height=7)
        self.steps_tree.heading("location", text="Stop")
        self.steps_tree.heading("commodity", text="Cargo")
        self.steps_tree.heading("note", text="Note")
        self.steps_tree.column("location", width=110)
        self.steps_tree.column("commodity", width=120)
        self.steps_tree.column("note", width=110)
        self.steps_tree.pack(fill="x", padx=14, pady=(0, 10))

        action_row = tk.Frame(form, bg=PANEL)
        action_row.pack(fill="x", padx=14, pady=(0, 14))
        ttk.Button(action_row, text="Preview route", command=self.draw_route).pack(side="left")
        ttk.Button(action_row, text="Save route", style="Accent.TButton", command=self.save_route_current).pack(side="left", padx=(8, 0))

        map_card = tk.Frame(right, bg=PANEL, highlightthickness=1, highlightbackground="#1f4057")
        map_card.pack(fill="both", expand=True, pady=(0, 10))
        top = tk.Frame(map_card, bg=PANEL)
        top.pack(fill="x", padx=14, pady=(12, 8))
        tk.Label(top, text="Visual route map", bg=PANEL, fg=TEXT, font=("Segoe UI", 12, "bold")).pack(side="left")
        self.route_hint = tk.StringVar(value="Build a route and visualize the path across your major stops.")
        tk.Label(map_card, textvariable=self.route_hint, bg=PANEL, fg=MUTED, anchor="w").pack(fill="x", padx=14, pady=(0, 8))
        self.map_canvas = tk.Canvas(map_card, bg=PANEL_ALT, highlightthickness=0, height=420)
        self.map_canvas.pack(fill="both", expand=True, padx=14, pady=(0, 14))

        bottom = tk.Frame(right, bg=BG)
        bottom.pack(fill="both", expand=True)
        saved = tk.Frame(bottom, bg=PANEL, highlightthickness=1, highlightbackground="#1f4057")
        saved.pack(side="left", fill="both", expand=True, padx=(0, 10))
        tk.Label(saved, text="Saved routes", bg=PANEL, fg=TEXT, font=("Segoe UI", 12, "bold")).pack(anchor="w", padx=14, pady=(12, 8))
        controls = tk.Frame(saved, bg=PANEL)
        controls.pack(fill="x", padx=14, pady=(0, 8))
        ttk.Button(controls, text="Load", command=self.load_selected_route).pack(side="left")
        ttk.Button(controls, text="Delete", command=self.delete_selected_route).pack(side="left", padx=(8, 0))
        self.routes_tree = ttk.Treeview(saved, columns=("name", "ship", "fromto", "time"), show="headings", height=8)
        for col, label, width in [("name", "Name", 180), ("ship", "Ship", 140), ("fromto", "Leg", 180), ("time", "Min", 70)]:
            self.routes_tree.heading(col, text=label)
            self.routes_tree.column(col, width=width)
        self.routes_tree.pack(fill="both", expand=True, padx=14, pady=(0, 14))
        self.routes_tree.bind("<<TreeviewSelect>>", lambda _event: self.preview_selected_route())

        intel = tk.Frame(bottom, bg=PANEL, highlightthickness=1, highlightbackground="#1f4057")
        intel.pack(side="left", fill="both", expand=True)
        tk.Label(intel, text="Route reading", bg=PANEL, fg=TEXT, font=("Segoe UI", 12, "bold")).pack(anchor="w", padx=14, pady=(12, 8))
        self.route_text = scrolledtext.ScrolledText(intel, height=10, wrap="word", bg=PANEL_ALT, fg=TEXT, insertbackground=TEXT, relief="flat")
        self.route_text.pack(fill="both", expand=True, padx=14, pady=(0, 14))

    def on_show(self) -> None:
        self.refresh_routes()
        self.draw_route()

    def add_step(self) -> None:
        dialog = StepDialog(self)
        self.wait_window(dialog)
        if dialog.result:
            self.steps.append(dialog.result)
            self.refresh_steps()

    def remove_step(self) -> None:
        selection = self.steps_tree.selection()
        if not selection:
            return
        index = self.steps_tree.index(selection[0])
        del self.steps[index]
        self.refresh_steps()

    def refresh_steps(self) -> None:
        for item in self.steps_tree.get_children():
            self.steps_tree.delete(item)
        for step in self.steps:
            self.steps_tree.insert("", "end", values=(step["location"], step["commodity"], step["note"]))
        self.draw_route()

    def draw_route(self, route: dict[str, Any] | None = None) -> None:
        if route is None:
            route = self.current_route_payload()
        self.map_canvas.delete("all")
        self.map_canvas.create_text(20, 20, anchor="nw", fill=MUTED, font=("Segoe UI", 11), text="Stanton / Pyro Route Preview")
        points = route["points"]
        for name, (x, y) in TRADE_NODES.items():
            fill = ACCENT if name in points else "#33576e"
            self.map_canvas.create_oval(x - 8, y - 8, x + 8, y + 8, fill=fill, outline="")
            self.map_canvas.create_text(x, y + 18, text=name, fill=TEXT if name in points else MUTED, font=("Segoe UI", 9))
        for index in range(len(points) - 1):
            x1, y1 = TRADE_NODES[points[index]]
            x2, y2 = TRADE_NODES[points[index + 1]]
            self.map_canvas.create_line(x1, y1, x2, y2, fill=ACCENT_ALT, width=3, smooth=True)
        self.route_hint.set(
            f"{route['origin']} -> {route['destination']} | {route['ship_name']} | "
            f"Cargo {route['cargo_capacity']} | Budget {route['investment_budget']}"
        )
        self.route_text.configure(state="normal")
        self.route_text.delete("1.0", "end")
        self.route_text.insert(
            "1.0",
            f"Ship: {route['ship_name']}\n"
            f"Cargo capacity: {route['cargo_capacity']}\n"
            f"Investment budget: {route['investment_budget']}\n"
            f"Time target: {route['estimated_minutes']} min\n"
            f"Overlay: x={route['overlay_x']} y={route['overlay_y']} scale={route['overlay_scale']}\n\n"
            + "\n".join(
                f"{index + 1}. {step['location']} | {step['commodity'] or 'unspecified cargo'} | {step['note'] or 'no note'}"
                for index, step in enumerate(route["route_steps"])
            ),
        )
        self.route_text.configure(state="disabled")

    def current_route_payload(self) -> dict[str, Any]:
        points = [self.origin_var.get()] + [step["location"] for step in self.steps] + [self.destination_var.get()]
        return {
            "name": self.route_name_var.get().strip() or "Route",
            "ship_name": self.ship_var.get().strip(),
            "cargo_capacity": to_int(self.cargo_var.get(), 0),
            "investment_budget": to_int(self.budget_var.get(), 0),
            "estimated_minutes": to_int(self.time_var.get(), 0),
            "origin": self.origin_var.get().strip(),
            "destination": self.destination_var.get().strip(),
            "route_steps": list(self.steps),
            "overlay_x": to_int(self.overlay_x_var.get(), 32),
            "overlay_y": to_int(self.overlay_y_var.get(), 32),
            "overlay_scale": to_float(self.overlay_scale_var.get(), 1.0),
            "points": [point for point in points if point in TRADE_NODES],
        }

    def save_route_current(self) -> None:
        route = self.current_route_payload()
        route_id = save_route(route_id=self.route_id, **route)
        self.route_id = route_id
        self.refresh_routes()

    def refresh_routes(self) -> None:
        for item in self.routes_tree.get_children():
            self.routes_tree.delete(item)
        for route in list_routes():
            self.routes_tree.insert("", "end", iid=str(route["id"]), values=(route["name"], route["ship_name"], f"{route['origin']} -> {route['destination']}", route["estimated_minutes"]))

    def preview_selected_route(self) -> None:
        selection = self.routes_tree.selection()
        if not selection:
            return
        route = next((item for item in list_routes() if item["id"] == int(selection[0])), None)
        if route:
            route["points"] = [route["origin"]] + [step["location"] for step in route["route_steps"]] + [route["destination"]]
            route["points"] = [point for point in route["points"] if point in TRADE_NODES]
            self.draw_route(route)

    def load_selected_route(self) -> None:
        selection = self.routes_tree.selection()
        if not selection:
            return
        route = next((item for item in list_routes() if item["id"] == int(selection[0])), None)
        if not route:
            return
        self.route_id = route["id"]
        self.route_name_var.set(route["name"])
        self.ship_var.set(route["ship_name"])
        self.cargo_var.set(str(route["cargo_capacity"]))
        self.budget_var.set(str(route["investment_budget"]))
        self.time_var.set(str(route["estimated_minutes"]))
        self.origin_var.set(route["origin"])
        self.destination_var.set(route["destination"])
        self.overlay_x_var.set(str(route["overlay_x"]))
        self.overlay_y_var.set(str(route["overlay_y"]))
        self.overlay_scale_var.set(str(route["overlay_scale"]))
        self.steps = route["route_steps"]
        self.refresh_steps()

    def delete_selected_route(self) -> None:
        selection = self.routes_tree.selection()
        if not selection:
            return
        if not messagebox.askyesno("Confirm", "Delete this saved route?"):
            return
        delete_route(int(selection[0]))
        self.refresh_routes()


class LoadoutsPage(ModulePage):
    SLOT_ORDER = ["Power", "Cooler", "Shield", "Quantum", "Weapons", "Missiles", "Utility"]

    def __init__(self, master: tk.Misc, app: "CraftTrackerApp") -> None:
        super().__init__(master, app)
        self.loadout_id: int | None = None
        self.ship_var = tk.StringVar(value=COMBAT_SHIPS[0])
        self.role_var = tk.StringVar(value="General combat")
        self.notes_var = tk.StringVar(value="")
        self.slot_item_vars = {slot: tk.StringVar() for slot in self.SLOT_ORDER}
        self.slot_source_vars = {slot: tk.StringVar() for slot in self.SLOT_ORDER}

        self.build_hero()
        self._build_layout()

    def _build_layout(self) -> None:
        body = tk.Frame(self, bg=BG)
        body.pack(fill="both", expand=True, padx=18, pady=(0, 18))

        left = tk.Frame(body, bg=PANEL, highlightthickness=1, highlightbackground="#1f4057")
        left.pack(side="left", fill="both", expand=True, padx=(0, 10))
        right = tk.Frame(body, bg=PANEL, highlightthickness=1, highlightbackground="#1f4057")
        right.pack(side="left", fill="both", expand=True)

        tk.Label(left, text="Local loadout planner", bg=PANEL, fg=TEXT, font=("Segoe UI", 12, "bold")).pack(anchor="w", padx=14, pady=(12, 8))
        top = tk.Frame(left, bg=PANEL)
        top.pack(fill="x", padx=14, pady=(0, 10))
        ttk.Combobox(top, textvariable=self.ship_var, values=COMBAT_SHIPS, state="readonly", width=24).pack(side="left")
        ttk.Entry(top, textvariable=self.role_var, width=26).pack(side="left", padx=(10, 0))
        ttk.Button(top, text="Save loadout", style="Accent.TButton", command=self.save_current).pack(side="left", padx=(10, 0))

        grid = tk.Frame(left, bg=PANEL)
        grid.pack(fill="both", expand=True, padx=14, pady=(0, 10))
        for index, slot in enumerate(self.SLOT_ORDER):
            tk.Label(grid, text=slot, bg=PANEL, fg=MUTED, font=("Segoe UI", 9)).grid(row=index, column=0, sticky="w", pady=5)
            ttk.Entry(grid, textvariable=self.slot_item_vars[slot], width=28).grid(row=index, column=1, sticky="ew", padx=(10, 8), pady=5)
            ttk.Entry(grid, textvariable=self.slot_source_vars[slot], width=26).grid(row=index, column=2, sticky="ew", pady=5)
        grid.columnconfigure(1, weight=1)
        grid.columnconfigure(2, weight=1)

        tk.Label(left, text="Source / mission notes", bg=PANEL, fg=MUTED, font=("Segoe UI", 9)).pack(anchor="w", padx=14, pady=(0, 4))
        ttk.Entry(left, textvariable=self.notes_var).pack(fill="x", padx=14, pady=(0, 14))

        tk.Label(right, text="Saved loadouts", bg=PANEL, fg=TEXT, font=("Segoe UI", 12, "bold")).pack(anchor="w", padx=14, pady=(12, 8))
        controls = tk.Frame(right, bg=PANEL)
        controls.pack(fill="x", padx=14, pady=(0, 8))
        ttk.Button(controls, text="Load", command=self.load_selected).pack(side="left")
        ttk.Button(controls, text="Delete", command=self.delete_selected).pack(side="left", padx=(8, 0))
        self.loadouts_tree = ttk.Treeview(right, columns=("ship", "role", "updated"), show="headings", height=10)
        self.loadouts_tree.heading("ship", text="Ship")
        self.loadouts_tree.heading("role", text="Role")
        self.loadouts_tree.heading("updated", text="Updated")
        self.loadouts_tree.column("ship", width=170)
        self.loadouts_tree.column("role", width=190)
        self.loadouts_tree.column("updated", width=180)
        self.loadouts_tree.pack(fill="both", expand=True, padx=14, pady=(0, 10))
        self.loadouts_tree.bind("<<TreeviewSelect>>", lambda _event: self.preview_selected())

        self.preview_text = scrolledtext.ScrolledText(right, height=12, wrap="word", bg=PANEL_ALT, fg=TEXT, insertbackground=TEXT, relief="flat")
        self.preview_text.pack(fill="both", expand=True, padx=14, pady=(0, 14))

    def on_show(self) -> None:
        self.refresh_loadouts()

    def current_payload(self) -> dict[str, Any]:
        return {
            "ship_name": self.ship_var.get().strip(),
            "role": self.role_var.get().strip(),
            "loadout": {
                slot: {"item": self.slot_item_vars[slot].get().strip(), "source": self.slot_source_vars[slot].get().strip()}
                for slot in self.SLOT_ORDER
            },
            "source_notes": self.notes_var.get().strip(),
        }

    def save_current(self) -> None:
        payload = self.current_payload()
        if not payload["ship_name"]:
            messagebox.showerror("Missing ship", "Choose a ship before saving.")
            return
        self.loadout_id = save_loadout(loadout_id=self.loadout_id, **payload)
        self.refresh_loadouts()

    def refresh_loadouts(self) -> None:
        for item in self.loadouts_tree.get_children():
            self.loadouts_tree.delete(item)
        for loadout in list_loadouts():
            self.loadouts_tree.insert("", "end", iid=str(loadout["id"]), values=(loadout["ship_name"], loadout["role"], loadout["updated_at"]))

    def preview_selected(self) -> None:
        selection = self.loadouts_tree.selection()
        if not selection:
            return
        item = next((loadout for loadout in list_loadouts() if loadout["id"] == int(selection[0])), None)
        if not item:
            return
        text = [f"Ship: {item['ship_name']}", f"Role: {item['role']}", ""]
        for slot in self.SLOT_ORDER:
            entry = item["loadout"].get(slot, {})
            text.append(f"{slot}: {entry.get('item', '-')}")
            text.append(f"  Source: {entry.get('source', '-')}")
        if item.get("source_notes"):
            text.extend(["", "Notes:", item["source_notes"]])
        self.preview_text.configure(state="normal")
        self.preview_text.delete("1.0", "end")
        self.preview_text.insert("1.0", "\n".join(text))
        self.preview_text.configure(state="disabled")

    def load_selected(self) -> None:
        selection = self.loadouts_tree.selection()
        if not selection:
            return
        item = next((loadout for loadout in list_loadouts() if loadout["id"] == int(selection[0])), None)
        if not item:
            return
        self.loadout_id = item["id"]
        self.ship_var.set(item["ship_name"])
        self.role_var.set(item["role"])
        self.notes_var.set(item.get("source_notes", ""))
        for slot in self.SLOT_ORDER:
            entry = item["loadout"].get(slot, {})
            self.slot_item_vars[slot].set(entry.get("item", ""))
            self.slot_source_vars[slot].set(entry.get("source", ""))
        self.preview_selected()

    def delete_selected(self) -> None:
        selection = self.loadouts_tree.selection()
        if not selection:
            return
        if not messagebox.askyesno("Confirm", "Delete this loadout?"):
            return
        delete_loadout(int(selection[0]))
        self.refresh_loadouts()


class WikeloPage(ModulePage):
    def __init__(self, master: tk.Misc, app: "CraftTrackerApp") -> None:
        super().__init__(master, app)
        self.resource_id: int | None = None
        self.name_var = tk.StringVar()
        self.target_var = tk.StringVar(value="0")
        self.current_var = tk.StringVar(value="0")
        self.rarity_var = tk.StringVar(value="Rare")
        self.delta_var = tk.StringVar(value="0")
        self.source_var = tk.StringVar()

        self.build_hero()
        self._build_layout()

    def _build_layout(self) -> None:
        body = tk.Frame(self, bg=BG)
        body.pack(fill="both", expand=True, padx=18, pady=(0, 18))

        left = tk.Frame(body, bg=PANEL, highlightthickness=1, highlightbackground="#1f4057")
        left.pack(side="left", fill="both", expand=True, padx=(0, 10))
        right = tk.Frame(body, bg=PANEL, highlightthickness=1, highlightbackground="#1f4057")
        right.pack(side="left", fill="both", expand=True)

        tk.Label(left, text="Rare material tracker", bg=PANEL, fg=TEXT, font=("Segoe UI", 12, "bold")).pack(anchor="w", padx=14, pady=(12, 8))
        form = tk.Frame(left, bg=PANEL)
        form.pack(fill="x", padx=14, pady=(0, 10))
        self.name_combo = ttk.Combobox(form, textvariable=self.name_var, values=[], width=30)
        self.name_combo.grid(row=0, column=0, columnspan=2, sticky="ew", pady=(0, 8))
        ttk.Entry(form, textvariable=self.target_var, width=16).grid(row=1, column=0, sticky="ew", pady=4, padx=(0, 8))
        ttk.Entry(form, textvariable=self.current_var, width=16).grid(row=1, column=1, sticky="ew", pady=4)
        ttk.Combobox(form, textvariable=self.rarity_var, values=["Common", "Uncommon", "Rare", "Very Rare"], state="readonly").grid(row=2, column=0, sticky="ew", pady=4, padx=(0, 8))
        ttk.Entry(form, textvariable=self.delta_var).grid(row=2, column=1, sticky="ew", pady=4)
        ttk.Entry(form, textvariable=self.source_var).grid(row=3, column=0, columnspan=2, sticky="ew", pady=4)
        ttk.Button(form, text="Save tracked resource", style="Accent.TButton", command=self.save_current).grid(row=4, column=0, columnspan=2, sticky="ew", pady=(10, 0))
        form.columnconfigure(0, weight=1)
        form.columnconfigure(1, weight=1)

        self.tracked_tree = ttk.Treeview(left, columns=("name", "rarity", "target", "current", "delta"), show="headings", height=12)
        for col, label, width in [("name", "Resource", 170), ("rarity", "Rarity", 90), ("target", "Target", 80), ("current", "Current", 80), ("delta", "Delta", 80)]:
            self.tracked_tree.heading(col, text=label)
            self.tracked_tree.column(col, width=width)
        self.tracked_tree.pack(fill="both", expand=True, padx=14, pady=(0, 10))
        self.tracked_tree.bind("<<TreeviewSelect>>", lambda _event: self.preview_selected())

        actions = tk.Frame(left, bg=PANEL)
        actions.pack(fill="x", padx=14, pady=(0, 14))
        ttk.Button(actions, text="Load", command=self.load_selected).pack(side="left")
        ttk.Button(actions, text="Delete", command=self.delete_selected).pack(side="left", padx=(8, 0))

        tk.Label(right, text="Acquisition notes", bg=PANEL, fg=TEXT, font=("Segoe UI", 12, "bold")).pack(anchor="w", padx=14, pady=(12, 8))
        self.summary_var = tk.StringVar(value="Select a tracked resource to inspect its progress.")
        tk.Label(right, textvariable=self.summary_var, bg=PANEL, fg=MUTED, justify="left", wraplength=420).pack(anchor="w", padx=14, pady=(0, 10))
        self.notes_text = scrolledtext.ScrolledText(right, wrap="word", bg=PANEL_ALT, fg=TEXT, insertbackground=TEXT, relief="flat")
        self.notes_text.pack(fill="both", expand=True, padx=14, pady=(0, 14))

    def on_show(self) -> None:
        self.name_combo["values"] = get_known_resources(self.app.version_var.get())
        self.refresh_resources()

    def save_current(self) -> None:
        if not self.name_var.get().strip():
            messagebox.showerror("Missing resource", "Choose a resource to track.")
            return
        self.resource_id = save_tracked_resource(
            resource_id=self.resource_id,
            name=self.name_var.get().strip(),
            target_quantity=to_float(self.target_var.get()),
            current_quantity=to_float(self.current_var.get()),
            rarity=self.rarity_var.get().strip(),
            source_notes=self.source_var.get().strip(),
            session_delta=to_float(self.delta_var.get()),
        )
        self.refresh_resources()

    def refresh_resources(self) -> None:
        for item in self.tracked_tree.get_children():
            self.tracked_tree.delete(item)
        for item in list_tracked_resources():
            self.tracked_tree.insert("", "end", iid=str(item["id"]), values=(item["name"], item["rarity"], item["target_quantity"], item["current_quantity"], item["session_delta"]))

    def preview_selected(self) -> None:
        selection = self.tracked_tree.selection()
        if not selection:
            return
        item = next((entry for entry in list_tracked_resources() if entry["id"] == int(selection[0])), None)
        if not item:
            return
        target = float(item["target_quantity"] or 0)
        current = float(item["current_quantity"] or 0)
        percent = 0.0 if target <= 0 else min(100.0, current / target * 100.0)
        self.summary_var.set(
            f"{item['name']} | {item['rarity']} | Progress {percent:.1f}%\n"
            f"Session delta: {item['session_delta']:+.2f} | Updated {item['updated_at']}"
        )
        self.notes_text.configure(state="normal")
        self.notes_text.delete("1.0", "end")
        self.notes_text.insert(
            "1.0",
            f"Target quantity: {item['target_quantity']}\n"
            f"Current quantity: {item['current_quantity']}\n"
            f"Rarity: {item['rarity']}\n\n"
            f"How to obtain / notes:\n{item['source_notes'] or 'No source notes yet.'}",
        )
        self.notes_text.configure(state="disabled")

    def load_selected(self) -> None:
        selection = self.tracked_tree.selection()
        if not selection:
            return
        item = next((entry for entry in list_tracked_resources() if entry["id"] == int(selection[0])), None)
        if not item:
            return
        self.resource_id = item["id"]
        self.name_var.set(item["name"])
        self.target_var.set(str(item["target_quantity"]))
        self.current_var.set(str(item["current_quantity"]))
        self.rarity_var.set(item["rarity"])
        self.delta_var.set(str(item["session_delta"]))
        self.source_var.set(item["source_notes"] or "")
        self.preview_selected()

    def delete_selected(self) -> None:
        selection = self.tracked_tree.selection()
        if not selection:
            return
        if not messagebox.askyesno("Confirm", "Delete this tracked resource?"):
            return
        delete_tracked_resource(int(selection[0]))
        self.refresh_resources()


class CraftTrackerApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        init_db()
        self.title(APP_NAME)
        self.geometry("1600x980")
        self.minsize(1320, 840)
        self.configure(bg=BG)

        self.version_var = tk.StringVar(value=get_default_version() or "")
        self.sync_in_progress = False
        self.active_page = ""
        self.page_buttons: dict[str, tk.Button] = {}

        self._apply_theme()
        self._build_shell()
        self._build_pages()
        self.refresh_versions()
        self.show_page("crafting")

    def _apply_theme(self) -> None:
        style = ttk.Style()
        style.theme_use("clam")
        style.configure(".", background=BG, foreground=TEXT, fieldbackground=PANEL_ALT)
        style.configure("TFrame", background=BG)
        style.configure("TLabel", background=BG, foreground=TEXT)
        style.configure("Card.TFrame", background=PANEL)
        style.configure("Card.TLabel", background=PANEL, foreground=TEXT)
        style.configure("Muted.TLabel", background=PANEL, foreground=MUTED)
        style.configure("TButton", background=PANEL_ALT, foreground=TEXT, borderwidth=0, padding=(12, 8))
        style.map("TButton", background=[("active", CARD)])
        style.configure("Accent.TButton", background=ACCENT, foreground="#00131c", borderwidth=0, padding=(12, 8))
        style.map("Accent.TButton", background=[("active", "#7be2ff")])
        style.configure("TEntry", fieldbackground=PANEL_ALT, foreground=TEXT, insertcolor=TEXT, bordercolor="#24465e")
        style.configure("TCombobox", fieldbackground=PANEL_ALT, foreground=TEXT, bordercolor="#24465e", arrowsize=16)
        style.configure("Treeview", background=PANEL, fieldbackground=PANEL, foreground=TEXT, bordercolor="#24465e", rowheight=28)
        style.configure("Treeview.Heading", background=CARD, foreground=TEXT, relief="flat")
        style.map("Treeview", background=[("selected", "#1c4660")], foreground=[("selected", TEXT)])
        style.configure("Vertical.TScrollbar", background=PANEL_ALT, troughcolor=BG)
        style.configure("TCheckbutton", background=BG, foreground=TEXT)

    def _build_shell(self) -> None:
        self.sidebar = tk.Frame(self, bg=SIDEBAR_BG, width=260)
        self.sidebar.pack(side="left", fill="y")
        self.sidebar.pack_propagate(False)

        tk.Label(self.sidebar, text="mobiGlass", bg=SIDEBAR_BG, fg=TEXT, font=("Segoe UI", 22, "bold")).pack(anchor="w", padx=18, pady=(18, 2))
        tk.Label(self.sidebar, text="Star Citizen Companion", bg=SIDEBAR_BG, fg=MUTED, font=("Segoe UI", 10)).pack(anchor="w", padx=18, pady=(0, 16))

        version_bar = tk.Frame(self.sidebar, bg=SIDEBAR_BG)
        version_bar.pack(fill="x", padx=18, pady=(0, 10))
        tk.Label(version_bar, text="Data Version", bg=SIDEBAR_BG, fg=MUTED, font=("Segoe UI", 9)).pack(anchor="w")
        self.version_combo = ttk.Combobox(version_bar, textvariable=self.version_var, state="readonly")
        self.version_combo.pack(fill="x", pady=(6, 0))
        self.version_combo.bind("<<ComboboxSelected>>", lambda _event: self.on_version_changed())

        self.sync_status = tk.StringVar(value="Local mode ready")
        tk.Label(self.sidebar, textvariable=self.sync_status, bg=SIDEBAR_BG, fg=MUTED, justify="left", wraplength=220).pack(anchor="w", padx=18, pady=(0, 8))
        ttk.Button(self.sidebar, text="Sync crafting data", style="Accent.TButton", command=self.start_sync).pack(fill="x", padx=18, pady=(0, 16))

        for key, label in [
            ("crafting", "Crafting"),
            ("trade", "Trade Routes"),
            ("loadouts", "Loadouts"),
            ("wikelo", "Wikelo"),
        ]:
            button = tk.Button(
                self.sidebar,
                text=label,
                bg=SIDEBAR_BG,
                fg=TEXT,
                activebackground=CARD,
                activeforeground=TEXT,
                relief="flat",
                bd=0,
                anchor="w",
                padx=18,
                pady=18,
                font=("Segoe UI", 11, "bold"),
                command=lambda page=key: self.show_page(page),
            )
            button.pack(fill="x", padx=10, pady=4)
            self.page_buttons[key] = button

        self.footer_info = tk.StringVar(value="")
        tk.Label(self.sidebar, textvariable=self.footer_info, bg=SIDEBAR_BG, fg=MUTED, justify="left", wraplength=220, font=("Segoe UI", 9)).pack(side="bottom", anchor="w", padx=18, pady=18)

        self.content = tk.Frame(self, bg=BG)
        self.content.pack(side="left", fill="both", expand=True)

    def _build_pages(self) -> None:
        self.pages: dict[str, ModulePage] = {
            "crafting": CraftingPage(self.content, self),
            "trade": TradeRoutesPage(self.content, self),
            "loadouts": LoadoutsPage(self.content, self),
            "wikelo": WikeloPage(self.content, self),
        }
        for page in self.pages.values():
            page.place(relx=0, rely=0, relwidth=1, relheight=1)
        self.pages["crafting"].set_visual(random.choice(CRAFTING_VISUALS))
        self.pages["trade"].set_visual(random.choice(TRADE_VISUALS))
        self.pages["loadouts"].set_visual(random.choice(LOADOUT_VISUALS))
        self.pages["wikelo"].set_visual(random.choice(WIKELO_VISUALS))

    def refresh_versions(self) -> None:
        versions = [item["version"] for item in get_versions()]
        self.version_combo["values"] = versions
        if versions and not self.version_var.get():
            self.version_var.set(versions[0])
        self.refresh_status()

    def refresh_status(self) -> None:
        version = self.version_var.get()
        stats = get_stats(version) if version else None
        latest = latest_sync_run()
        total = count_blueprints(version) if version else 0
        owned = count_owned_blueprints(version) if version else 0
        lines = [f"Local blueprints: {total}", f"Owned tracked: {owned}"]
        if stats:
            lines.append(f"Source stats: {stats.get('totalBlueprints', 0)} total / {stats.get('uniqueIngredients', 0)} mats")
        if latest:
            lines.append(f"Last sync: {latest['status']} / {latest['imported_blueprints']} imported")
        self.sync_status.set("\n".join(lines))
        self.footer_info.set(f"Version: {version or '-'}")

    def on_version_changed(self) -> None:
        self.refresh_status()
        for page in self.pages.values():
            page.on_show()

    def show_page(self, page_name: str) -> None:
        self.active_page = page_name
        for key, page in self.pages.items():
            if key == page_name:
                page.lift()
                page.on_show()
            button = self.page_buttons[key]
            button.configure(bg=CARD if key == page_name else SIDEBAR_BG)
        self.refresh_status()

    def start_sync(self) -> None:
        if self.sync_in_progress:
            messagebox.showinfo("Sync", "A synchronization is already running.")
            return
        self.sync_in_progress = True
        self.sync_status.set("Synchronizing crafting data...")
        version = self.version_var.get() or None

        def worker() -> None:
            importer = ScCraftImporter(log=lambda message: self.after(0, self.sync_status.set, message))
            try:
                result = importer.full_sync(version=version)
                self.after(
                    0,
                    lambda: messagebox.showinfo(
                        "Sync complete",
                        f"Version {result.version}\nBlueprints locaux: {result.imported_blueprints}\nLast scanned id: {result.last_blueprint_id}",
                    ),
                )
            except SyncError as error:
                self.after(0, lambda: messagebox.showerror("Sync", str(error)))
            except Exception as error:
                self.after(0, lambda: messagebox.showerror("Sync", f"Erreur: {error!s}"))
            finally:
                def finish() -> None:
                    self.sync_in_progress = False
                    self.refresh_versions()
                    self.on_version_changed()
                self.after(0, finish)

        threading.Thread(target=worker, daemon=True).start()


def main() -> None:
    app = CraftTrackerApp()
    app.mainloop()

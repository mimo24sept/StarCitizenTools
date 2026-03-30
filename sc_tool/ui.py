from __future__ import annotations

import threading
import tkinter as tk
from tkinter import messagebox, ttk
from typing import Any

import customtkinter as ctk

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
    save_loadout,
    save_route,
    save_tracked_resource,
    search_blueprints,
    set_blueprint_owned,
    update_inventory,
)


ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

BG = "#061019"
PANEL = "#0b1722"
PANEL_2 = "#0f2130"
PANEL_3 = "#13283a"
BORDER = "#1f3b4f"
TEXT = "#edf5ff"
MUTED = "#8ba7be"
ACCENT = "#52d3ff"
ACCENT_2 = "#f6a75e"
SUCCESS = "#77e18d"
WARN = "#ffd166"

CRAFTING_VISUALS = [
    ("Blueprint Matrix", "Owned tracking, quality preview, material flow"),
    ("Fabrication Deck", "Readable crafting routes from blueprint to inventory"),
    ("Forge Intel", "High signal crafting view built for fast reading"),
]
TRADE_VISUALS = [
    ("C2 Hercules", "Cargo loops, route map, overlay staging"),
    ("Caterpillar", "Heavy freight planner and custom routes"),
    ("Mercury Star Runner", "Fast route drafting and travel comfort"),
]
LOADOUT_VISUALS = [
    ("Gladius", "Compact fitting planner and source notes"),
    ("Arrow", "Quick combat presets and role snapshots"),
    ("Talon", "Readable loadout notebook for combat ships"),
]
WIKELO_VISUALS = [
    ("Wikelo Intel", "Rare material memory between sessions"),
    ("Rare Resource Tracker", "What to farm, how, and why it matters"),
]

TRADE_NODES = {
    "Area18": (110, 160),
    "Lorville": (240, 290),
    "Orison": (390, 175),
    "New Babbage": (520, 95),
    "Everus Harbor": (270, 215),
    "Seraphim Station": (375, 115),
    "Pyro Gateway": (610, 220),
    "Ruin Station": (735, 175),
    "Checkmate": (845, 110),
    "Orbituary": (880, 255),
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


def style_treeviews() -> None:
    style = ttk.Style()
    style.theme_use("clam")
    style.configure("Treeview", background=PANEL_2, fieldbackground=PANEL_2, foreground=TEXT, rowheight=30, bordercolor=BORDER, relief="flat")
    style.configure("Treeview.Heading", background=PANEL_3, foreground=TEXT, relief="flat")
    style.map("Treeview", background=[("selected", "#16384b")], foreground=[("selected", TEXT)])


class FormDialog(ctk.CTkToplevel):
    def __init__(self, master: tk.Misc, title: str) -> None:
        super().__init__(master)
        self.title(title)
        self.result: Any = None
        self.configure(fg_color=BG)
        self.resizable(False, False)
        self.transient(master)
        self.grab_set()


class InventoryDialog(FormDialog):
    def __init__(self, master: tk.Misc, item: dict[str, Any] | None = None) -> None:
        super().__init__(master, "Inventory Item")
        values = item or {}
        self.entries: dict[str, ctk.CTkEntry] = {}
        frame = ctk.CTkFrame(self, fg_color=PANEL, border_color=BORDER, border_width=1, corner_radius=18)
        frame.pack(fill="both", expand=True, padx=18, pady=18)
        for row, (label, key, default) in enumerate(
            [
                ("Material", "resource_name", values.get("resource_name", "")),
                ("Quantity SCU", "quantity_scu", str(values.get("quantity_scu", ""))),
                ("Quality", "quality", str(values.get("quality", 0))),
                ("Location", "location", values.get("location", "")),
                ("Notes", "notes", values.get("notes", "")),
            ]
        ):
            ctk.CTkLabel(frame, text=label, text_color=MUTED).grid(row=row, column=0, sticky="w", padx=14, pady=(14 if row == 0 else 8, 4))
            entry = ctk.CTkEntry(frame, width=260)
            entry.insert(0, default)
            entry.grid(row=row, column=1, sticky="ew", padx=14, pady=(14 if row == 0 else 8, 4))
            self.entries[key] = entry
        frame.grid_columnconfigure(1, weight=1)
        buttons = ctk.CTkFrame(frame, fg_color="transparent")
        buttons.grid(row=5, column=0, columnspan=2, sticky="e", padx=14, pady=14)
        ctk.CTkButton(buttons, text="Cancel", fg_color=PANEL_3, command=self.destroy).pack(side="right", padx=(8, 0))
        ctk.CTkButton(buttons, text="Save", fg_color=ACCENT, text_color="#001018", command=self._save).pack(side="right")

    def _save(self) -> None:
        try:
            self.result = {
                "resource_name": self.entries["resource_name"].get().strip(),
                "quantity_scu": float(self.entries["quantity_scu"].get()),
                "quality": int(self.entries["quality"].get()),
                "location": self.entries["location"].get().strip(),
                "notes": self.entries["notes"].get().strip(),
            }
        except ValueError:
            messagebox.showerror("Invalid value", "Quantity or quality is invalid.")
            return
        if not self.result["resource_name"]:
            messagebox.showerror("Missing material", "Material name is required.")
            return
        self.destroy()


class StepDialog(FormDialog):
    def __init__(self, master: tk.Misc, step: dict[str, Any] | None = None) -> None:
        super().__init__(master, "Route Stop")
        values = step or {}
        frame = ctk.CTkFrame(self, fg_color=PANEL, border_color=BORDER, border_width=1, corner_radius=18)
        frame.pack(fill="both", expand=True, padx=18, pady=18)
        ctk.CTkLabel(frame, text="Location", text_color=MUTED).grid(row=0, column=0, sticky="w", padx=14, pady=(14, 4))
        ctk.CTkLabel(frame, text="Cargo", text_color=MUTED).grid(row=1, column=0, sticky="w", padx=14, pady=(8, 4))
        ctk.CTkLabel(frame, text="Note", text_color=MUTED).grid(row=2, column=0, sticky="w", padx=14, pady=(8, 4))
        self.location = ctk.CTkComboBox(frame, values=list(TRADE_NODES.keys()), width=260)
        self.location.grid(row=0, column=1, sticky="ew", padx=14, pady=(14, 4))
        if values.get("location"):
            self.location.set(values["location"])
        self.cargo = ctk.CTkEntry(frame, width=260)
        self.cargo.insert(0, values.get("commodity", ""))
        self.cargo.grid(row=1, column=1, sticky="ew", padx=14, pady=(8, 4))
        self.note = ctk.CTkEntry(frame, width=260)
        self.note.insert(0, values.get("note", ""))
        self.note.grid(row=2, column=1, sticky="ew", padx=14, pady=(8, 4))
        frame.grid_columnconfigure(1, weight=1)
        buttons = ctk.CTkFrame(frame, fg_color="transparent")
        buttons.grid(row=3, column=0, columnspan=2, sticky="e", padx=14, pady=14)
        ctk.CTkButton(buttons, text="Cancel", fg_color=PANEL_3, command=self.destroy).pack(side="right", padx=(8, 0))
        ctk.CTkButton(buttons, text="Add stop", fg_color=ACCENT, text_color="#001018", command=self._save).pack(side="right")

    def _save(self) -> None:
        if not self.location.get():
            messagebox.showerror("Missing location", "Choose a route stop.")
            return
        self.result = {
            "location": self.location.get(),
            "commodity": self.cargo.get().strip(),
            "note": self.note.get().strip(),
        }
        self.destroy()


class TrackerDialog(FormDialog):
    def __init__(self, master: tk.Misc, resource_names: list[str], item: dict[str, Any] | None = None) -> None:
        super().__init__(master, "Tracked Resource")
        values = item or {}
        frame = ctk.CTkFrame(self, fg_color=PANEL, border_color=BORDER, border_width=1, corner_radius=18)
        frame.pack(fill="both", expand=True, padx=18, pady=18)
        labels = [
            ("Resource", 0),
            ("Target qty", 1),
            ("Current qty", 2),
            ("Rarity", 3),
            ("Session delta", 4),
            ("How to obtain", 5),
        ]
        for text, row in labels:
            ctk.CTkLabel(frame, text=text, text_color=MUTED).grid(row=row, column=0, sticky="w", padx=14, pady=(14 if row == 0 else 8, 4))
        self.name = ctk.CTkComboBox(frame, values=resource_names, width=260)
        self.name.grid(row=0, column=1, sticky="ew", padx=14, pady=(14, 4))
        self.name.set(values.get("name", resource_names[0] if resource_names else ""))
        self.target = ctk.CTkEntry(frame, width=260)
        self.target.insert(0, str(values.get("target_quantity", 0)))
        self.target.grid(row=1, column=1, sticky="ew", padx=14, pady=(8, 4))
        self.current = ctk.CTkEntry(frame, width=260)
        self.current.insert(0, str(values.get("current_quantity", 0)))
        self.current.grid(row=2, column=1, sticky="ew", padx=14, pady=(8, 4))
        self.rarity = ctk.CTkComboBox(frame, values=["Common", "Uncommon", "Rare", "Very Rare"], width=260)
        self.rarity.set(values.get("rarity", "Rare"))
        self.rarity.grid(row=3, column=1, sticky="ew", padx=14, pady=(8, 4))
        self.delta = ctk.CTkEntry(frame, width=260)
        self.delta.insert(0, str(values.get("session_delta", 0)))
        self.delta.grid(row=4, column=1, sticky="ew", padx=14, pady=(8, 4))
        self.source = ctk.CTkTextbox(frame, width=260, height=120, fg_color=PANEL_2, border_color=BORDER, border_width=1)
        self.source.insert("1.0", values.get("source_notes", ""))
        self.source.grid(row=5, column=1, sticky="ew", padx=14, pady=(8, 4))
        frame.grid_columnconfigure(1, weight=1)
        buttons = ctk.CTkFrame(frame, fg_color="transparent")
        buttons.grid(row=6, column=0, columnspan=2, sticky="e", padx=14, pady=14)
        ctk.CTkButton(buttons, text="Cancel", fg_color=PANEL_3, command=self.destroy).pack(side="right", padx=(8, 0))
        ctk.CTkButton(buttons, text="Save", fg_color=ACCENT, text_color="#001018", command=self._save).pack(side="right")

    def _save(self) -> None:
        if not self.name.get().strip():
            messagebox.showerror("Missing resource", "Choose a resource.")
            return
        self.result = {
            "name": self.name.get().strip(),
            "target_quantity": to_float(self.target.get()),
            "current_quantity": to_float(self.current.get()),
            "rarity": self.rarity.get().strip(),
            "source_notes": self.source.get("1.0", "end").strip(),
            "session_delta": to_float(self.delta.get()),
        }
        self.destroy()


class Page(ctk.CTkScrollableFrame):
    def __init__(self, master: tk.Misc, app: "CraftTrackerApp") -> None:
        super().__init__(master, fg_color=BG, corner_radius=0)
        self.app = app

    def hero(self, title: str, subtitle: str) -> ctk.CTkFrame:
        card = ctk.CTkFrame(self, fg_color=PANEL_3, border_color=BORDER, border_width=1, corner_radius=22, height=156)
        card.pack(fill="x", padx=18, pady=(18, 14))
        card.pack_propagate(False)
        ctk.CTkLabel(card, text=title, text_color=TEXT, font=ctk.CTkFont(size=28, weight="bold")).pack(anchor="w", padx=22, pady=(22, 6))
        ctk.CTkLabel(card, text=subtitle, text_color=MUTED, font=ctk.CTkFont(size=13)).pack(anchor="w", padx=22)
        return card

    def metric_row(self, items: list[tuple[str, str, str]]) -> list[ctk.CTkLabel]:
        row = ctk.CTkFrame(self, fg_color="transparent")
        row.pack(fill="x", padx=18, pady=(0, 14))
        labels: list[ctk.CTkLabel] = []
        for title, value, color in items:
            card = ctk.CTkFrame(row, fg_color=PANEL, border_color=BORDER, border_width=1, corner_radius=18)
            card.pack(side="left", fill="x", expand=True, padx=(0, 12))
            ctk.CTkLabel(card, text=title, text_color=MUTED, font=ctk.CTkFont(size=12)).pack(anchor="w", padx=16, pady=(14, 4))
            label = ctk.CTkLabel(card, text=value, text_color=color, font=ctk.CTkFont(size=28, weight="bold"))
            label.pack(anchor="w", padx=16, pady=(0, 14))
            labels.append(label)
        return labels

    def on_show(self) -> None:
        return


class CraftingPage(Page):
    def __init__(self, master: tk.Misc, app: "CraftTrackerApp") -> None:
        super().__init__(master, app)
        self.search_var = tk.StringVar()
        self.category_var = tk.StringVar()
        self.resource_var = tk.StringVar()
        self.owned_only_var = tk.BooleanVar(value=False)
        self.multiplier_var = tk.StringVar(value="1")
        self.quality_var = tk.DoubleVar(value=500)
        self.current_blueprint_id: int | None = None
        self.blueprint_rows: dict[str, int] = {}

        self.hero(*self.app.visuals["crafting"])
        self.total_metric, self.owned_metric, self.ingredient_metric = self.metric_row(
            [("Blueprints", "0", ACCENT), ("Owned", "0", SUCCESS), ("Unique Materials", "0", WARN)]
        )
        self._build_filters()
        self._build_body()

    def _build_filters(self) -> None:
        bar = ctk.CTkFrame(self, fg_color=PANEL, border_color=BORDER, border_width=1, corner_radius=18)
        bar.pack(fill="x", padx=18, pady=(0, 14))
        ctk.CTkEntry(bar, textvariable=self.search_var, placeholder_text="Search blueprint", width=220).pack(side="left", padx=14, pady=14)
        self.category_combo = ctk.CTkComboBox(bar, values=[""], variable=self.category_var, width=220)
        self.category_combo.pack(side="left", padx=(0, 10), pady=14)
        self.resource_combo = ctk.CTkComboBox(bar, values=[""], variable=self.resource_var, width=180)
        self.resource_combo.pack(side="left", padx=(0, 10), pady=14)
        ctk.CTkSwitch(bar, text="Owned only", variable=self.owned_only_var, progress_color=ACCENT, command=self.refresh_blueprints).pack(side="left", padx=(0, 16), pady=14)
        ctk.CTkButton(bar, text="Apply", fg_color=ACCENT, text_color="#001018", command=self.refresh_blueprints).pack(side="left", padx=(0, 8), pady=14)
        ctk.CTkButton(bar, text="Reset", fg_color=PANEL_3, command=self.reset_filters).pack(side="left", pady=14)

    def _build_body(self) -> None:
        body = ctk.CTkFrame(self, fg_color="transparent")
        body.pack(fill="both", expand=True, padx=18, pady=(0, 18))
        body.grid_columnconfigure(0, weight=0)
        body.grid_columnconfigure(1, weight=1)
        body.grid_rowconfigure(1, weight=1)

        library = ctk.CTkFrame(body, fg_color=PANEL, border_color=BORDER, border_width=1, corner_radius=18)
        library.grid(row=0, column=0, rowspan=2, sticky="nsew", padx=(0, 12))
        library.grid_rowconfigure(1, weight=1)
        ctk.CTkLabel(library, text="Blueprint Library", text_color=TEXT, font=ctk.CTkFont(size=17, weight="bold")).grid(row=0, column=0, sticky="w", padx=18, pady=(16, 10))
        self.blueprint_tree = ttk.Treeview(library, columns=("owned", "name", "category"), show="headings", height=26)
        self.blueprint_tree.heading("owned", text="Owned")
        self.blueprint_tree.heading("name", text="Blueprint")
        self.blueprint_tree.heading("category", text="Category")
        self.blueprint_tree.column("owned", width=70, anchor="center")
        self.blueprint_tree.column("name", width=260)
        self.blueprint_tree.column("category", width=180)
        self.blueprint_tree.grid(row=1, column=0, sticky="nsew", padx=18, pady=(0, 18))
        self.blueprint_tree.bind("<<TreeviewSelect>>", lambda _event: self.show_selected_blueprint())

        summary = ctk.CTkFrame(body, fg_color=PANEL, border_color=BORDER, border_width=1, corner_radius=18)
        summary.grid(row=0, column=1, sticky="ew")
        summary.grid_columnconfigure(0, weight=1)
        self.blueprint_name = ctk.CTkLabel(summary, text="Select a blueprint", text_color=TEXT, font=ctk.CTkFont(size=24, weight="bold"))
        self.blueprint_name.grid(row=0, column=0, sticky="w", padx=18, pady=(18, 4))
        self.blueprint_meta = ctk.CTkLabel(summary, text="Readable crafting overview", text_color=MUTED, font=ctk.CTkFont(size=12))
        self.blueprint_meta.grid(row=1, column=0, sticky="w", padx=18, pady=(0, 12))
        actions = ctk.CTkFrame(summary, fg_color="transparent")
        actions.grid(row=2, column=0, sticky="ew", padx=18, pady=(0, 16))
        self.owned_button = ctk.CTkButton(actions, text="Mark owned", fg_color=ACCENT_2, text_color="#101010", command=self.toggle_owned_current)
        self.owned_button.pack(side="left")
        ctk.CTkLabel(actions, text="Craft x", text_color=MUTED).pack(side="left", padx=(16, 6))
        ctk.CTkEntry(actions, textvariable=self.multiplier_var, width=64).pack(side="left")
        ctk.CTkLabel(actions, text="Material quality", text_color=MUTED).pack(side="left", padx=(16, 8))
        ctk.CTkSlider(actions, from_=0, to=1000, variable=self.quality_var, progress_color=ACCENT, button_color=ACCENT, command=lambda _value: self.update_quality_preview()).pack(side="left", fill="x", expand=True, padx=(0, 8))
        self.quality_value = ctk.CTkLabel(actions, text="500", text_color=ACCENT, font=ctk.CTkFont(size=14, weight="bold"))
        self.quality_value.pack(side="left")

        detail = ctk.CTkFrame(body, fg_color="transparent")
        detail.grid(row=1, column=1, sticky="nsew", pady=(12, 0))
        detail.grid_columnconfigure(0, weight=1)
        detail.grid_columnconfigure(1, weight=1)

        self.craft_card = self._build_text_card(detail, "Craft readiness", 0, 0)
        self.quality_card = self._build_text_card(detail, "Quality modifiers", 0, 1)
        self.sources_card = self._build_text_card(detail, "Where to find it", 1, 0, textbox=True)
        self.inventory_card = self._build_inventory_card(detail, 1, 1)

    def _build_text_card(self, master: tk.Misc, title: str, row: int, column: int, textbox: bool = False):
        card = ctk.CTkFrame(master, fg_color=PANEL, border_color=BORDER, border_width=1, corner_radius=18)
        card.grid(row=row, column=column, sticky="nsew", padx=(0 if column == 0 else 6, 0), pady=(0 if row == 0 else 12, 0))
        card.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(card, text=title, text_color=TEXT, font=ctk.CTkFont(size=17, weight="bold")).grid(row=0, column=0, sticky="w", padx=18, pady=(16, 8))
        if textbox:
            widget = ctk.CTkTextbox(card, height=240, fg_color=PANEL_2, border_color=BORDER, border_width=1)
            widget.grid(row=1, column=0, sticky="nsew", padx=18, pady=(0, 18))
        else:
            widget = ttk.Treeview(card, columns=("a", "b", "c"), show="headings", height=10)
            widget.grid(row=1, column=0, sticky="nsew", padx=18, pady=(0, 18))
        card.grid_rowconfigure(1, weight=1)
        return widget

    def _build_inventory_card(self, master: tk.Misc, row: int, column: int):
        card = ctk.CTkFrame(master, fg_color=PANEL, border_color=BORDER, border_width=1, corner_radius=18)
        card.grid(row=row, column=column, sticky="nsew", padx=(6, 0), pady=(12, 0))
        ctk.CTkLabel(card, text="Material inventory", text_color=TEXT, font=ctk.CTkFont(size=17, weight="bold")).pack(anchor="w", padx=18, pady=(16, 8))
        tools = ctk.CTkFrame(card, fg_color="transparent")
        tools.pack(fill="x", padx=18, pady=(0, 10))
        ctk.CTkButton(tools, text="Add", fg_color=ACCENT, text_color="#001018", command=self.add_inventory_item, width=88).pack(side="left")
        ctk.CTkButton(tools, text="Edit", fg_color=PANEL_3, command=self.edit_inventory_item, width=88).pack(side="left", padx=(8, 0))
        ctk.CTkButton(tools, text="Delete", fg_color=PANEL_3, command=self.delete_inventory_item, width=88).pack(side="left", padx=(8, 0))
        tree = ttk.Treeview(card, columns=("name", "qty", "quality", "location"), show="headings", height=10)
        for col, label, width in [("name", "Material", 190), ("qty", "SCU", 80), ("quality", "Q", 60), ("location", "Location", 130)]:
            tree.heading(col, text=label)
            tree.column(col, width=width, anchor="center" if col != "name" and col != "location" else "w")
        tree.pack(fill="both", expand=True, padx=18, pady=(0, 18))
        return tree

    def on_show(self) -> None:
        self.refresh_metrics()
        self.refresh_filters()
        self.refresh_inventory()
        self.refresh_blueprints()

    def refresh_filters(self) -> None:
        version = self.app.version_var.get()
        self.category_combo.configure(values=[""] + get_categories(version))
        self.resource_combo.configure(values=[""] + get_known_resources(version))
        if not self.category_var.get():
            self.category_combo.set("")
        if not self.resource_var.get():
            self.resource_combo.set("")

    def refresh_metrics(self) -> None:
        version = self.app.version_var.get()
        stats = get_stats(version) if version else None
        self.total_metric.configure(text=str(count_blueprints(version) if version else 0))
        self.owned_metric.configure(text=str(count_owned_blueprints(version) if version else 0))
        self.ingredient_metric.configure(text=str(stats.get("uniqueIngredients", 0) if stats else 0))

    def refresh_blueprints(self) -> None:
        version = self.app.version_var.get()
        current = self.current_blueprint_id
        for item in self.blueprint_tree.get_children():
            self.blueprint_tree.delete(item)
        self.blueprint_rows.clear()
        rows = search_blueprints(
            version=version,
            search=self.search_var.get(),
            category=self.category_combo.get(),
            resource=self.resource_combo.get(),
            owned_only=self.owned_only_var.get(),
            limit=1200,
        ) if version else []
        for row in rows:
            item_id = self.blueprint_tree.insert("", "end", values=("YES" if row.get("owned") else "-", row["name"], row["category"] or "-"))
            self.blueprint_rows[item_id] = row["id"]
            if current == row["id"]:
                self.blueprint_tree.selection_set(item_id)
        if not self.blueprint_tree.selection() and self.blueprint_tree.get_children():
            self.blueprint_tree.selection_set(self.blueprint_tree.get_children()[0])
        self.show_selected_blueprint()

    def reset_filters(self) -> None:
        self.search_var.set("")
        self.category_combo.set("")
        self.resource_combo.set("")
        self.owned_only_var.set(False)
        self.refresh_blueprints()

    def show_selected_blueprint(self) -> None:
        selection = self.blueprint_tree.selection()
        if not selection:
            return
        blueprint_id = self.blueprint_rows.get(selection[0])
        if blueprint_id is None:
            return
        self.current_blueprint_id = blueprint_id
        payload = get_blueprint_detail(blueprint_id)
        if not payload:
            return
        self.blueprint_name.configure(text=payload.get("name", "Unknown blueprint"))
        self.blueprint_meta.configure(text=f"{payload.get('category', '-')} | {fmt_seconds(payload.get('craft_time_seconds'))} | Tiers {payload.get('tiers', '-')}")
        self.owned_button.configure(text="Owned" if payload.get("owned") else "Mark owned")
        self._refresh_craft_preview(payload)
        self.update_quality_preview(payload)
        self._refresh_sources(payload)

    def _refresh_craft_preview(self, payload: dict[str, Any]) -> None:
        multiplier = max(1, to_int(self.multiplier_var.get(), 1))
        craft = evaluate_blueprint_craftability(payload, quantity_multiplier=multiplier)
        tree = self.craft_card
        tree["columns"] = ("slot", "material", "need", "stock", "minq", "state")
        for col, label, width in [("slot", "Slot", 90), ("material", "Material", 180), ("need", "Need", 85), ("stock", "Stock", 85), ("minq", "Min Q", 70), ("state", "State", 80)]:
            tree.heading(col, text=label)
            tree.column(col, width=width, anchor="center" if col != "material" else "w")
        for item in tree.get_children():
            tree.delete(item)
        for slot in craft["slots"]:
            tree.insert("", "end", values=(slot["slot"] or "?", slot["name"], f"{slot['required_qty']:.3f}", f"{slot['available_qty']:.3f}", slot["min_quality"], "READY" if slot["ok"] else "MISS"))

    def update_quality_preview(self, payload: dict[str, Any] | None = None) -> None:
        quality = int(self.quality_var.get())
        self.quality_value.configure(text=str(quality))
        if payload is None and self.current_blueprint_id is not None:
            payload = get_blueprint_detail(self.current_blueprint_id)
        if not payload:
            return
        tree = self.quality_card
        tree["columns"] = ("slot", "stat", "preview")
        for col, label, width in [("slot", "Slot", 80), ("stat", "Stat", 180), ("preview", "Preview", 120)]:
            tree.heading(col, text=label)
            tree.column(col, width=width, anchor="center" if col != "stat" else "w")
        for item in tree.get_children():
            tree.delete(item)
        previews = interpolate_quality_effects(payload, quality)
        if not previews:
            tree.insert("", "end", values=("-", "No explicit quality effect data", "-"))
            return
        for preview in previews:
            tree.insert("", "end", values=(preview["slot"] or "?", preview["stat"], f"{preview['modifier']:.3f} ({preview['modifier_percent']:+.1f}%)"))

    def _refresh_sources(self, payload: dict[str, Any]) -> None:
        box = self.sources_card
        box.delete("1.0", "end")
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
            box.insert("1.0", "\n".join(lines))
        else:
            box.insert("1.0", "No mission source data available for this blueprint.")

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
        for item in self.inventory_card.get_children():
            self.inventory_card.delete(item)
        for row in list_inventory():
            self.inventory_card.insert("", "end", iid=str(row["id"]), values=(row["resource_name"], f"{float(row['quantity_scu']):.3f}", row["quality"], row["location"] or "-"))

    def _selected_inventory_id(self) -> int | None:
        selection = self.inventory_card.selection()
        return int(selection[0]) if selection else None

    def add_inventory_item(self) -> None:
        dialog = InventoryDialog(self)
        self.wait_window(dialog)
        if dialog.result:
            add_inventory(**dialog.result)
            self.refresh_inventory()
            if self.current_blueprint_id:
                self.show_selected_blueprint()

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
            if self.current_blueprint_id:
                self.show_selected_blueprint()

    def delete_inventory_item(self) -> None:
        item_id = self._selected_inventory_id()
        if not item_id:
            messagebox.showinfo("Selection required", "Select an inventory row first.")
            return
        if not messagebox.askyesno("Confirm", "Delete this inventory item?"):
            return
        delete_inventory(item_id)
        self.refresh_inventory()
        if self.current_blueprint_id:
            self.show_selected_blueprint()


class TradeRoutesPage(Page):
    def __init__(self, master: tk.Misc, app: "CraftTrackerApp") -> None:
        super().__init__(master, app)
        self.route_id: int | None = None
        self.steps: list[dict[str, Any]] = []
        self.name_var = tk.StringVar(value="Primary cargo loop")
        self.ship_var = tk.StringVar(value=CARGO_SHIPS[0])
        self.cargo_var = tk.StringVar(value="696")
        self.budget_var = tk.StringVar(value="500000")
        self.time_var = tk.StringVar(value="45")
        self.origin_var = tk.StringVar(value="Area18")
        self.destination_var = tk.StringVar(value="Lorville")
        self.overlay_x_var = tk.StringVar(value="32")
        self.overlay_y_var = tk.StringVar(value="32")
        self.overlay_scale_var = tk.StringVar(value="1.0")

        self.hero(*self.app.visuals["trade"])
        self._build_layout()

    def _build_layout(self) -> None:
        body = ctk.CTkFrame(self, fg_color="transparent")
        body.pack(fill="both", expand=True, padx=18, pady=(0, 18))
        body.grid_columnconfigure(0, weight=0)
        body.grid_columnconfigure(1, weight=1)

        planner = ctk.CTkFrame(body, fg_color=PANEL, border_color=BORDER, border_width=1, corner_radius=18, width=360)
        planner.grid(row=0, column=0, sticky="nsw", padx=(0, 12))
        planner.grid_propagate(False)
        ctk.CTkLabel(planner, text="Route Builder", text_color=TEXT, font=ctk.CTkFont(size=18, weight="bold")).pack(anchor="w", padx=18, pady=(18, 10))
        self._route_field(planner, "Route name", ctk.CTkEntry, self.name_var)
        self._route_field(planner, "Ship", ctk.CTkComboBox, self.ship_var, values=CARGO_SHIPS)
        self._route_field(planner, "Cargo capacity", ctk.CTkEntry, self.cargo_var)
        self._route_field(planner, "Budget", ctk.CTkEntry, self.budget_var)
        self._route_field(planner, "Time target (min)", ctk.CTkEntry, self.time_var)
        self._route_field(planner, "Origin", ctk.CTkComboBox, self.origin_var, values=list(TRADE_NODES.keys()))
        self._route_field(planner, "Destination", ctk.CTkComboBox, self.destination_var, values=list(TRADE_NODES.keys()))
        self._route_field(planner, "Overlay X", ctk.CTkEntry, self.overlay_x_var)
        self._route_field(planner, "Overlay Y", ctk.CTkEntry, self.overlay_y_var)
        self._route_field(planner, "Overlay scale", ctk.CTkEntry, self.overlay_scale_var)

        tool_row = ctk.CTkFrame(planner, fg_color="transparent")
        tool_row.pack(fill="x", padx=18, pady=(10, 10))
        ctk.CTkButton(tool_row, text="Add stop", fg_color=ACCENT, text_color="#001018", command=self.add_step, width=98).pack(side="left")
        ctk.CTkButton(tool_row, text="Remove stop", fg_color=PANEL_3, command=self.remove_step, width=110).pack(side="left", padx=(8, 0))
        self.steps_tree = ttk.Treeview(planner, columns=("location", "commodity", "note"), show="headings", height=7)
        for col, label, width in [("location", "Stop", 110), ("commodity", "Cargo", 120), ("note", "Note", 110)]:
            self.steps_tree.heading(col, text=label)
            self.steps_tree.column(col, width=width)
        self.steps_tree.pack(fill="x", padx=18, pady=(0, 12))
        button_row = ctk.CTkFrame(planner, fg_color="transparent")
        button_row.pack(fill="x", padx=18, pady=(0, 18))
        ctk.CTkButton(button_row, text="Preview route", fg_color=PANEL_3, command=self.draw_route, width=112).pack(side="left")
        ctk.CTkButton(button_row, text="Save route", fg_color=ACCENT_2, text_color="#101010", command=self.save_current, width=112).pack(side="left", padx=(8, 0))

        right = ctk.CTkFrame(body, fg_color="transparent")
        right.grid(row=0, column=1, sticky="nsew")
        right.grid_columnconfigure(0, weight=1)
        right.grid_columnconfigure(1, weight=1)

        map_card = ctk.CTkFrame(right, fg_color=PANEL, border_color=BORDER, border_width=1, corner_radius=18)
        map_card.grid(row=0, column=0, columnspan=2, sticky="ew")
        ctk.CTkLabel(map_card, text="Route map", text_color=TEXT, font=ctk.CTkFont(size=18, weight="bold")).pack(anchor="w", padx=18, pady=(18, 6))
        self.route_hint = ctk.CTkLabel(map_card, text="Build a route to see a clear path between major nodes.", text_color=MUTED)
        self.route_hint.pack(anchor="w", padx=18, pady=(0, 10))
        self.map_canvas = tk.Canvas(map_card, bg=PANEL_2, height=380, highlightthickness=0)
        self.map_canvas.pack(fill="x", padx=18, pady=(0, 18))

        saved_card = ctk.CTkFrame(right, fg_color=PANEL, border_color=BORDER, border_width=1, corner_radius=18)
        saved_card.grid(row=1, column=0, sticky="nsew", padx=(0, 6), pady=(12, 0))
        ctk.CTkLabel(saved_card, text="Saved routes", text_color=TEXT, font=ctk.CTkFont(size=18, weight="bold")).pack(anchor="w", padx=18, pady=(18, 10))
        saved_tools = ctk.CTkFrame(saved_card, fg_color="transparent")
        saved_tools.pack(fill="x", padx=18, pady=(0, 10))
        ctk.CTkButton(saved_tools, text="Load", fg_color=PANEL_3, command=self.load_selected, width=88).pack(side="left")
        ctk.CTkButton(saved_tools, text="Delete", fg_color=PANEL_3, command=self.delete_selected, width=88).pack(side="left", padx=(8, 0))
        self.routes_tree = ttk.Treeview(saved_card, columns=("name", "ship", "leg", "time"), show="headings", height=11)
        for col, label, width in [("name", "Name", 170), ("ship", "Ship", 150), ("leg", "Leg", 190), ("time", "Min", 70)]:
            self.routes_tree.heading(col, text=label)
            self.routes_tree.column(col, width=width)
        self.routes_tree.pack(fill="both", expand=True, padx=18, pady=(0, 18))
        self.routes_tree.bind("<<TreeviewSelect>>", lambda _event: self.preview_selected())

        intel_card = ctk.CTkFrame(right, fg_color=PANEL, border_color=BORDER, border_width=1, corner_radius=18)
        intel_card.grid(row=1, column=1, sticky="nsew", padx=(6, 0), pady=(12, 0))
        ctk.CTkLabel(intel_card, text="Route reading", text_color=TEXT, font=ctk.CTkFont(size=18, weight="bold")).pack(anchor="w", padx=18, pady=(18, 10))
        self.route_text = ctk.CTkTextbox(intel_card, fg_color=PANEL_2, border_color=BORDER, border_width=1)
        self.route_text.pack(fill="both", expand=True, padx=18, pady=(0, 18))

    def _route_field(self, parent: tk.Misc, label: str, widget_type: Any, variable: tk.Variable, values: list[str] | None = None) -> None:
        ctk.CTkLabel(parent, text=label, text_color=MUTED).pack(anchor="w", padx=18, pady=(0, 4))
        if widget_type is ctk.CTkComboBox:
            widget = ctk.CTkComboBox(parent, values=values or [], variable=variable)
        else:
            widget = ctk.CTkEntry(parent, textvariable=variable)
        widget.pack(fill="x", padx=18, pady=(0, 8))

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

    def current_route_payload(self) -> dict[str, Any]:
        points = [self.origin_var.get()] + [step["location"] for step in self.steps] + [self.destination_var.get()]
        return {
            "name": self.name_var.get().strip() or "Route",
            "ship_name": self.ship_var.get().strip(),
            "cargo_capacity": to_int(self.cargo_var.get()),
            "investment_budget": to_int(self.budget_var.get()),
            "estimated_minutes": to_int(self.time_var.get()),
            "origin": self.origin_var.get().strip(),
            "destination": self.destination_var.get().strip(),
            "route_steps": list(self.steps),
            "overlay_x": to_int(self.overlay_x_var.get(), 32),
            "overlay_y": to_int(self.overlay_y_var.get(), 32),
            "overlay_scale": to_float(self.overlay_scale_var.get(), 1.0),
            "points": [point for point in points if point in TRADE_NODES],
        }

    def draw_route(self, route: dict[str, Any] | None = None) -> None:
        route = route or self.current_route_payload()
        self.map_canvas.delete("all")
        for name, (x, y) in TRADE_NODES.items():
            active = name in route["points"]
            self.map_canvas.create_oval(x - 9, y - 9, x + 9, y + 9, fill=ACCENT if active else "#30536a", outline="")
            self.map_canvas.create_text(x, y + 18, text=name, fill=TEXT if active else MUTED, font=("Segoe UI", 9))
        for index in range(len(route["points"]) - 1):
            x1, y1 = TRADE_NODES[route["points"][index]]
            x2, y2 = TRADE_NODES[route["points"][index + 1]]
            self.map_canvas.create_line(x1, y1, x2, y2, fill=ACCENT_2, width=3, smooth=True)
        self.route_hint.configure(text=f"{route['origin']} -> {route['destination']} | {route['ship_name']} | cargo {route['cargo_capacity']} | budget {route['investment_budget']}")
        self.route_text.delete("1.0", "end")
        self.route_text.insert(
            "1.0",
            f"Ship: {route['ship_name']}\n"
            f"Cargo capacity: {route['cargo_capacity']}\n"
            f"Budget: {route['investment_budget']}\n"
            f"Time target: {route['estimated_minutes']} min\n"
            f"Overlay: x={route['overlay_x']} y={route['overlay_y']} scale={route['overlay_scale']}\n\n"
            + "\n".join(f"{idx + 1}. {step['location']} | {step['commodity'] or 'cargo TBD'} | {step['note'] or 'no note'}" for idx, step in enumerate(route["route_steps"])),
        )

    def save_current(self) -> None:
        self.route_id = save_route(route_id=self.route_id, **self.current_route_payload())
        self.refresh_routes()

    def refresh_routes(self) -> None:
        for item in self.routes_tree.get_children():
            self.routes_tree.delete(item)
        for route in list_routes():
            self.routes_tree.insert("", "end", iid=str(route["id"]), values=(route["name"], route["ship_name"], f"{route['origin']} -> {route['destination']}", route["estimated_minutes"]))

    def preview_selected(self) -> None:
        selection = self.routes_tree.selection()
        if not selection:
            return
        route = next((item for item in list_routes() if item["id"] == int(selection[0])), None)
        if route:
            route["points"] = [route["origin"]] + [step["location"] for step in route["route_steps"]] + [route["destination"]]
            route["points"] = [point for point in route["points"] if point in TRADE_NODES]
            self.draw_route(route)

    def load_selected(self) -> None:
        selection = self.routes_tree.selection()
        if not selection:
            return
        route = next((item for item in list_routes() if item["id"] == int(selection[0])), None)
        if not route:
            return
        self.route_id = route["id"]
        self.name_var.set(route["name"])
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

    def delete_selected(self) -> None:
        selection = self.routes_tree.selection()
        if not selection:
            return
        if not messagebox.askyesno("Confirm", "Delete this route?"):
            return
        delete_route(int(selection[0]))
        self.refresh_routes()


class LoadoutsPage(Page):
    SLOT_ORDER = ["Power", "Cooler", "Shield", "Quantum", "Weapons", "Missiles", "Utility"]

    def __init__(self, master: tk.Misc, app: "CraftTrackerApp") -> None:
        super().__init__(master, app)
        self.loadout_id: int | None = None
        self.ship_var = tk.StringVar(value=COMBAT_SHIPS[0])
        self.role_var = tk.StringVar(value="General combat")
        self.notes_var = tk.StringVar(value="")
        self.slot_item_vars = {slot: tk.StringVar() for slot in self.SLOT_ORDER}
        self.slot_source_vars = {slot: tk.StringVar() for slot in self.SLOT_ORDER}

        self.hero(*self.app.visuals["loadouts"])
        self._build_layout()

    def _build_layout(self) -> None:
        body = ctk.CTkFrame(self, fg_color="transparent")
        body.pack(fill="both", expand=True, padx=18, pady=(0, 18))
        body.grid_columnconfigure(0, weight=1)
        body.grid_columnconfigure(1, weight=1)

        editor = ctk.CTkFrame(body, fg_color=PANEL, border_color=BORDER, border_width=1, corner_radius=18)
        editor.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        ctk.CTkLabel(editor, text="Loadout notebook", text_color=TEXT, font=ctk.CTkFont(size=18, weight="bold")).pack(anchor="w", padx=18, pady=(18, 12))
        top = ctk.CTkFrame(editor, fg_color="transparent")
        top.pack(fill="x", padx=18, pady=(0, 12))
        ctk.CTkComboBox(top, values=COMBAT_SHIPS, variable=self.ship_var, width=210).pack(side="left")
        ctk.CTkEntry(top, textvariable=self.role_var, width=220).pack(side="left", padx=(10, 0))
        ctk.CTkButton(top, text="Save loadout", fg_color=ACCENT_2, text_color="#101010", command=self.save_current).pack(side="left", padx=(10, 0))
        grid = ctk.CTkFrame(editor, fg_color="transparent")
        grid.pack(fill="both", expand=True, padx=18, pady=(0, 12))
        for row, slot in enumerate(self.SLOT_ORDER):
            ctk.CTkLabel(grid, text=slot, text_color=MUTED).grid(row=row, column=0, sticky="w", pady=6)
            ctk.CTkEntry(grid, textvariable=self.slot_item_vars[slot], width=220).grid(row=row, column=1, sticky="ew", padx=(10, 8), pady=6)
            ctk.CTkEntry(grid, textvariable=self.slot_source_vars[slot], width=220).grid(row=row, column=2, sticky="ew", pady=6)
        grid.grid_columnconfigure(1, weight=1)
        grid.grid_columnconfigure(2, weight=1)
        ctk.CTkLabel(editor, text="Source notes", text_color=MUTED).pack(anchor="w", padx=18, pady=(0, 4))
        ctk.CTkEntry(editor, textvariable=self.notes_var).pack(fill="x", padx=18, pady=(0, 18))

        saved = ctk.CTkFrame(body, fg_color=PANEL, border_color=BORDER, border_width=1, corner_radius=18)
        saved.grid(row=0, column=1, sticky="nsew")
        ctk.CTkLabel(saved, text="Saved loadouts", text_color=TEXT, font=ctk.CTkFont(size=18, weight="bold")).pack(anchor="w", padx=18, pady=(18, 10))
        controls = ctk.CTkFrame(saved, fg_color="transparent")
        controls.pack(fill="x", padx=18, pady=(0, 10))
        ctk.CTkButton(controls, text="Load", fg_color=PANEL_3, command=self.load_selected, width=88).pack(side="left")
        ctk.CTkButton(controls, text="Delete", fg_color=PANEL_3, command=self.delete_selected, width=88).pack(side="left", padx=(8, 0))
        self.loadouts_tree = ttk.Treeview(saved, columns=("ship", "role", "updated"), show="headings", height=10)
        self.loadouts_tree.heading("ship", text="Ship")
        self.loadouts_tree.heading("role", text="Role")
        self.loadouts_tree.heading("updated", text="Updated")
        self.loadouts_tree.column("ship", width=170)
        self.loadouts_tree.column("role", width=190)
        self.loadouts_tree.column("updated", width=180)
        self.loadouts_tree.pack(fill="both", expand=True, padx=18, pady=(0, 10))
        self.loadouts_tree.bind("<<TreeviewSelect>>", lambda _event: self.preview_selected())
        self.preview_box = ctk.CTkTextbox(saved, fg_color=PANEL_2, border_color=BORDER, border_width=1)
        self.preview_box.pack(fill="both", expand=True, padx=18, pady=(0, 18))

    def on_show(self) -> None:
        self.refresh_loadouts()

    def current_payload(self) -> dict[str, Any]:
        return {
            "ship_name": self.ship_var.get().strip(),
            "role": self.role_var.get().strip(),
            "loadout": {slot: {"item": self.slot_item_vars[slot].get().strip(), "source": self.slot_source_vars[slot].get().strip()} for slot in self.SLOT_ORDER},
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
        for item in list_loadouts():
            self.loadouts_tree.insert("", "end", iid=str(item["id"]), values=(item["ship_name"], item["role"], item["updated_at"]))

    def preview_selected(self) -> None:
        selection = self.loadouts_tree.selection()
        if not selection:
            return
        item = next((row for row in list_loadouts() if row["id"] == int(selection[0])), None)
        if not item:
            return
        lines = [f"Ship: {item['ship_name']}", f"Role: {item['role']}", ""]
        for slot in self.SLOT_ORDER:
            entry = item["loadout"].get(slot, {})
            lines.append(f"{slot}: {entry.get('item', '-')}")
            lines.append(f"  Source: {entry.get('source', '-')}")
        if item.get("source_notes"):
            lines.extend(["", "Notes:", item["source_notes"]])
        self.preview_box.delete("1.0", "end")
        self.preview_box.insert("1.0", "\n".join(lines))

    def load_selected(self) -> None:
        selection = self.loadouts_tree.selection()
        if not selection:
            return
        item = next((row for row in list_loadouts() if row["id"] == int(selection[0])), None)
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


class WikeloPage(Page):
    def __init__(self, master: tk.Misc, app: "CraftTrackerApp") -> None:
        super().__init__(master, app)
        self.resource_id: int | None = None
        self.name_var = tk.StringVar()
        self.target_var = tk.StringVar(value="0")
        self.current_var = tk.StringVar(value="0")
        self.rarity_var = tk.StringVar(value="Rare")
        self.delta_var = tk.StringVar(value="0")
        self.source_var = tk.StringVar()

        self.hero(*self.app.visuals["wikelo"])
        self._build_layout()

    def _build_layout(self) -> None:
        body = ctk.CTkFrame(self, fg_color="transparent")
        body.pack(fill="both", expand=True, padx=18, pady=(0, 18))
        body.grid_columnconfigure(0, weight=1)
        body.grid_columnconfigure(1, weight=1)

        tracker = ctk.CTkFrame(body, fg_color=PANEL, border_color=BORDER, border_width=1, corner_radius=18)
        tracker.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        ctk.CTkLabel(tracker, text="Rare resource tracker", text_color=TEXT, font=ctk.CTkFont(size=18, weight="bold")).pack(anchor="w", padx=18, pady=(18, 10))
        self.name_combo = ctk.CTkComboBox(tracker, values=[], variable=self.name_var)
        self.name_combo.pack(fill="x", padx=18, pady=(0, 8))
        row = ctk.CTkFrame(tracker, fg_color="transparent")
        row.pack(fill="x", padx=18, pady=(0, 8))
        ctk.CTkEntry(row, textvariable=self.target_var, width=150, placeholder_text="Target qty").pack(side="left")
        ctk.CTkEntry(row, textvariable=self.current_var, width=150, placeholder_text="Current qty").pack(side="left", padx=(8, 0))
        row2 = ctk.CTkFrame(tracker, fg_color="transparent")
        row2.pack(fill="x", padx=18, pady=(0, 8))
        ctk.CTkComboBox(row2, values=["Common", "Uncommon", "Rare", "Very Rare"], variable=self.rarity_var, width=150).pack(side="left")
        ctk.CTkEntry(row2, textvariable=self.delta_var, width=150, placeholder_text="Session delta").pack(side="left", padx=(8, 0))
        self.source_box = ctk.CTkTextbox(tracker, height=150, fg_color=PANEL_2, border_color=BORDER, border_width=1)
        self.source_box.pack(fill="x", padx=18, pady=(0, 10))
        ctk.CTkButton(tracker, text="Save tracked resource", fg_color=ACCENT_2, text_color="#101010", command=self.save_current).pack(anchor="w", padx=18, pady=(0, 14))
        self.resources_tree = ttk.Treeview(tracker, columns=("name", "rarity", "target", "current", "delta"), show="headings", height=12)
        for col, label, width in [("name", "Resource", 170), ("rarity", "Rarity", 90), ("target", "Target", 80), ("current", "Current", 80), ("delta", "Delta", 80)]:
            self.resources_tree.heading(col, text=label)
            self.resources_tree.column(col, width=width)
        self.resources_tree.pack(fill="both", expand=True, padx=18, pady=(0, 10))
        self.resources_tree.bind("<<TreeviewSelect>>", lambda _event: self.preview_selected())
        tools = ctk.CTkFrame(tracker, fg_color="transparent")
        tools.pack(fill="x", padx=18, pady=(0, 18))
        ctk.CTkButton(tools, text="Load", fg_color=PANEL_3, command=self.load_selected, width=88).pack(side="left")
        ctk.CTkButton(tools, text="Delete", fg_color=PANEL_3, command=self.delete_selected, width=88).pack(side="left", padx=(8, 0))

        intel = ctk.CTkFrame(body, fg_color=PANEL, border_color=BORDER, border_width=1, corner_radius=18)
        intel.grid(row=0, column=1, sticky="nsew")
        ctk.CTkLabel(intel, text="Acquisition notes", text_color=TEXT, font=ctk.CTkFont(size=18, weight="bold")).pack(anchor="w", padx=18, pady=(18, 10))
        self.summary = ctk.CTkLabel(intel, text="Select a tracked resource to inspect its progress.", text_color=MUTED, justify="left")
        self.summary.pack(anchor="w", padx=18, pady=(0, 10))
        self.notes = ctk.CTkTextbox(intel, fg_color=PANEL_2, border_color=BORDER, border_width=1)
        self.notes.pack(fill="both", expand=True, padx=18, pady=(0, 18))

    def on_show(self) -> None:
        self.name_combo.configure(values=get_known_resources(self.app.version_var.get()))
        self.refresh_resources()

    def save_current(self) -> None:
        if not self.name_combo.get().strip():
            messagebox.showerror("Missing resource", "Choose a resource.")
            return
        self.resource_id = save_tracked_resource(
            resource_id=self.resource_id,
            name=self.name_combo.get().strip(),
            target_quantity=to_float(self.target_var.get()),
            current_quantity=to_float(self.current_var.get()),
            rarity=self.rarity_var.get().strip(),
            source_notes=self.source_box.get("1.0", "end").strip(),
            session_delta=to_float(self.delta_var.get()),
        )
        self.refresh_resources()

    def refresh_resources(self) -> None:
        for item in self.resources_tree.get_children():
            self.resources_tree.delete(item)
        for item in list_tracked_resources():
            self.resources_tree.insert("", "end", iid=str(item["id"]), values=(item["name"], item["rarity"], item["target_quantity"], item["current_quantity"], item["session_delta"]))

    def preview_selected(self) -> None:
        selection = self.resources_tree.selection()
        if not selection:
            return
        item = next((row for row in list_tracked_resources() if row["id"] == int(selection[0])), None)
        if not item:
            return
        target = float(item["target_quantity"] or 0)
        current = float(item["current_quantity"] or 0)
        percent = 0.0 if target <= 0 else min(100.0, current / target * 100.0)
        self.summary.configure(text=f"{item['name']} | {item['rarity']} | Progress {percent:.1f}% | Session delta {item['session_delta']:+.2f}")
        self.notes.delete("1.0", "end")
        self.notes.insert("1.0", f"Target quantity: {item['target_quantity']}\nCurrent quantity: {item['current_quantity']}\nRarity: {item['rarity']}\n\nHow to obtain:\n{item['source_notes'] or 'No notes yet.'}")

    def load_selected(self) -> None:
        selection = self.resources_tree.selection()
        if not selection:
            return
        item = next((row for row in list_tracked_resources() if row["id"] == int(selection[0])), None)
        if not item:
            return
        self.resource_id = item["id"]
        self.name_var.set(item["name"])
        self.target_var.set(str(item["target_quantity"]))
        self.current_var.set(str(item["current_quantity"]))
        self.rarity_var.set(item["rarity"])
        self.delta_var.set(str(item["session_delta"]))
        self.source_box.delete("1.0", "end")
        self.source_box.insert("1.0", item["source_notes"] or "")
        self.preview_selected()

    def delete_selected(self) -> None:
        selection = self.resources_tree.selection()
        if not selection:
            return
        if not messagebox.askyesno("Confirm", "Delete this tracked resource?"):
            return
        delete_tracked_resource(int(selection[0]))
        self.refresh_resources()


class CraftTrackerApp(ctk.CTk):
    def __init__(self) -> None:
        super().__init__()
        init_db()
        style_treeviews()
        self.title(APP_NAME)
        self.geometry("1500x960")
        self.minsize(1280, 800)
        self.configure(fg_color=BG)

        self.version_var = tk.StringVar(value=get_default_version() or "")
        self.sync_in_progress = False
        self.active_page = ""
        self.visuals = {
            "crafting": CRAFTING_VISUALS[0],
            "trade": TRADE_VISUALS[0],
            "loadouts": LOADOUT_VISUALS[0],
            "wikelo": WIKELO_VISUALS[0],
        }
        self.page_buttons: dict[str, ctk.CTkButton] = {}

        self._build_shell()
        self._build_pages()
        self.refresh_versions()
        self.show_page("crafting")

    def _build_shell(self) -> None:
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        sidebar = ctk.CTkFrame(self, width=250, fg_color=PANEL, border_color=BORDER, border_width=1, corner_radius=0)
        sidebar.grid(row=0, column=0, sticky="nsew")
        sidebar.grid_propagate(False)
        ctk.CTkLabel(sidebar, text="mobiGlass", text_color=TEXT, font=ctk.CTkFont(size=28, weight="bold")).pack(anchor="w", padx=20, pady=(22, 4))
        ctk.CTkLabel(sidebar, text="Star Citizen Companion", text_color=MUTED, font=ctk.CTkFont(size=12)).pack(anchor="w", padx=20, pady=(0, 18))
        ctk.CTkLabel(sidebar, text="Data version", text_color=MUTED).pack(anchor="w", padx=20, pady=(0, 6))
        self.version_combo = ctk.CTkComboBox(sidebar, variable=self.version_var, values=[], command=lambda _value: self.on_version_changed(), width=210)
        self.version_combo.pack(anchor="w", padx=20, pady=(0, 8))
        self.sync_label = ctk.CTkLabel(sidebar, text="Local mode ready", text_color=MUTED, justify="left", wraplength=210)
        self.sync_label.pack(anchor="w", padx=20, pady=(0, 8))
        ctk.CTkButton(sidebar, text="Sync crafting data", fg_color=ACCENT, text_color="#001018", command=self.start_sync, width=210).pack(anchor="w", padx=20, pady=(0, 18))

        for key, label in [("crafting", "Crafting"), ("trade", "Trade Routes"), ("loadouts", "Loadouts"), ("wikelo", "Wikelo")]:
            button = ctk.CTkButton(sidebar, text=label, fg_color="transparent", hover_color=PANEL_3, anchor="w", command=lambda page=key: self.show_page(page), width=210, height=48)
            button.pack(anchor="w", padx=20, pady=6)
            self.page_buttons[key] = button

        self.footer_label = ctk.CTkLabel(sidebar, text="", text_color=MUTED, justify="left", wraplength=210)
        self.footer_label.pack(side="bottom", anchor="w", padx=20, pady=20)

        self.content = ctk.CTkFrame(self, fg_color=BG, corner_radius=0)
        self.content.grid(row=0, column=1, sticky="nsew")
        self.content.grid_rowconfigure(0, weight=1)
        self.content.grid_columnconfigure(0, weight=1)

    def _build_pages(self) -> None:
        self.pages = {
            "crafting": CraftingPage(self.content, self),
            "trade": TradeRoutesPage(self.content, self),
            "loadouts": LoadoutsPage(self.content, self),
            "wikelo": WikeloPage(self.content, self),
        }
        for page in self.pages.values():
            page.grid(row=0, column=0, sticky="nsew")

    def refresh_versions(self) -> None:
        versions = [item["version"] for item in get_versions()]
        self.version_combo.configure(values=versions)
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
            lines.append(f"Source stats: {stats.get('totalBlueprints', 0)} / {stats.get('uniqueIngredients', 0)} mats")
        if latest:
            lines.append(f"Last sync: {latest['status']} / {latest['imported_blueprints']}")
        self.sync_label.configure(text="\n".join(lines))
        self.footer_label.configure(text=f"Version: {version or '-'}")

    def on_version_changed(self) -> None:
        self.refresh_status()
        if self.active_page:
            self.pages[self.active_page].on_show()

    def show_page(self, page_name: str) -> None:
        self.active_page = page_name
        self.pages[page_name].tkraise()
        for key, button in self.page_buttons.items():
            button.configure(fg_color=PANEL_3 if key == page_name else "transparent")
        self.pages[page_name].on_show()
        self.refresh_status()

    def start_sync(self) -> None:
        if self.sync_in_progress:
            messagebox.showinfo("Sync", "A synchronization is already running.")
            return
        self.sync_in_progress = True
        self.sync_label.configure(text="Synchronizing crafting data...")
        version = self.version_var.get() or None

        def worker() -> None:
            importer = ScCraftImporter(log=lambda message: self.after(0, lambda msg=message: self.sync_label.configure(text=msg)))
            try:
                result = importer.full_sync(version=version)
                self.after(0, lambda: messagebox.showinfo("Sync complete", f"Version {result.version}\nLocal blueprints: {result.imported_blueprints}\nLast scanned id: {result.last_blueprint_id}"))
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

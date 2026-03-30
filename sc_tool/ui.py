from __future__ import annotations

import json
import threading
import tkinter as tk
from tkinter import messagebox, scrolledtext, ttk

from .config import APP_NAME
from .db import init_db
from .importer import ScCraftImporter, SyncError
from .repository import (
    add_inventory,
    count_blueprints,
    delete_inventory,
    evaluate_blueprint_craftability,
    get_blueprint_detail,
    get_categories,
    get_default_version,
    get_known_resources,
    get_stats,
    get_versions,
    latest_sync_run,
    list_inventory,
    search_blueprints,
    update_inventory,
)


def fmt_seconds(value: int | None) -> str:
    if not value:
        return "-"
    minutes, seconds = divmod(int(value), 60)
    if minutes and seconds:
        return f"{minutes}m {seconds}s"
    if minutes:
        return f"{minutes}m"
    return f"{seconds}s"


class InventoryDialog(tk.Toplevel):
    def __init__(self, master: "CraftTrackerApp", item: dict | None = None) -> None:
        super().__init__(master)
        self.title("Materiau")
        self.resizable(False, False)
        self.transient(master)
        self.grab_set()
        self.item = item
        self.result = None

        pad = {"padx": 10, "pady": 6}
        self.columnconfigure(1, weight=1)

        tk.Label(self, text="Nom").grid(row=0, column=0, sticky="w", **pad)
        tk.Label(self, text="Quantite (SCU)").grid(row=1, column=0, sticky="w", **pad)
        tk.Label(self, text="Qualite").grid(row=2, column=0, sticky="w", **pad)
        tk.Label(self, text="Lieu").grid(row=3, column=0, sticky="w", **pad)
        tk.Label(self, text="Notes").grid(row=4, column=0, sticky="w", **pad)

        self.name_var = tk.StringVar(value=(item or {}).get("resource_name", ""))
        self.qty_var = tk.StringVar(value=str((item or {}).get("quantity_scu", "")))
        self.quality_var = tk.StringVar(value=str((item or {}).get("quality", 0)))
        self.location_var = tk.StringVar(value=(item or {}).get("location", ""))
        self.notes_var = tk.StringVar(value=(item or {}).get("notes", ""))

        ttk.Entry(self, textvariable=self.name_var, width=35).grid(row=0, column=1, sticky="ew", **pad)
        ttk.Entry(self, textvariable=self.qty_var, width=18).grid(row=1, column=1, sticky="ew", **pad)
        ttk.Entry(self, textvariable=self.quality_var, width=18).grid(row=2, column=1, sticky="ew", **pad)
        ttk.Entry(self, textvariable=self.location_var, width=35).grid(row=3, column=1, sticky="ew", **pad)
        ttk.Entry(self, textvariable=self.notes_var, width=35).grid(row=4, column=1, sticky="ew", **pad)

        buttons = ttk.Frame(self)
        buttons.grid(row=5, column=0, columnspan=2, sticky="e", padx=10, pady=(8, 10))
        ttk.Button(buttons, text="Annuler", command=self.destroy).pack(side="right", padx=(8, 0))
        ttk.Button(buttons, text="Enregistrer", command=self._save).pack(side="right")

    def _save(self) -> None:
        try:
            quantity = float(self.qty_var.get())
            quality = int(self.quality_var.get())
        except ValueError:
            messagebox.showerror("Valeur invalide", "Quantite ou qualite invalide.")
            return
        if not self.name_var.get().strip():
            messagebox.showerror("Champ requis", "Le nom du materiau est obligatoire.")
            return
        self.result = {
            "resource_name": self.name_var.get().strip(),
            "quantity_scu": quantity,
            "quality": quality,
            "location": self.location_var.get().strip(),
            "notes": self.notes_var.get().strip(),
        }
        self.destroy()


class CraftTrackerApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        init_db()

        self.title(APP_NAME)
        self.geometry("1400x860")
        self.minsize(1180, 760)

        self.search_var = tk.StringVar()
        self.category_var = tk.StringVar()
        self.resource_var = tk.StringVar()
        self.version_var = tk.StringVar()
        self.multiplier_var = tk.StringVar(value="1")

        self.blueprint_rows: dict[str, int] = {}
        self.sync_in_progress = False

        self._build_ui()
        self.refresh_versions()
        self.refresh_inventory()
        self.refresh_blueprints()
        self.refresh_sync_tab()

    def _build_ui(self) -> None:
        root = ttk.Notebook(self)
        root.pack(fill="both", expand=True)

        self.blueprints_tab = ttk.Frame(root, padding=10)
        self.inventory_tab = ttk.Frame(root, padding=10)
        self.sync_tab = ttk.Frame(root, padding=10)
        root.add(self.blueprints_tab, text="Blueprints")
        root.add(self.inventory_tab, text="Inventaire")
        root.add(self.sync_tab, text="Synchronisation")

        self._build_blueprints_tab()
        self._build_inventory_tab()
        self._build_sync_tab()

    def _build_blueprints_tab(self) -> None:
        filters = ttk.Frame(self.blueprints_tab)
        filters.pack(fill="x")

        ttk.Label(filters, text="Version").grid(row=0, column=0, sticky="w", padx=(0, 6), pady=4)
        self.version_combo = ttk.Combobox(filters, textvariable=self.version_var, state="readonly", width=28)
        self.version_combo.grid(row=0, column=1, sticky="w", padx=(0, 12), pady=4)
        self.version_combo.bind("<<ComboboxSelected>>", lambda _event: self.on_version_changed())

        ttk.Label(filters, text="Recherche").grid(row=0, column=2, sticky="w", padx=(0, 6), pady=4)
        ttk.Entry(filters, textvariable=self.search_var, width=26).grid(row=0, column=3, sticky="w", padx=(0, 12), pady=4)

        ttk.Label(filters, text="Categorie").grid(row=0, column=4, sticky="w", padx=(0, 6), pady=4)
        self.category_combo = ttk.Combobox(filters, textvariable=self.category_var, state="readonly", width=28)
        self.category_combo.grid(row=0, column=5, sticky="w", padx=(0, 12), pady=4)

        ttk.Label(filters, text="Materiau").grid(row=0, column=6, sticky="w", padx=(0, 6), pady=4)
        self.resource_combo = ttk.Combobox(filters, textvariable=self.resource_var, state="readonly", width=24)
        self.resource_combo.grid(row=0, column=7, sticky="w", padx=(0, 12), pady=4)

        ttk.Button(filters, text="Filtrer", command=self.refresh_blueprints).grid(row=0, column=8, padx=(0, 8), pady=4)
        ttk.Button(filters, text="Reset", command=self.reset_filters).grid(row=0, column=9, padx=(0, 8), pady=4)
        ttk.Button(filters, text="Synchroniser", command=self.start_sync).grid(row=0, column=10, padx=(0, 8), pady=4)

        ttk.Separator(self.blueprints_tab).pack(fill="x", pady=8)

        content = ttk.Panedwindow(self.blueprints_tab, orient="horizontal")
        content.pack(fill="both", expand=True)

        left = ttk.Frame(content)
        right = ttk.Frame(content)
        content.add(left, weight=2)
        content.add(right, weight=3)

        self.blueprint_tree = ttk.Treeview(
            left,
            columns=("name", "category", "time", "tiers"),
            show="headings",
            selectmode="browse",
        )
        self.blueprint_tree.heading("name", text="Blueprint")
        self.blueprint_tree.heading("category", text="Categorie")
        self.blueprint_tree.heading("time", text="Temps")
        self.blueprint_tree.heading("tiers", text="Tiers")
        self.blueprint_tree.column("name", width=260)
        self.blueprint_tree.column("category", width=180)
        self.blueprint_tree.column("time", width=80, anchor="center")
        self.blueprint_tree.column("tiers", width=60, anchor="center")
        self.blueprint_tree.pack(side="left", fill="both", expand=True)
        self.blueprint_tree.bind("<<TreeviewSelect>>", lambda _event: self.show_selected_blueprint())

        scrollbar = ttk.Scrollbar(left, orient="vertical", command=self.blueprint_tree.yview)
        scrollbar.pack(side="right", fill="y")
        self.blueprint_tree.configure(yscrollcommand=scrollbar.set)

        summary = ttk.LabelFrame(right, text="Resume", padding=10)
        summary.pack(fill="x", pady=(0, 8))

        self.summary_var = tk.StringVar(value="Aucun blueprint charge.")
        ttk.Label(summary, textvariable=self.summary_var, justify="left").pack(anchor="w")

        planner = ttk.Frame(summary)
        planner.pack(fill="x", pady=(8, 0))
        ttk.Label(planner, text="Quantite de craft").pack(side="left")
        ttk.Entry(planner, textvariable=self.multiplier_var, width=8).pack(side="left", padx=(8, 12))
        ttk.Button(planner, text="Recalculer", command=self.show_selected_blueprint).pack(side="left")

        detail_frame = ttk.LabelFrame(right, text="Detail du blueprint", padding=10)
        detail_frame.pack(fill="both", expand=True)

        self.detail_text = scrolledtext.ScrolledText(detail_frame, wrap="word", height=20)
        self.detail_text.pack(fill="both", expand=True)
        self.detail_text.configure(state="disabled")

    def _build_inventory_tab(self) -> None:
        toolbar = ttk.Frame(self.inventory_tab)
        toolbar.pack(fill="x")
        ttk.Button(toolbar, text="Ajouter", command=self.add_inventory_item).pack(side="left")
        ttk.Button(toolbar, text="Modifier", command=self.edit_inventory_item).pack(side="left", padx=(8, 0))
        ttk.Button(toolbar, text="Supprimer", command=self.delete_inventory_item).pack(side="left", padx=(8, 0))
        ttk.Button(toolbar, text="Rafraichir", command=self.refresh_inventory).pack(side="left", padx=(8, 0))

        self.inventory_tree = ttk.Treeview(
            self.inventory_tab,
            columns=("name", "qty", "quality", "location", "updated"),
            show="headings",
            selectmode="browse",
        )
        self.inventory_tree.pack(fill="both", expand=True, pady=(10, 0))
        self.inventory_tree.heading("name", text="Materiau")
        self.inventory_tree.heading("qty", text="SCU")
        self.inventory_tree.heading("quality", text="Qualite")
        self.inventory_tree.heading("location", text="Lieu")
        self.inventory_tree.heading("updated", text="Mis a jour")
        self.inventory_tree.column("name", width=260)
        self.inventory_tree.column("qty", width=100, anchor="e")
        self.inventory_tree.column("quality", width=100, anchor="center")
        self.inventory_tree.column("location", width=180)
        self.inventory_tree.column("updated", width=220)

    def _build_sync_tab(self) -> None:
        top = ttk.Frame(self.sync_tab)
        top.pack(fill="x")

        ttk.Button(top, text="Sync complete", command=self.start_sync).pack(side="left")
        ttk.Button(top, text="Sync courte (50 IDs)", command=lambda: self.start_sync(max_ids_to_scan=50)).pack(side="left", padx=(8, 0))
        ttk.Button(top, text="Rafraichir", command=self.refresh_sync_tab).pack(side="left", padx=(8, 0))

        self.sync_status_var = tk.StringVar(value="Pas encore de synchronisation.")
        ttk.Label(self.sync_tab, textvariable=self.sync_status_var, justify="left").pack(anchor="w", pady=(10, 6))

        self.sync_log = scrolledtext.ScrolledText(self.sync_tab, wrap="word")
        self.sync_log.pack(fill="both", expand=True)
        self.sync_log.configure(state="disabled")

    def append_log(self, message: str) -> None:
        self.sync_log.configure(state="normal")
        self.sync_log.insert("end", message.rstrip() + "\n")
        self.sync_log.see("end")
        self.sync_log.configure(state="disabled")

    def refresh_versions(self) -> None:
        versions = get_versions()
        version_values = [item["version"] for item in versions]
        self.version_combo["values"] = version_values
        if version_values and not self.version_var.get():
            default_version = get_default_version() or version_values[0]
            self.version_var.set(default_version)
        self.refresh_filter_values()

    def refresh_filter_values(self) -> None:
        version = self.version_var.get()
        self.category_combo["values"] = [""] + get_categories(version)
        self.resource_combo["values"] = [""] + get_known_resources(version)

    def on_version_changed(self) -> None:
        self.category_var.set("")
        self.resource_var.set("")
        self.refresh_filter_values()
        self.refresh_blueprints()
        self.refresh_sync_tab()

    def reset_filters(self) -> None:
        self.search_var.set("")
        self.category_var.set("")
        self.resource_var.set("")
        self.refresh_blueprints()

    def refresh_blueprints(self) -> None:
        version = self.version_var.get()
        for item in self.blueprint_tree.get_children():
            self.blueprint_tree.delete(item)
        self.blueprint_rows.clear()

        if not version:
            self.summary_var.set("Aucune version locale. Lance une synchronisation.")
            return

        rows = search_blueprints(
            version=version,
            search=self.search_var.get(),
            category=self.category_var.get(),
            resource=self.resource_var.get(),
        )
        for row in rows:
            item_id = self.blueprint_tree.insert(
                "",
                "end",
                values=(
                    row["name"],
                    row["category"] or "-",
                    fmt_seconds(row["craft_time_seconds"]),
                    row["tiers"] or "-",
                ),
            )
            self.blueprint_rows[item_id] = row["id"]

        total = count_blueprints(version)
        self.summary_var.set(f"{len(rows)} resultats affiches pour {version}. Base locale: {total} blueprints.")
        if rows:
            first = self.blueprint_tree.get_children()[0]
            self.blueprint_tree.selection_set(first)
            self.show_selected_blueprint()
        else:
            self._set_detail_text("Aucun blueprint local pour ces filtres.")

    def _set_detail_text(self, text: str) -> None:
        self.detail_text.configure(state="normal")
        self.detail_text.delete("1.0", "end")
        self.detail_text.insert("1.0", text)
        self.detail_text.configure(state="disabled")

    def show_selected_blueprint(self) -> None:
        selection = self.blueprint_tree.selection()
        if not selection:
            return
        blueprint_id = self.blueprint_rows.get(selection[0])
        if not blueprint_id:
            return
        payload = get_blueprint_detail(blueprint_id)
        if not payload:
            self._set_detail_text("Detail indisponible.")
            return

        try:
            multiplier = max(1, int(self.multiplier_var.get()))
        except ValueError:
            multiplier = 1
            self.multiplier_var.set("1")

        craft = evaluate_blueprint_craftability(payload, quantity_multiplier=multiplier)
        lines = [
            f"Nom: {payload.get('name', '-')}",
            f"ID: {payload.get('blueprint_id', '-')}",
            f"Categorie: {payload.get('category', '-')}",
            f"Temps de craft: {fmt_seconds(payload.get('craft_time_seconds'))}",
            f"Tiers: {payload.get('tiers', '-')}",
            f"Version: {payload.get('version', '-')}",
            "",
            f"Craft x{multiplier}: {'OUI' if craft['craftable'] else 'NON'}",
            f"Nombre maximal estime avec l'inventaire: {craft['possible_count']}",
            "",
            "Ingredients retenus par l'evaluateur:",
        ]

        for slot in craft["slots"]:
            lines.append(
                f"- {slot['slot'] or '?'} | {slot['name']} | requis {slot['required_qty']:.4f} SCU | "
                f"dispo {slot['available_qty']:.4f} SCU | qualite min {slot['min_quality']} | "
                f"{'OK' if slot['ok'] else 'MANQUE'}"
            )

        lines.append("")
        lines.append("Options de craft:")
        for ingredient in payload.get("ingredients") or []:
            lines.append(
                f"- Slot {ingredient.get('slot', '?')}: {ingredient.get('name', '-')}"
                f" ({float(ingredient.get('quantity_scu') or 0.0):.4f} SCU)"
            )
            for option in ingredient.get("options") or []:
                lines.append(
                    f"    -> {option.get('name', '-')} | {float(option.get('quantity_scu') or 0.0):.4f} SCU | "
                    f"qualite min {int(option.get('min_quality') or 0)}"
                )
            if ingredient.get("quality_effects"):
                lines.append("    Effets de qualite:")
                for effect in ingredient["quality_effects"]:
                    if isinstance(effect, dict):
                        text = ", ".join(f"{key}={value}" for key, value in effect.items())
                    else:
                        text = str(effect)
                    lines.append(f"    -> {text}")

        if payload.get("item_stats"):
            lines.extend(["", "Stats objet:", json.dumps(payload["item_stats"], indent=2, ensure_ascii=True)])

        if payload.get("missions"):
            lines.extend(["", "Sources / Missions:"])
            for mission in payload["missions"][:20]:
                lines.append(
                    f"- {mission.get('name', '-')}"
                    f" | contractor={mission.get('contractor', '-')}"
                    f" | type={mission.get('mission_type', '-')}"
                    f" | locations={mission.get('locations', '-')}"
                    f" | drop={mission.get('drop_chance', '-')}"
                )

        self._set_detail_text("\n".join(lines))

    def refresh_inventory(self) -> None:
        for item in self.inventory_tree.get_children():
            self.inventory_tree.delete(item)
        for row in list_inventory():
            self.inventory_tree.insert(
                "",
                "end",
                iid=str(row["id"]),
                values=(
                    row["resource_name"],
                    f"{float(row['quantity_scu']):.4f}",
                    row["quality"],
                    row["location"] or "-",
                    row["updated_at"],
                ),
            )
        self.show_selected_blueprint()

    def _inventory_selection(self) -> str | None:
        selection = self.inventory_tree.selection()
        return selection[0] if selection else None

    def add_inventory_item(self) -> None:
        dialog = InventoryDialog(self)
        self.wait_window(dialog)
        if dialog.result:
            add_inventory(**dialog.result)
            self.refresh_inventory()

    def edit_inventory_item(self) -> None:
        item_id = self._inventory_selection()
        if not item_id:
            messagebox.showinfo("Selection requise", "Selectionne un materiau a modifier.")
            return
        current = next((row for row in list_inventory() if str(row["id"]) == item_id), None)
        if not current:
            return
        dialog = InventoryDialog(self, current)
        self.wait_window(dialog)
        if dialog.result:
            update_inventory(int(item_id), **dialog.result)
            self.refresh_inventory()

    def delete_inventory_item(self) -> None:
        item_id = self._inventory_selection()
        if not item_id:
            messagebox.showinfo("Selection requise", "Selectionne un materiau a supprimer.")
            return
        if not messagebox.askyesno("Confirmer", "Supprimer ce materiau de l'inventaire ?"):
            return
        delete_inventory(int(item_id))
        self.refresh_inventory()

    def refresh_sync_tab(self) -> None:
        version = self.version_var.get()
        stats = get_stats(version) if version else None
        latest = latest_sync_run()
        summary = []
        if version:
            summary.append(f"Version selectionnee: {version}")
            summary.append(f"Blueprints locaux: {count_blueprints(version)}")
        if stats:
            summary.append(
                f"Source distante: {stats.get('totalBlueprints', 0)} blueprints, "
                f"{stats.get('uniqueIngredients', 0)} ingredients uniques."
            )
        if latest:
            summary.append(
                f"Derniere sync: status={latest['status']} | importes={latest['imported_blueprints']} | "
                f"dernier ID={latest['last_blueprint_id']}"
            )
            if latest["message"]:
                summary.append(f"Message: {latest['message']}")
        if not summary:
            summary.append("Pas encore de synchronisation.")
        self.sync_status_var.set("\n".join(summary))

    def start_sync(self, max_ids_to_scan: int | None = None) -> None:
        if self.sync_in_progress:
            messagebox.showinfo("Synchronisation", "Une synchronisation est deja en cours.")
            return

        version = self.version_var.get() or None
        self.sync_in_progress = True
        self.append_log("Debut synchronisation...")

        def worker() -> None:
            importer = ScCraftImporter(log=lambda message: self.after(0, self.append_log, message))
            try:
                result = importer.full_sync(version=version, max_ids_to_scan=max_ids_to_scan)
                self.after(
                    0,
                    lambda: messagebox.showinfo(
                        "Synchronisation terminee",
                        f"Version {result.version}\n"
                        f"Blueprints locaux: {result.imported_blueprints}\n"
                        f"Dernier ID scanne: {result.last_blueprint_id}",
                    ),
                )
            except SyncError as error:
                self.after(0, lambda: messagebox.showerror("Synchronisation", str(error)))
            except Exception as error:
                self.after(0, lambda: messagebox.showerror("Synchronisation", f"Erreur: {error!s}"))
            finally:
                def finish() -> None:
                    self.sync_in_progress = False
                    self.refresh_versions()
                    self.refresh_blueprints()
                    self.refresh_sync_tab()
                self.after(0, finish)

        threading.Thread(target=worker, daemon=True).start()


def main() -> None:
    app = CraftTrackerApp()
    app.mainloop()

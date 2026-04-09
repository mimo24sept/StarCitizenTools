import { useEffect, useState } from "react";
import { buildShoppingList, findCommodityMarket, normalizeWikeloSnapshot } from "../wikeloData";
import WikeloLibraryPanel from "../features/wikelo/WikeloLibraryPanel";
import WikeloRecipeDetailPanel from "../features/wikelo/WikeloRecipeDetailPanel";
import WikeloSidebarPanels from "../features/wikelo/WikeloSidebarPanels";
import {
  buildDraftRecord,
  buildInventoryMap,
  buildProgressMap,
  computeRecipeProgress,
  filterRecipes,
  sanitizeCount
} from "../features/wikelo/helpers";

export default function WikeloPage({ db, refreshToken }) {
  const [wikelo, setWikelo] = useState(null);
  const [tradeSnapshot, setTradeSnapshot] = useState(null);
  const [recipeProgressRows, setRecipeProgressRows] = useState([]);
  const [inventoryRows, setInventoryRows] = useState([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [selectedMaterialName, setSelectedMaterialName] = useState("");
  const [inventoryDrafts, setInventoryDrafts] = useState({});
  const [noteDrafts, setNoteDrafts] = useState({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("active");
  const [trackedOnly, setTrackedOnly] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("No Wikelo snapshot yet.");
  const [imageHidden, setImageHidden] = useState(false);

  useEffect(() => {
    if (!db) return;
    loadAll();
  }, [db, refreshToken]);

  async function loadAll() {
    const [snapshotResult, tradeResult] = await Promise.all([
      window.desktopAPI.getWikeloSnapshot(),
      window.desktopAPI.getTradeSnapshot()
    ]);

    if (snapshotResult?.ok) {
      const normalized = normalizeWikeloSnapshot(snapshotResult.snapshot);
      setWikelo(normalized);
      setSyncMessage(
        `Snapshot ${normalized.fetchedAt || normalized.meta.data_updated || "ready"} · ${normalized.recipes.length} recipes`
      );
    } else {
      setWikelo(null);
      setSyncMessage("No Wikelo snapshot yet.");
    }

    if (tradeResult?.ok) {
      setTradeSnapshot(tradeResult.snapshot);
    }

    const progressRows = db.getWikeloRecipeProgress();
    const inventory = db.getWikeloInventory();
    setRecipeProgressRows(progressRows);
    setInventoryRows(inventory);
    setInventoryDrafts(buildDraftRecord(inventory, "resourceName", (row) => String(row.quantity)));
    setNoteDrafts(buildDraftRecord(inventory, "resourceName", (row) => row.notes || ""));
  }

  async function syncWikelo() {
    if (syncing) return;
    setSyncing(true);
    setSyncMessage("Synchronizing Wikelo data...");
    const result = await window.desktopAPI.runWikeloSync();
    if (!result?.ok) {
      setSyncing(false);
      setSyncMessage("Wikelo sync failed");
      window.alert(result?.error || "Wikelo sync failed");
      return;
    }
    await loadAll();
    setSyncing(false);
    setSyncMessage(
      `Synced ${result.counts?.items ?? 0} items, ${result.counts?.ships ?? 0} ships and ${result.counts?.currency ?? 0} exchanges`
    );
  }

  const recipes = wikelo?.recipes ?? [];
  const progressMap = buildProgressMap(recipeProgressRows);
  const inventoryMap = buildInventoryMap(inventoryRows);
  const categories = ["all", ...Array.from(new Set(recipes.map((recipe) => recipe.category))).sort((a, b) => a.localeCompare(b))];

  const filteredRecipes = filterRecipes(recipes, progressMap, inventoryMap, {
    category,
    status,
    trackedOnly,
    search
  });

  useEffect(() => {
    if (!filteredRecipes.length) {
      setSelectedRecipeId("");
      return;
    }
    if (!filteredRecipes.some((recipe) => recipe.id === selectedRecipeId)) {
      setSelectedRecipeId(filteredRecipes[0].id);
    }
  }, [selectedRecipeId, filteredRecipes]);

  const selectedRecipe = filteredRecipes.find((recipe) => recipe.id === selectedRecipeId) || null;
  const selectedProgress = selectedRecipe ? progressMap.get(selectedRecipe.id) : null;
  const selectedRecipeProgress = selectedRecipe
    ? computeRecipeProgress(selectedRecipe, selectedProgress, inventoryMap)
    : null;
  const trackedRecipes = recipes.filter((recipe) => progressMap.get(recipe.id)?.tracked);
  const shoppingList = buildShoppingList(recipes, progressMap, inventoryMap);

  useEffect(() => {
    if (!selectedRecipeProgress?.ingredients?.length) {
      setSelectedMaterialName("");
      return;
    }
    if (!selectedRecipeProgress.ingredients.some((ingredient) => ingredient.name === selectedMaterialName)) {
      setSelectedMaterialName(selectedRecipeProgress.ingredients[0].name);
    }
  }, [selectedRecipeId, selectedMaterialName, selectedRecipeProgress]);

  const selectedMaterial = selectedRecipeProgress?.ingredients.find((ingredient) => ingredient.name === selectedMaterialName) || null;
  const ingredientInfo = selectedMaterial ? wikelo?.ingredientInfo?.[selectedMaterial.name] ?? null : null;
  const materialMarket = selectedMaterial ? findCommodityMarket(selectedMaterial.name, tradeSnapshot) : null;
  const materialUsage = selectedMaterial ? wikelo?.recipeUsage?.get(selectedMaterial.name.toLowerCase()) ?? [] : [];

  useEffect(() => {
    setImageHidden(false);
  }, [selectedRecipeId]);

  async function saveRecipeProgress(next) {
    await db.saveWikeloRecipeProgress(next);
    setRecipeProgressRows(db.getWikeloRecipeProgress());
  }

  async function saveInventory(resourceName, quantity, notes) {
    await db.saveWikeloInventoryItem({
      resourceName,
      quantity: Math.max(0, Number(quantity || 0)),
      notes: notes ?? ""
    });
    setInventoryRows(db.getWikeloInventory());
  }

  async function commitInventoryQuantity(resourceName) {
    const quantity = Math.max(0, Number(inventoryDrafts[resourceName] || 0));
    const notes = noteDrafts[resourceName] || "";
    await saveInventory(resourceName, quantity, notes);
  }

  async function commitInventoryNotes(resourceName) {
    const quantity = Math.max(
      0,
      Number(inventoryDrafts[resourceName] || inventoryMap.get(resourceName)?.quantity || 0)
    );
    const notes = noteDrafts[resourceName] || "";
    await saveInventory(resourceName, quantity, notes);
  }

  return (
    <div className="scmdb-page wikelo-page">
      <div className="scmdb-topbar">
        <div className="scmdb-topbar-title">
          <span className="scmdb-logo">WIKELO</span>
          <span className="scmdb-sep">//</span>
          <div>
            <strong>Recipe Exchange</strong>
            <span>Recipes, progress, shopping list and market intel</span>
          </div>
        </div>
        <div className="scmdb-topbar-actions">
          <span className="scmdb-chip">Patch {wikelo?.meta?.current_patch || "?"}</span>
          <span className="scmdb-chip">{trackedRecipes.length} tracked</span>
          <span className="scmdb-chip">{shoppingList.filter((item) => item.missing > 0).length} missing</span>
          <button className="primary-button" onClick={syncWikelo} disabled={syncing}>
            {syncing ? "Syncing..." : "Sync Wikelo data"}
          </button>
        </div>
      </div>

      {!wikelo ? (
        <div className="state-shell">
          <div className="state-card">
            <div className="brand-kicker">Wikelo</div>
            <h1>Local recipe data missing</h1>
            <p>{syncMessage}</p>
            <div className="button-row">
              <button className="primary-button" onClick={syncWikelo} disabled={syncing}>
                {syncing ? "Syncing..." : "Sync Wikelo data"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="wikelo-layout">
          <WikeloLibraryPanel
            search={search}
            setSearch={setSearch}
            category={category}
            setCategory={setCategory}
            status={status}
            setStatus={setStatus}
            trackedOnly={trackedOnly}
            setTrackedOnly={setTrackedOnly}
            categories={categories}
            syncMessage={syncMessage}
            filteredRecipes={filteredRecipes}
            progressMap={progressMap}
            inventoryMap={inventoryMap}
            computeRecipeProgress={computeRecipeProgress}
            selectedRecipeId={selectedRecipeId}
            setSelectedRecipeId={setSelectedRecipeId}
          />

          <WikeloRecipeDetailPanel
            selectedRecipe={selectedRecipe}
            selectedRecipeProgress={selectedRecipeProgress}
            selectedProgress={selectedProgress}
            saveRecipeProgress={saveRecipeProgress}
            sanitizeCount={sanitizeCount}
            imageHidden={imageHidden}
            setImageHidden={setImageHidden}
            selectedMaterialName={selectedMaterialName}
            setSelectedMaterialName={setSelectedMaterialName}
            tradeSnapshot={tradeSnapshot}
            findCommodityMarket={findCommodityMarket}
            inventoryDrafts={inventoryDrafts}
            setInventoryDrafts={setInventoryDrafts}
            commitInventoryQuantity={commitInventoryQuantity}
          />

          <WikeloSidebarPanels
            trackedRecipes={trackedRecipes}
            shoppingList={shoppingList}
            selectedMaterialName={selectedMaterialName}
            setSelectedMaterialName={setSelectedMaterialName}
            selectedMaterial={selectedMaterial}
            materialUsage={materialUsage}
            materialMarket={materialMarket}
            ingredientInfo={ingredientInfo}
            selectedRecipe={selectedRecipe}
            noteDrafts={noteDrafts}
            setNoteDrafts={setNoteDrafts}
            commitInventoryNotes={commitInventoryNotes}
          />
        </div>
      )}
    </div>
  );
}

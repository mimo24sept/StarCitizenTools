import { useEffect, useState } from "react";
import SectionCard from "../components/SectionCard";
import { fmtMoney, fmtNumber, toNumber } from "../utils/helpers";
import { buildShoppingList, findCommodityMarket, normalizeWikeloSnapshot } from "../wikeloData";

function buildProgressMap(rows) {
  return new Map(rows.map((row) => [row.recipeId, row]));
}

function buildInventoryMap(rows) {
  return new Map(rows.map((row) => [row.resourceName, row]));
}

function sanitizeCount(value, fallback = 1) {
  const parsed = Math.max(0, Math.floor(toNumber(value, fallback)));
  return parsed || fallback;
}

function computeRecipeProgress(recipe, progress, inventoryMap) {
  const crafts = Math.max(1, Number(progress?.targetCrafts || 1));
  const ingredients = recipe.ingredients.map((ingredient) => {
    const inventory = inventoryMap.get(ingredient.name);
    const needed = Number(ingredient.quantity || 0) * crafts;
    const owned = Number(inventory?.quantity || 0);
    return {
      ...ingredient,
      needed,
      owned,
      missing: Math.max(0, needed - owned),
      notes: inventory?.notes || ""
    };
  });

  const totalNeeded = ingredients.reduce((sum, ingredient) => sum + ingredient.needed, 0);
  const totalOwned = ingredients.reduce((sum, ingredient) => sum + Math.min(ingredient.owned, ingredient.needed), 0);
  const percent = totalNeeded ? Math.min(100, (totalOwned / totalNeeded) * 100) : 0;

  return {
    crafts,
    ingredients,
    percent,
    totalNeeded,
    totalOwned,
    totalMissing: Math.max(0, totalNeeded - totalOwned)
  };
}

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
    setInventoryDrafts(Object.fromEntries(inventory.map((row) => [row.resourceName, String(row.quantity)])));
    setNoteDrafts(Object.fromEntries(inventory.map((row) => [row.resourceName, row.notes || ""])));
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

  const filteredRecipes = recipes.filter((recipe) => {
    if (category !== "all" && recipe.category !== category) return false;
    if (status === "active" && recipe.status !== "active") return false;
    if (status === "retired" && recipe.status === "active") return false;
    if (trackedOnly && !progressMap.get(recipe.id)?.tracked) return false;
    if (!search.trim()) return true;
    const haystack = [
      recipe.title,
      recipe.reward,
      recipe.description,
      recipe.recipeText,
      recipe.category
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
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

  async function saveRecipeProgress(next) {
    await db.saveWikeloRecipeProgress(next);
    const rows = db.getWikeloRecipeProgress();
    setRecipeProgressRows(rows);
  }

  async function saveInventory(resourceName, quantity, notes) {
    await db.saveWikeloInventoryItem({ resourceName, quantity: Math.max(0, Number(quantity || 0)), notes: notes ?? "" });
    const rows = db.getWikeloInventory();
    setInventoryRows(rows);
  }

  async function commitInventoryQuantity(resourceName) {
    const quantity = Math.max(0, Number(inventoryDrafts[resourceName] || 0));
    const notes = noteDrafts[resourceName] || "";
    await saveInventory(resourceName, quantity, notes);
  }

  async function commitInventoryNotes(resourceName) {
    const quantity = Math.max(0, Number(inventoryDrafts[resourceName] || inventoryMap.get(resourceName)?.quantity || 0));
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
          <SectionCard title="Recipe library" className="wikelo-library-card">
            <div className="wikelo-filter-grid">
              <div className="field-stack">
                <span>Search</span>
                <input
                  className="app-input mono-input"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Reward, mission or ingredient..."
                />
              </div>
              <div className="field-stack">
                <span>Category</span>
                <select className="app-select mono-input" value={category} onChange={(event) => setCategory(event.target.value)}>
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item === "all" ? "All recipes" : item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-stack">
                <span>Status</span>
                <select className="app-select mono-input" value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="active">Active only</option>
                  <option value="retired">Retired only</option>
                  <option value="all">All statuses</option>
                </select>
              </div>
              <div className="field-stack">
                <span>Tracked</span>
                <button className={`filter-toggle ${trackedOnly ? "is-active" : ""}`} onClick={() => setTrackedOnly((value) => !value)}>
                  {trackedOnly ? "Tracked only" : "All recipes"}
                </button>
              </div>
            </div>

            <div className="summary-copy">{syncMessage}</div>

            <div className="wikelo-list-scroll">
              {filteredRecipes.map((recipe) => {
                const progress = computeRecipeProgress(recipe, progressMap.get(recipe.id), inventoryMap);
                const tracked = progressMap.get(recipe.id)?.tracked;
                return (
                  <button
                    key={recipe.id}
                    className={`wikelo-recipe-card ${selectedRecipeId === recipe.id ? "is-selected" : ""}`}
                    onClick={() => setSelectedRecipeId(recipe.id)}
                  >
                    <div className="wikelo-recipe-card-head">
                      <strong>{recipe.title}</strong>
                      <div className="wikelo-recipe-card-badges">
                        {tracked ? <span className="trade-pill safe">Tracked</span> : null}
                        {recipe.status !== "active" ? <span className="trade-pill danger">{recipe.status}</span> : null}
                      </div>
                    </div>
                    <div className="wikelo-recipe-card-meta">
                      <span>{recipe.category}</span>
                      <span>{recipe.reward || "No reward label"}</span>
                    </div>
                    <div className="wikelo-recipe-card-stats">
                      <span>{recipe.ingredients.length} materials</span>
                      <span>{progress.percent.toFixed(0)}% ready</span>
                      <span>{progress.totalMissing} missing</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Recipe detail" className="wikelo-detail-card">
            {!selectedRecipe || !selectedRecipeProgress ? (
              <p className="empty-text">Select a Wikelo recipe to inspect it.</p>
            ) : (
              <div className="wikelo-detail-scroll">
                <div className="wikelo-recipe-header">
                  <div className="wikelo-recipe-copy">
                    <div className="wikelo-recipe-topline">
                      <div>
                        <div className="detail-title">{selectedRecipe.title}</div>
                        <div className="detail-subtitle">{selectedRecipe.reward || "Reward pending"}</div>
                      </div>
                      <div className="wikelo-recipe-badges">
                        <span className="scmdb-tag">{selectedRecipe.category}</span>
                        {selectedRecipe.patch ? <span className="scmdb-tag">{selectedRecipe.patch}</span> : null}
                        {selectedRecipe.patchType ? <span className="scmdb-tag">{selectedRecipe.patchType}</span> : null}
                      </div>
                    </div>

                    <div className="summary-copy">{selectedRecipe.description || "No mission description in the current dataset."}</div>

                    <div className="wikelo-progress-toolbar">
                      <div className="field-stack wikelo-target-field">
                        <span>Craft count</span>
                        <input
                          type="number"
                          min="1"
                          className="app-input mono-input"
                          value={selectedProgress?.targetCrafts ?? 1}
                          onChange={(event) =>
                            saveRecipeProgress({
                              recipeId: selectedRecipe.id,
                              tracked: selectedProgress?.tracked ?? false,
                              targetCrafts: sanitizeCount(event.target.value, 1)
                            })
                          }
                        />
                      </div>
                      <button
                        className={selectedProgress?.tracked ? "secondary-button" : "primary-button"}
                        onClick={() =>
                          saveRecipeProgress({
                            recipeId: selectedRecipe.id,
                            tracked: !(selectedProgress?.tracked ?? false),
                            targetCrafts: selectedProgress?.targetCrafts ?? 1
                          })
                        }
                      >
                        {selectedProgress?.tracked ? "Untrack recipe" : "Track recipe"}
                      </button>
                      <span className="trade-inline-stats">
                        <span>{selectedRecipeProgress.percent.toFixed(0)}% ready</span>
                        <span>{fmtNumber(selectedRecipeProgress.totalMissing)} missing</span>
                        <span>+{selectedRecipe.reputationReward || 0} rep</span>
                      </span>
                    </div>
                  </div>

                  {selectedRecipe.imageUrl ? (
                    <div className="wikelo-image-shell">
                      <img className="wikelo-image" src={selectedRecipe.imageUrl} alt={selectedRecipe.reward || selectedRecipe.title} />
                    </div>
                  ) : null}
                </div>

                <div className="wikelo-ingredient-list">
                  {selectedRecipeProgress.ingredients.map((ingredient) => {
                    const hasMarket = Boolean(findCommodityMarket(ingredient.name, tradeSnapshot));
                    return (
                      <div
                        key={ingredient.name}
                        className={`wikelo-ingredient-row ${selectedMaterialName === ingredient.name ? "is-selected" : ""}`}
                        onClick={() => setSelectedMaterialName(ingredient.name)}
                      >
                        <div className="wikelo-ingredient-main">
                          <div className="wikelo-ingredient-title">
                            <strong>{ingredient.name}</strong>
                            {hasMarket ? <span className="trade-pill safe">UEX</span> : null}
                          </div>
                          <span>
                            Need {fmtNumber(ingredient.needed)} · Owned {fmtNumber(ingredient.owned)} · Missing {fmtNumber(ingredient.missing)}
                          </span>
                        </div>
                        <div className="wikelo-ingredient-input">
                          <label className="control-label">Have</label>
                          <input
                            type="number"
                            min="0"
                            className="app-input mono-input"
                            value={inventoryDrafts[ingredient.name] ?? String(ingredient.owned)}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              setInventoryDrafts((current) => ({
                                ...current,
                                [ingredient.name]: event.target.value
                              }))
                            }
                            onBlur={() => commitInventoryQuantity(ingredient.name)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="wikelo-detail-grid">
                  <div className="source-card">
                    <strong>Mission / exchange intel</strong>
                    <span>{selectedRecipe.notes || "No extra mission note in the current dataset."}</span>
                    {selectedRecipe.sources.length ? (
                      <div className="wikelo-source-list">
                        {selectedRecipe.sources.map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="empty-text">No dedicated source lines in the Wikelo dataset for this recipe.</span>
                    )}
                  </div>

                  <div className="source-card">
                    <strong>Recipe meta</strong>
                    <span>Reputation required: {selectedRecipe.reputationRequired || 0}</span>
                    <span>Reputation reward: {selectedRecipe.reputationReward || 0}</span>
                    {selectedRecipe.componentsSummary ? <span>{selectedRecipe.componentsSummary}</span> : null}
                    {selectedRecipe.otherComponents ? <span>{selectedRecipe.otherComponents}</span> : null}
                    {selectedRecipe.links.length ? (
                      <div className="wikelo-link-list">
                        {selectedRecipe.links.map((link) => (
                          <a key={link.url || link.title} href={link.url} target="_blank" rel="noreferrer">
                            {link.title || link.url}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          <div className="wikelo-side-column">
            <SectionCard title="Shopping list" className="wikelo-side-card">
              <div className="wikelo-side-scroll">
                <div className="trade-inline-stats">
                  <span>{trackedRecipes.length} tracked recipes</span>
                  <span>{shoppingList.length} resources</span>
                  <span>{shoppingList.filter((item) => item.missing > 0).length} still missing</span>
                </div>

                {!trackedRecipes.length ? (
                  <p className="empty-text">Track a recipe to build a shared shopping list.</p>
                ) : (
                  <div className="wikelo-shopping-list">
                    {shoppingList.map((item) => (
                      <button
                        key={item.name}
                        className={`wikelo-shopping-row ${selectedMaterialName === item.name ? "is-selected" : ""}`}
                        onClick={() => setSelectedMaterialName(item.name)}
                      >
                        <div>
                          <strong>{item.name}</strong>
                          <span>
                            Need {fmtNumber(item.needed)} · Have {fmtNumber(item.owned)}
                          </span>
                        </div>
                        <strong className={item.missing > 0 ? "wikelo-missing" : "wikelo-ready"}>
                          {item.missing > 0 ? `${fmtNumber(item.missing)} left` : "Ready"}
                        </strong>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Material intel" className="wikelo-side-card">
              <div className="wikelo-side-scroll">
                {!selectedMaterial ? (
                  <p className="empty-text">Select an ingredient to inspect where it comes from and how much it costs.</p>
                ) : (
                  <>
                    <div className="wikelo-material-head">
                      <div>
                        <div className="detail-title">{selectedMaterial.name}</div>
                        <div className="detail-subtitle">Used in {materialUsage.length} Wikelo recipe{materialUsage.length === 1 ? "" : "s"}</div>
                      </div>
                      {materialMarket ? <span className="trade-pill safe">UEX listed</span> : <span className="trade-pill">No UEX data</span>}
                    </div>

                    {ingredientInfo?.location || ingredientInfo?.link_url ? (
                      <div className="source-card">
                        <strong>Datamined source</strong>
                        {ingredientInfo.location ? <span>{ingredientInfo.location}</span> : null}
                        {ingredientInfo.link_url ? (
                          <a href={ingredientInfo.link_url} target="_blank" rel="noreferrer">
                            {ingredientInfo.link_title || ingredientInfo.link_url}
                          </a>
                        ) : null}
                      </div>
                    ) : (
                      <div className="source-card">
                        <strong>Recipe hints</strong>
                        <span>
                          {selectedRecipe?.sources?.length
                            ? selectedRecipe.sources.join(" · ")
                            : "No dedicated per-material source is present in the current Wikelo dataset."}
                        </span>
                      </div>
                    )}

                    {materialMarket ? (
                      <div className="wikelo-market-grid">
                        <div className="trade-metric-block">
                          <small>Best buy</small>
                          <strong>{fmtMoney(materialMarket.bestBuy?.priceBuy || 0)}</strong>
                          <span>{materialMarket.bestBuy?.terminal?.displayName || materialMarket.bestBuy?.terminalName || "Unknown terminal"}</span>
                        </div>
                        <div className="trade-metric-block">
                          <small>Best sell</small>
                          <strong>{fmtMoney(materialMarket.bestSell?.priceSell || 0)}</strong>
                          <span>{materialMarket.bestSell?.terminal?.displayName || materialMarket.bestSell?.terminalName || "Unknown terminal"}</span>
                        </div>
                      </div>
                    ) : null}

                    <div className="field-stack">
                      <span>Personal note</span>
                      <textarea
                        className="app-textarea"
                        value={noteDrafts[selectedMaterial.name] ?? selectedMaterial.notes ?? ""}
                        placeholder="Where do you usually farm this resource? bunker, cave, mission, trader..."
                        onChange={(event) =>
                          setNoteDrafts((current) => ({
                            ...current,
                            [selectedMaterial.name]: event.target.value
                          }))
                        }
                        onBlur={() => commitInventoryNotes(selectedMaterial.name)}
                      />
                    </div>
                  </>
                )}
              </div>
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
}

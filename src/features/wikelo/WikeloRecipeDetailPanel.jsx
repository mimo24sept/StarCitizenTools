import SectionCard from "../../components/SectionCard";
import { fmtNumber } from "../../utils/helpers";

export default function WikeloRecipeDetailPanel({
  selectedRecipe,
  selectedRecipeProgress,
  selectedProgress,
  saveRecipeProgress,
  sanitizeCount,
  imageHidden,
  setImageHidden,
  selectedMaterialName,
  setSelectedMaterialName,
  tradeSnapshot,
  findCommodityMarket,
  inventoryDrafts,
  setInventoryDrafts,
  commitInventoryQuantity
}) {
  if (!selectedRecipe || !selectedRecipeProgress) {
    return (
      <SectionCard title="Recipe detail" className="wikelo-detail-card">
        <p className="empty-text">Select a Wikelo recipe to inspect it.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Recipe detail" className="wikelo-detail-card">
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
                <input
                  type="number"
                  min="1"
                  className="app-input mono-input"
                  value={selectedProgress?.targetCrafts ?? 1}
                  placeholder="Craft count"
                  aria-label="Craft count"
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

          {selectedRecipe.imageUrl && !imageHidden ? (
            <div className="wikelo-image-shell">
              <img
                className="wikelo-image"
                src={selectedRecipe.imageUrl}
                alt={selectedRecipe.reward || selectedRecipe.title}
                onError={() => setImageHidden(true)}
              />
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
                  <input
                    type="number"
                    min="0"
                    className="app-input mono-input"
                    value={inventoryDrafts[ingredient.name] ?? String(ingredient.owned)}
                    placeholder="Have"
                    aria-label={`Owned quantity for ${ingredient.name}`}
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
            <span>{selectedRecipe.notes || selectedRecipe.wiki?.extract || "No extra mission note in the current dataset."}</span>
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
            {selectedRecipe.wiki?.url ? (
              <a href={selectedRecipe.wiki.url} target="_blank" rel="noreferrer">
                Open wiki page
              </a>
            ) : null}
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
    </SectionCard>
  );
}

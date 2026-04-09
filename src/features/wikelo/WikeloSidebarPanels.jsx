import SectionCard from "../../components/SectionCard";
import { fmtMoney, fmtNumber } from "../../utils/helpers";

export default function WikeloSidebarPanels({
  trackedRecipes,
  shoppingList,
  selectedMaterialName,
  setSelectedMaterialName,
  selectedMaterial,
  materialUsage,
  materialMarket,
  ingredientInfo,
  selectedRecipe,
  noteDrafts,
  setNoteDrafts,
  commitInventoryNotes
}) {
  return (
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
                  <strong>Where to get it</strong>
                  {ingredientInfo.location ? <span>{ingredientInfo.location}</span> : null}
                  {ingredientInfo.description ? <span>{ingredientInfo.description}</span> : null}
                  {ingredientInfo.link_url ? (
                    <a href={ingredientInfo.link_url} target="_blank" rel="noreferrer">
                      {ingredientInfo.link_title || ingredientInfo.link_url}
                    </a>
                  ) : null}
                </div>
              ) : (
                <div className="source-card">
                  <strong>Where to get it</strong>
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
                <textarea
                  className="app-textarea"
                  value={noteDrafts[selectedMaterial.name] ?? selectedMaterial.notes ?? ""}
                  placeholder="Where do you usually farm this resource? bunker, cave, mission, trader..."
                  aria-label={`Personal note for ${selectedMaterial.name}`}
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
  );
}

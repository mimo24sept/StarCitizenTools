import SectionCard from "../../components/SectionCard";
import { fmtNumber } from "../../utils/helpers";

export default function WikeloLibraryPanel({
  search,
  setSearch,
  category,
  setCategory,
  status,
  setStatus,
  trackedOnly,
  setTrackedOnly,
  categories,
  syncMessage,
  filteredRecipes,
  progressMap,
  inventoryMap,
  computeRecipeProgress,
  selectedRecipeId,
  setSelectedRecipeId
}) {
  return (
    <SectionCard title="Recipe library" className="wikelo-library-card">
      <div className="wikelo-library-meta">
        <div className="wikelo-filter-grid">
          <div className="field-stack">
            <input
              className="app-input mono-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search recipes, rewards, materials..."
              aria-label="Search recipes"
            />
          </div>
          <div className="field-stack">
            <select className="app-select mono-input" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Recipe category">
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "All recipes" : item}
                </option>
              ))}
            </select>
          </div>
          <div className="field-stack">
            <select className="app-select mono-input" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Recipe status">
              <option value="active">Active only</option>
              <option value="retired">Retired only</option>
              <option value="all">All statuses</option>
            </select>
          </div>
          <div className="field-stack">
            <button className={`filter-toggle ${trackedOnly ? "is-active" : ""}`} onClick={() => setTrackedOnly((value) => !value)}>
              {trackedOnly ? "Tracked only" : "All recipes"}
            </button>
          </div>
        </div>

        <div className="summary-copy">{syncMessage}</div>
      </div>

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
                <span>{fmtNumber(progress.totalMissing)} missing</span>
              </div>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}

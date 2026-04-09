import { toNumber } from "../../utils/helpers";

export function buildProgressMap(rows) {
  return new Map(rows.map((row) => [row.recipeId, row]));
}

export function buildInventoryMap(rows) {
  return new Map(rows.map((row) => [row.resourceName, row]));
}

export function sanitizeCount(value, fallback = 1) {
  const parsed = Math.max(0, Math.floor(toNumber(value, fallback)));
  return parsed || fallback;
}

export function computeRecipeProgress(recipe, progress, inventoryMap) {
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

export function filterRecipes(recipes, progressMap, inventoryMap, filters) {
  const { category, status, trackedOnly, search } = filters;
  return recipes.filter((recipe) => {
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
}

export function buildDraftRecord(rows, key, valueSelector) {
  return Object.fromEntries(rows.map((row) => [row[key], valueSelector(row)]));
}

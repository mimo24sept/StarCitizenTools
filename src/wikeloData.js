const WIKELO_IMAGE_BASE = "https://raw.githubusercontent.com/SeekND/Wikelo/main/";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseDelimitedList(value) {
  return String(value ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeLinks(value) {
  return toArray(value)
    .map((item) => {
      if (typeof item === "string") {
        return { title: item, url: item };
      }
      return {
        title: item?.title || item?.url || "",
        url: item?.url || ""
      };
    })
    .filter((item) => item.title || item.url);
}

export function parseRecipe(recipeText) {
  return parseDelimitedList(recipeText).map((part) => {
    const match = part.match(/^(\d+)x\s+(.+)$/i);
    if (!match) {
      return {
        name: part,
        quantity: 1
      };
    }
    return {
      name: match[2].trim(),
      quantity: Number(match[1]) || 1
    };
  });
}

function normalizeRecipe(entry, kind, categoryOverride = "") {
  const ingredients = parseRecipe(entry.recipe);
  const imageUrl = entry.image_url
    ? (String(entry.image_url).startsWith("http") ? entry.image_url : `${WIKELO_IMAGE_BASE}${entry.image_url}`)
    : entry.wiki?.imageUrl || "";
  return {
    id: entry.id || `${kind}:${entry.mission_name || entry.name || entry.reward}`,
    kind,
    category: categoryOverride || entry.category || kind,
    title: entry.mission_name || entry.name || entry.reward || "Untitled recipe",
    reward: entry.reward || entry.name || "",
    patch: entry.patch || "",
    patchType: entry.patch_type || "",
    updatedAt: entry.date_updated || "",
    status: entry.status || "active",
    reputationRequired: Number(entry.reputation_required || 0),
    reputationReward: Number(entry.reputation_reward || 0),
    description: entry.description || "",
    recipeText: entry.recipe || "",
    ingredients,
    sources: parseDelimitedList(entry.sources),
    notes: entry.notes || "",
    links: normalizeLinks(entry.further_reading),
    imageUrl,
    wiki: entry.wiki ?? null,
    componentsSummary: entry.components_summary || "",
    otherComponents: entry.other_components || "",
    components: toArray(entry.components)
  };
}

export function normalizeWikeloSnapshot(snapshot) {
  const data = snapshot?.data ?? snapshot ?? {};
  const recipes = [
    ...toArray(data.items).map((entry) => normalizeRecipe(entry, "item")),
    ...toArray(data.ships).map((entry) => normalizeRecipe(entry, "ship")),
    ...toArray(data.currency_exchanges).map((entry, index) =>
      normalizeRecipe(
        { ...entry, id: `currency_${index + 1}`, status: "active" },
        "currency",
        "currency"
      )
    ),
    ...(data.intro_mission ? [normalizeRecipe(data.intro_mission, "intro", "intro")] : [])
  ].sort((left, right) => left.title.localeCompare(right.title));

  const ingredientInfo = data.ingredients_info ?? {};
  const recipeUsage = new Map();
  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      const key = ingredient.name.toLowerCase();
      if (!recipeUsage.has(key)) {
        recipeUsage.set(key, []);
      }
      recipeUsage.get(key).push(recipe.id);
    }
  }

  return {
    source: snapshot?.source || "SeekND/Wikelo",
    fetchedAt: snapshot?.fetchedAt || data.meta?.data_updated || "",
    meta: data.meta ?? {},
    introMission: data.intro_mission ?? null,
    reputation: data.reputation ?? {},
    veryHungry: data.very_hungry ?? {},
    ingredientInfo,
    recipes,
    recipeUsage
  };
}

export function normalizeMaterialName(name) {
  return String(name ?? "").trim().replace(/\s+/g, " ");
}

function materialVariants(name) {
  const base = normalizeMaterialName(name);
  const noSuffix = base.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  return Array.from(new Set([base, noSuffix].filter(Boolean)));
}

export function findCommodityMarket(materialName, tradeSnapshot) {
  if (!tradeSnapshot?.commodities?.length || !tradeSnapshot?.prices?.length) {
    return null;
  }

  const terminalsById = new Map((tradeSnapshot.terminals ?? []).map((terminal) => [Number(terminal.id), terminal]));
  const variants = materialVariants(materialName).map((item) => item.toLowerCase());
  const commodity = (tradeSnapshot.commodities ?? []).find((item) => variants.includes(String(item.name || "").toLowerCase()));
  if (!commodity) {
    return null;
  }

  const prices = (tradeSnapshot.prices ?? []).filter((price) => Number(price.commodityId) === Number(commodity.id));
  const buyOffers = prices
    .filter((price) => Number(price.priceBuy) > 0)
    .map((price) => ({
      ...price,
      terminal: terminalsById.get(Number(price.terminalId))
    }))
    .sort((left, right) => Number(left.priceBuy) - Number(right.priceBuy));
  const sellOffers = prices
    .filter((price) => Number(price.priceSell) > 0)
    .map((price) => ({
      ...price,
      terminal: terminalsById.get(Number(price.terminalId))
    }))
    .sort((left, right) => Number(right.priceSell) - Number(left.priceSell));

  return {
    commodity,
    bestBuy: buyOffers[0] ?? null,
    bestSell: sellOffers[0] ?? null,
    buyCount: buyOffers.length,
    sellCount: sellOffers.length
  };
}

export function buildShoppingList(recipes, recipeProgressMap, inventoryMap) {
  const totals = new Map();

  for (const recipe of recipes) {
    const progress = recipeProgressMap.get(recipe.id);
    if (!progress?.tracked) continue;
    const crafts = Math.max(1, Number(progress.targetCrafts || 1));
    for (const ingredient of recipe.ingredients) {
      const key = ingredient.name;
      if (!totals.has(key)) {
        totals.set(key, {
          name: key,
          needed: 0,
          owned: Number(inventoryMap.get(key)?.quantity || 0),
          usedBy: []
        });
      }
      const target = totals.get(key);
      target.needed += Number(ingredient.quantity || 0) * crafts;
      target.usedBy.push(recipe.title);
    }
  }

  return Array.from(totals.values())
    .map((item) => ({
      ...item,
      missing: Math.max(0, item.needed - item.owned)
    }))
    .sort((left, right) => {
      if (right.missing !== left.missing) return right.missing - left.missing;
      return left.name.localeCompare(right.name);
    });
}

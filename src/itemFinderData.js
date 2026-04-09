const ATTRIBUTE_PRIORITIES = [
  "Item Type",
  "Class",
  "Grade",
  "Size",
  "Damage",
  "Fire Rate",
  "Magazine Size",
  "SCM Speed",
  "Boost Speed",
  "Shield HP",
  "Power Draw"
];

export async function loadItemFinderSnapshot() {
  const response = await window.desktopAPI.getItemFinderSnapshot();
  return response?.ok ? response.snapshot : null;
}

export function getItemFinderSections(snapshot) {
  return Array.from(new Set((snapshot?.items ?? []).map((item) => item.section).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

export function getItemFinderCategories(snapshot) {
  return Array.from(new Set((snapshot?.items ?? []).map((item) => item.categoryName).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

export function getItemFinderManufacturers(snapshot) {
  return Array.from(new Set((snapshot?.items ?? []).map((item) => item.manufacturer).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

function normalizeQuery(value) {
  return String(value ?? "").trim().toLowerCase();
}

function buildTerminalMap(snapshot) {
  return new Map((snapshot?.terminals ?? []).map((terminal) => [Number(terminal.id), terminal]));
}

function buildPricesByItemId(snapshot) {
  const grouped = new Map();
  for (const price of snapshot?.prices ?? []) {
    const key = Number(price.itemId);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(price);
  }
  return grouped;
}

export function getItemFinderItems(
  snapshot,
  { search = "", section = "", category = "", manufacturer = "", size = "", liveBuyOnly = false } = {}
) {
  const query = normalizeQuery(search);
  const sizeQuery = String(size ?? "").trim();
  const pricesByItemId = buildPricesByItemId(snapshot);

  return (snapshot?.items ?? [])
    .filter((item) => {
      if (section && item.section !== section) return false;
      if (category && item.categoryName !== category) return false;
      if (manufacturer && item.manufacturer !== manufacturer) return false;
      if (sizeQuery && String(item.size || "") !== sizeQuery) return false;
      if (liveBuyOnly) {
        const offers = pricesByItemId.get(Number(item.id)) ?? [];
        if (!offers.some((offer) => Number(offer.priceBuy) > 0)) return false;
      }

      if (!query) return true;
      const haystack = [
        item.name,
        item.manufacturer,
        item.categoryName,
        item.section,
        item.typeLabel,
        item.classLabel
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeAttributeValue(attribute) {
  if (!attribute) return "";
  return `${attribute.value}${attribute.unit ? ` ${attribute.unit}` : ""}`.trim();
}

export function formatItemFinderTerminal(terminal) {
  if (!terminal) return "Unknown terminal";
  return [
    terminal.name || terminal.displayName || terminal.nickname || terminal.code,
    terminal.city,
    terminal.planet,
    terminal.moon,
    terminal.station,
    terminal.starSystem
  ]
    .filter(Boolean)
    .join(" / ");
}

export function enrichItemFinderItem(item, snapshot) {
  if (!item) return null;

  const terminalMap = buildTerminalMap(snapshot);
  const prices = (snapshot?.prices ?? []).filter((price) => Number(price.itemId) === Number(item.id));
  const buyOffers = prices
    .filter((price) => Number(price.priceBuy) > 0)
    .map((price) => ({
      ...price,
      terminal: terminalMap.get(Number(price.terminalId)) ?? null
    }))
    .sort((left, right) => Number(left.priceBuy) - Number(right.priceBuy));
  const sellOffers = prices
    .filter((price) => Number(price.priceSell) > 0)
    .map((price) => ({
      ...price,
      terminal: terminalMap.get(Number(price.terminalId)) ?? null
    }))
    .sort((left, right) => Number(right.priceSell) - Number(left.priceSell));

  const highlightedAttributes = [
    ...ATTRIBUTE_PRIORITIES.map((name) => item.attributes?.find((attribute) => attribute.attributeName === name)).filter(Boolean),
    ...(item.attributes ?? [])
  ]
    .filter((attribute, index, list) => list.findIndex((entry) => entry.attributeName === attribute.attributeName) === index)
    .map((attribute) => ({
      label: attribute.attributeName,
      value: normalizeAttributeValue(attribute)
    }))
    .filter((attribute) => attribute.value)
    .slice(0, 8);

  return {
    ...item,
    highlightedAttributes,
    buyOffers,
    sellOffers,
    bestBuy: buyOffers[0] ?? null,
    bestSell: sellOffers[0] ?? null
  };
}

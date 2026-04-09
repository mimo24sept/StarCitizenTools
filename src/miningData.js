import { MINERAL_INTEL, MINING_SHIP_PROFILES } from "./features/mining/intel";

function safeNumber(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getAttribute(component, key) {
  return component?.attributeMap?.[key]?.value ?? "";
}

function findPriceOffers(component, snapshot) {
  const terminalById = new Map((snapshot?.terminals ?? []).map((item) => [Number(item.id), item]));
  const prices = (snapshot?.prices ?? [])
    .filter((item) => Number(item.itemId) === Number(component.id) && Number(item.priceBuy) > 0)
    .map((item) => ({
      ...item,
      terminal: terminalById.get(Number(item.terminalId))
    }))
    .sort((left, right) => Number(left.priceBuy) - Number(right.priceBuy));
  return prices;
}

export async function loadMiningSnapshot() {
  const result = await window.desktopAPI.getMiningSnapshot();
  return result?.ok ? result.snapshot : null;
}

export function getMiningShips(snapshot) {
  const ships = snapshot?.vehicles ?? [];
  return ships
    .map((ship) => ({
      ...ship,
      profile: ship.miningProfile ?? MINING_SHIP_PROFILES[ship.fullName || ship.name] ?? null
    }))
    .sort((left, right) => (left.fullName || left.name).localeCompare(right.fullName || right.name));
}

export function getMiningCategories(snapshot) {
  return (snapshot?.categories ?? []).map((item) => item.name);
}

export function getMiningComponents(snapshot, categoryName = "", search = "", size = "") {
  return (snapshot?.components ?? [])
    .filter((item) => !categoryName || item.categoryName === categoryName)
    .filter((item) => !size || String(item.size || "") === String(size))
    .filter((item) => !search || `${item.name} ${item.manufacturer}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function enrichMiningComponent(component, snapshot) {
  if (!component) return null;
  const offers = findPriceOffers(component, snapshot);
  return {
    ...component,
    offers,
    bestBuy: offers[0] ?? null
  };
}

function scoreComponentForFocus(component, focus) {
  const miningPower = safeNumber(getAttribute(component, "Mining Laser Power"));
  const extractionPower = safeNumber(getAttribute(component, "Extraction Laser Power"));
  const instability = safeNumber(getAttribute(component, "Laser Instability"));
  const windowRate = safeNumber(getAttribute(component, "Optimal Charge Window Rate"));
  const windowSize = safeNumber(getAttribute(component, "Optimal Charge Window Size"));
  const resistance = safeNumber(getAttribute(component, "Resistance"));

  if (focus === "fracture") {
    return miningPower + resistance * 2 + windowRate;
  }
  if (focus === "extraction") {
    return extractionPower + windowRate + windowSize;
  }
  return (-instability * 8) + windowRate + windowSize + resistance;
}

export function getSuggestedBuilds(snapshot, ship, focus = "stability") {
  const profile = ship?.profile ?? null;
  const headSize = profile?.headSize ?? "";
  const heads = getMiningComponents(snapshot, "Mining Laser Heads", "", headSize)
    .map((item) => ({ ...item, score: scoreComponentForFocus(item, focus) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
  const modules = getMiningComponents(snapshot, "Mining Modules")
    .map((item) => ({ ...item, score: scoreComponentForFocus(item, focus) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
  const gadgets = getMiningComponents(snapshot, "Gadgets")
    .map((item) => ({ ...item, score: scoreComponentForFocus(item, focus) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);

  return { heads, modules, gadgets };
}

export function getMiningMinerals(snapshot, search = "") {
  return (snapshot?.minerals ?? [])
    .filter((item) => !search || item.name.toLowerCase().includes(search.trim().toLowerCase()))
    .map((item) => ({
      ...item,
      intel: MINERAL_INTEL[item.name] ?? null
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function enrichMineral(mineral, snapshot) {
  if (!mineral) return null;
  const terminalById = new Map((snapshot?.terminals ?? []).map((item) => [Number(item.id), item]));
  const siblingName = String(mineral.name || "").replace(/\s*\(Raw\)\s*$/i, "").trim();
  const siblingMineral = (snapshot?.minerals ?? []).find(
    (item) => String(item.name || "").trim().toLowerCase() === siblingName.toLowerCase() && Number(item.id) !== Number(mineral.id)
  );
  const offers = (snapshot?.mineralPrices ?? [])
    .filter((item) => Number(item.commodityId) === Number(mineral.id))
    .map((item) => ({
      ...item,
      terminal: terminalById.get(Number(item.terminalId))
    }));

  const siblingOffers = siblingMineral
    ? (snapshot?.mineralPrices ?? [])
        .filter((item) => Number(item.commodityId) === Number(siblingMineral.id))
        .map((item) => ({
          ...item,
          terminal: terminalById.get(Number(item.terminalId))
        }))
    : [];

  const offersForSelling = offers.some((item) => Number(item.priceSell) > 0) ? offers : siblingOffers;

  const bestSell = offersForSelling
    .filter((item) => Number(item.priceSell) > 0)
    .sort((left, right) => Number(right.priceSell) - Number(left.priceSell))[0] ?? null;

  const sellOffers = offersForSelling
    .filter((item) => Number(item.priceSell) > 0)
    .sort((left, right) => Number(right.priceSell) - Number(left.priceSell))
    .slice(0, 5);

  return {
    ...mineral,
    intel: MINERAL_INTEL[mineral.name] ?? MINERAL_INTEL[siblingName] ?? null,
    bestSell,
    sellOffers,
    sellCommodityName: bestSell && siblingMineral && offersForSelling === siblingOffers ? siblingMineral.name : mineral.name
  };
}

export function formatMiningTerminal(terminal) {
  if (!terminal) return "Unknown terminal";
  return [
    terminal.displayName || terminal.nickname || terminal.name,
    terminal.city,
    terminal.station,
    terminal.outpost,
    terminal.planet,
    terminal.moon,
    terminal.starSystem
  ].filter(Boolean).join(" / ");
}

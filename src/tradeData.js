function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function uniqueParts(parts) {
  return [...new Set(parts.filter(Boolean))];
}

export async function loadTradeSnapshot() {
  const result = await window.desktopAPI.getTradeSnapshot();
  if (!result.ok) {
    return null;
  }
  return result.snapshot;
}

export function getCargoShips(snapshot) {
  return (snapshot?.vehicles ?? [])
    .filter((item) => item.isSpaceship && safeNumber(item.scu) > 0)
    .sort((left, right) => {
      if (right.scu !== left.scu) return right.scu - left.scu;
      return (left.fullName || left.name).localeCompare(right.fullName || right.name);
    });
}

export function getTradeTerminals(snapshot) {
  return (snapshot?.terminals ?? [])
    .filter((item) => item.isVisible && item.isAvailableLive && (item.type === "commodity" || item.type === "commodity_raw"))
    .sort((left, right) => getTerminalLabel(left).localeCompare(getTerminalLabel(right)));
}

export function getSystems(snapshot) {
  const values = new Set();
  for (const terminal of getTradeTerminals(snapshot)) {
    if (terminal.starSystem) values.add(terminal.starSystem);
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

export function getTerminalLabel(terminal) {
  return terminal?.displayName || terminal?.nickname || terminal?.name || "Unknown terminal";
}

export function getTerminalSubLabel(terminal) {
  if (!terminal) return "";
  return uniqueParts([terminal.city, terminal.station, terminal.outpost, terminal.moon, terminal.planet, terminal.starSystem]).join(" / ");
}

function buildIndexes(snapshot) {
  const terminals = getTradeTerminals(snapshot);
  const terminalById = new Map(terminals.map((item) => [item.id, item]));
  const commodityById = new Map((snapshot?.commodities ?? []).map((item) => [item.id, item]));
  return { terminalById, commodityById };
}

export function calculateBestRoutes(snapshot, options) {
  if (!snapshot) return [];

  const budget = Math.max(0, Math.floor(safeNumber(options.budget, 0)));
  const cargoCapacity = Math.max(0, Math.floor(safeNumber(options.cargoCapacity, 0)));
  const originTerminalId = safeNumber(options.originTerminalId, 0);
  const selectedSystem = options.destinationSystem || "";
  const legalityFilter = options.legalityFilter || "all";
  const sortBy = options.sortBy || "profit";

  if (!budget || !cargoCapacity || !originTerminalId) return [];

  const { terminalById, commodityById } = buildIndexes(snapshot);
  const originTerminal = terminalById.get(originTerminalId);
  if (!originTerminal) return [];

  const listings = snapshot.prices ?? [];
  const buyListings = listings.filter((item) => item.terminalId === originTerminalId && item.priceBuy > 0 && item.statusBuy > 0);
  const sellListingsByCommodity = new Map();

  for (const listing of listings) {
    if (!(listing.priceSell > 0 && listing.statusSell > 0)) continue;
    const terminal = terminalById.get(listing.terminalId);
    if (!terminal || listing.terminalId === originTerminalId) continue;
    if (selectedSystem && terminal.starSystem !== selectedSystem) continue;
    if (!sellListingsByCommodity.has(listing.commodityId)) {
      sellListingsByCommodity.set(listing.commodityId, []);
    }
    sellListingsByCommodity.get(listing.commodityId).push(listing);
  }

  const routes = [];
  for (const buy of buyListings) {
    const commodity = commodityById.get(buy.commodityId);
    if (!commodity || !commodity.isVisible || !commodity.isAvailableLive) continue;
    if (legalityFilter === "legal" && commodity.isIllegal) continue;
    if (legalityFilter === "illegal" && !commodity.isIllegal) continue;

    const byBudget = Math.floor(budget / buy.priceBuy);
    const byCargo = cargoCapacity;
    const bySupply = buy.scuBuy > 0 ? Math.floor(buy.scuBuy) : cargoCapacity;
    const maxPurchasableScu = Math.min(byBudget, byCargo, bySupply);
    if (maxPurchasableScu < 1) continue;

    const destinations = sellListingsByCommodity.get(buy.commodityId) ?? [];
    for (const sell of destinations) {
      const destinationTerminal = terminalById.get(sell.terminalId);
      if (!destinationTerminal) continue;
      const unitProfit = safeNumber(sell.priceSell) - safeNumber(buy.priceBuy);
      if (unitProfit <= 0) continue;

      const byDemand = sell.scuSellStock > 0 ? Math.floor(sell.scuSellStock) : maxPurchasableScu;
      const quantity = Math.min(maxPurchasableScu, byDemand);
      if (quantity < 1) continue;

      const investment = quantity * buy.priceBuy;
      const revenue = quantity * sell.priceSell;
      const profit = revenue - investment;
      const marginPercent = investment > 0 ? (profit / investment) * 100 : 0;

      routes.push({
        commodityId: buy.commodityId,
        commodityName: commodity.name,
        commodityKind: commodity.kind,
        isIllegal: commodity.isIllegal,
        originTerminalId: originTerminal.id,
        originName: getTerminalLabel(originTerminal),
        originRegion: getTerminalSubLabel(originTerminal),
        destinationTerminalId: destinationTerminal.id,
        destinationName: getTerminalLabel(destinationTerminal),
        destinationRegion: getTerminalSubLabel(destinationTerminal),
        originSystem: originTerminal.starSystem,
        destinationSystem: destinationTerminal.starSystem,
        buyPrice: buy.priceBuy,
        sellPrice: sell.priceSell,
        unitProfit,
        quantity,
        investment,
        revenue,
        profit,
        marginPercent,
        availabilityScu: buy.scuBuy,
        destinationDemandScu: sell.scuSellStock
      });
    }
  }

  routes.sort((left, right) => {
    if (sortBy === "unit") {
      if (right.unitProfit !== left.unitProfit) return right.unitProfit - left.unitProfit;
    } else if (sortBy === "margin") {
      if (right.marginPercent !== left.marginPercent) return right.marginPercent - left.marginPercent;
    } else {
      if (right.profit !== left.profit) return right.profit - left.profit;
    }
    if (right.quantity !== left.quantity) return right.quantity - left.quantity;
    return left.commodityName.localeCompare(right.commodityName);
  });

  return routes.slice(0, 100);
}

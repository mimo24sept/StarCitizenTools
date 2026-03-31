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

export function getTradeCommodities(snapshot) {
  const visibleCommodityIds = new Set((snapshot?.prices ?? []).map((item) => item.commodityId));
  return (snapshot?.commodities ?? [])
    .filter((item) => item.isVisible && item.isAvailableLive && visibleCommodityIds.has(item.id))
    .sort((left, right) => left.name.localeCompare(right.name));
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

function createRouteFromListings(buy, sell, originTerminal, destinationTerminal, commodity, availableBudget, cargoCapacity) {
  const byBudget = Math.floor(availableBudget / buy.priceBuy);
  const byCargo = cargoCapacity;
  const bySupply = buy.scuBuy > 0 ? Math.floor(buy.scuBuy) : cargoCapacity;
  const maxPurchasableScu = Math.min(byBudget, byCargo, bySupply);
  if (maxPurchasableScu < 1) return null;

  const unitProfit = safeNumber(sell.priceSell) - safeNumber(buy.priceBuy);
  if (unitProfit <= 0) return null;

  const byDemand = sell.scuSellStock > 0 ? Math.floor(sell.scuSellStock) : maxPurchasableScu;
  const quantity = Math.min(maxPurchasableScu, byDemand);
  if (quantity < 1) return null;

  const investment = quantity * buy.priceBuy;
  const revenue = quantity * sell.priceSell;
  const profit = revenue - investment;
  const marginPercent = investment > 0 ? (profit / investment) * 100 : 0;

  return {
    mode: "single",
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
  };
}

function compareRoutes(left, right, sortBy) {
  if (sortBy === "unit") {
    if (right.unitProfit !== left.unitProfit) return right.unitProfit - left.unitProfit;
  } else if (sortBy === "margin") {
    if (right.marginPercent !== left.marginPercent) return right.marginPercent - left.marginPercent;
  } else {
    if (right.profit !== left.profit) return right.profit - left.profit;
  }
  if ((right.quantity ?? 0) !== (left.quantity ?? 0)) return (right.quantity ?? 0) - (left.quantity ?? 0);
  return String(left.commodityName || left.loopLabel || "").localeCompare(String(right.commodityName || right.loopLabel || ""));
}

function buildProfitableRoutes(snapshot, options) {
  if (!snapshot) return [];

  const budget = Math.max(0, Math.floor(safeNumber(options.budget, 0)));
  const cargoCapacity = Math.max(0, Math.floor(safeNumber(options.cargoCapacity, 0)));
  const originTerminalId = safeNumber(options.originTerminalId, 0);
  const selectedSystem = options.destinationSystem || "";
  const legalityFilter = options.legalityFilter || "all";
  const includeCommodityIds = new Set((options.includeCommodityIds ?? []).map((item) => safeNumber(item)).filter(Boolean));
  const excludeCommodityIds = new Set((options.excludeCommodityIds ?? []).map((item) => safeNumber(item)).filter(Boolean));

  if (!budget || !cargoCapacity) return [];

  const { terminalById, commodityById } = buildIndexes(snapshot);
  const listings = snapshot.prices ?? [];
  const buyListings = listings.filter((item) => {
    if (!(item.priceBuy > 0 && item.statusBuy > 0)) return false;
    if (!originTerminalId) return terminalById.has(item.terminalId);
    return item.terminalId === originTerminalId;
  });
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
    const originTerminal = terminalById.get(buy.terminalId);
    if (!originTerminal) continue;
    const commodity = commodityById.get(buy.commodityId);
    if (!commodity || !commodity.isVisible || !commodity.isAvailableLive) continue;
    if (includeCommodityIds.size && !includeCommodityIds.has(buy.commodityId)) continue;
    if (excludeCommodityIds.has(buy.commodityId)) continue;
    if (legalityFilter === "legal" && commodity.isIllegal) continue;
    if (legalityFilter === "illegal" && !commodity.isIllegal) continue;

    const destinations = sellListingsByCommodity.get(buy.commodityId) ?? [];
    for (const sell of destinations) {
      const destinationTerminal = terminalById.get(sell.terminalId);
      if (!destinationTerminal) continue;

      const route = createRouteFromListings(buy, sell, originTerminal, destinationTerminal, commodity, budget, cargoCapacity);
      if (route) routes.push(route);
    }
  }

  return routes;
}

export function calculateBestRoutes(snapshot, options) {
  const sortBy = options.sortBy || "profit";
  const routes = buildProfitableRoutes(snapshot, options);
  routes.sort((left, right) => compareRoutes(left, right, sortBy));
  return routes.slice(0, 100);
}

export function calculateCircularRoutes(snapshot, options) {
  if (!snapshot) return [];

  const budget = Math.max(0, Math.floor(safeNumber(options.budget, 0)));
  const cargoCapacity = Math.max(0, Math.floor(safeNumber(options.cargoCapacity, 0)));
  const originTerminalId = safeNumber(options.originTerminalId, 0);
  const sortBy = options.sortBy || "profit";
  if (!budget || !cargoCapacity) return [];

  const baseRoutes = buildProfitableRoutes(snapshot, { ...options, originTerminalId: 0 });
  const outgoingByOrigin = new Map();
  for (const route of baseRoutes) {
    if (!outgoingByOrigin.has(route.originTerminalId)) outgoingByOrigin.set(route.originTerminalId, []);
    outgoingByOrigin.get(route.originTerminalId).push(route);
  }

  for (const list of outgoingByOrigin.values()) {
    list.sort((left, right) => compareRoutes(left, right, sortBy));
  }

  const startTerminalIds = originTerminalId ? [originTerminalId] : Array.from(outgoingByOrigin.keys());
  const loops = [];
  const seen = new Set();

  function recalcLeg(baseRoute, availableFunds) {
    const byBudget = Math.floor(availableFunds / baseRoute.buyPrice);
    const byCargo = cargoCapacity;
    const bySupply = baseRoute.availabilityScu > 0 ? Math.floor(baseRoute.availabilityScu) : cargoCapacity;
    const maxPurchasableScu = Math.min(byBudget, byCargo, bySupply);
    if (maxPurchasableScu < 1) return null;
    const byDemand = baseRoute.destinationDemandScu > 0 ? Math.floor(baseRoute.destinationDemandScu) : maxPurchasableScu;
    const quantity = Math.min(maxPurchasableScu, byDemand);
    if (quantity < 1) return null;
    const investment = quantity * baseRoute.buyPrice;
    const revenue = quantity * baseRoute.sellPrice;
    const profit = revenue - investment;
    if (profit <= 0) return null;
    return {
      ...baseRoute,
      quantity,
      investment,
      revenue,
      profit,
      marginPercent: investment > 0 ? (profit / investment) * 100 : 0
    };
  }

  for (const startId of startTerminalIds) {
    const leg1Candidates = (outgoingByOrigin.get(startId) ?? []).slice(0, 8);
    for (const leg1Base of leg1Candidates) {
      const terminalB = leg1Base.destinationTerminalId;
      if (!terminalB || terminalB === startId) continue;

      const leg2Candidates = (outgoingByOrigin.get(terminalB) ?? []).filter((item) => item.destinationTerminalId !== startId && item.destinationTerminalId !== terminalB).slice(0, 8);
      for (const leg2Base of leg2Candidates) {
        const terminalC = leg2Base.destinationTerminalId;
        if (!terminalC || terminalC === startId || terminalC === terminalB) continue;

        const leg3Candidates = (outgoingByOrigin.get(terminalC) ?? []).filter((item) => item.destinationTerminalId === startId).slice(0, 6);
        for (const leg3Base of leg3Candidates) {
          const key = [
            startId,
            terminalB,
            terminalC,
            leg1Base.commodityId,
            leg2Base.commodityId,
            leg3Base.commodityId
          ].join(":");
          if (seen.has(key)) continue;
          seen.add(key);

          let funds = budget;
          const leg1 = recalcLeg(leg1Base, funds);
          if (!leg1) continue;
          funds += leg1.profit;

          const leg2 = recalcLeg(leg2Base, funds);
          if (!leg2) continue;
          funds += leg2.profit;

          const leg3 = recalcLeg(leg3Base, funds);
          if (!leg3) continue;

          const legs = [leg1, leg2, leg3];
          const totalProfit = legs.reduce((sum, leg) => sum + leg.profit, 0);
          const totalInvestment = legs.reduce((sum, leg) => sum + leg.investment, 0);
          const endingFunds = budget + totalProfit;
          const unitProfit = totalProfit / Math.max(cargoCapacity, 1);
          const avgLegProfit = totalProfit / legs.length;
          const uniqueCommodities = [...new Set(legs.map((leg) => leg.commodityName))];

          loops.push({
            mode: "circular",
            loopLabel: `${leg1.originName} -> ${leg1.destinationName} -> ${leg2.destinationName} -> ${leg3.destinationName}`,
            commodityName: uniqueCommodities.join(" / "),
            commoditySummary: uniqueCommodities.join(" / "),
            commodityCount: uniqueCommodities.length,
            originTerminalId: leg1.originTerminalId,
            originName: leg1.originName,
            originRegion: leg1.originRegion,
            destinationTerminalId: leg3.destinationTerminalId,
            destinationName: leg3.destinationName,
            destinationRegion: leg3.destinationRegion,
            originSystem: leg1.originSystem,
            destinationSystem: leg3.destinationSystem,
            isIllegal: legs.some((leg) => leg.isIllegal),
            legs,
            quantity: Math.min(...legs.map((leg) => leg.quantity)),
            profit: totalProfit,
            unitProfit,
            avgLegProfit,
            investment: totalInvestment,
            endingFunds,
            marginPercent: budget > 0 ? (totalProfit / budget) * 100 : 0,
            availabilityScu: Math.min(...legs.map((leg) => leg.availabilityScu || cargoCapacity)),
            destinationDemandScu: Math.min(...legs.map((leg) => leg.destinationDemandScu || cargoCapacity))
          });
        }
      }
    }
  }

  loops.sort((left, right) => compareRoutes(left, right, sortBy));
  return loops.slice(0, 60);
}

export function diversifyRoutes(routes, maxPerCommodity = 2, limit = 24) {
  const perCommodity = new Map();
  const primary = [];
  const overflow = [];

  for (const route of routes) {
    const count = perCommodity.get(route.commodityName) ?? 0;
    if (count < maxPerCommodity) {
      primary.push(route);
      perCommodity.set(route.commodityName, count + 1);
    } else {
      overflow.push(route);
    }
  }

  return [...primary, ...overflow].slice(0, limit);
}
